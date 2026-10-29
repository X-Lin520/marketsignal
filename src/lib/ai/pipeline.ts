import { prisma } from "@/lib/db/prisma";
import { analyzeNewsItem } from "./client";

const CONCURRENCY = 5;
const BATCH_DELAY_MS = 500;
// 限制每次自动采集产生的模型调用次数，剩余新闻保留到后续任务。
const MAX_ITEMS_PER_RUN = 10;
function formatSectors(sectors: string[]): string[] {
  return sectors;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAiEnabled(): boolean {
  return process.env.ENABLE_AI === "true" &&
    !!process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== "sk-ant-...";
}

export async function runAnalysisPipeline(): Promise<{
  analyzed: number;
  failed: number;
  errors: string[];
}> {
  if (!isAiEnabled()) {
    return { analyzed: 0, failed: 0, errors: ["AI analysis is disabled or not configured; items remain pending."] };
  }
  const unanalyzed = await prisma.newsItem.findMany({
    where: { analyzedAt: null },
    select: { id: true, title: true, link: true, publishedAt: true, contentSnippet: true, source: true },
    orderBy: { publishedAt: "desc" },
    take: MAX_ITEMS_PER_RUN,
  });

  if (unanalyzed.length === 0) {
    return { analyzed: 0, failed: 0, errors: [] };
  }

  let analyzed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < unanalyzed.length; i += CONCURRENCY) {
    const batch = unanalyzed.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (record) => {
        const analysis = await analyzeNewsItem(record);
        await prisma.newsItem.update({
          where: { id: record.id },
          data: {
            summary: analysis.summary,
            sentiment: analysis.sentiment,
            impactSectors: formatSectors(analysis.impactSectors),
            actionableAdvice: analysis.actionableAdvice,
            analyzedAt: new Date(),
          },
        });
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") analyzed++;
      else {
        failed++;
        errors.push(
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        );
      }
    }

    if (i + CONCURRENCY < unanalyzed.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { analyzed, failed, errors };
}
