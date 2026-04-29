import { prisma } from "@/lib/db/prisma";
import { analyzeNewsItem } from "./client";
import { FALLBACK_ANALYSIS } from "./parser";

const CONCURRENCY = 5;
const BATCH_DELAY_MS = 500;
const isPostgres = process.env.DATABASE_URL?.startsWith("postgres");

function formatSectors(sectors: string[]): string | string[] {
  // SQLite stores as JSON string; PostgreSQL stores as native array
  return isPostgres ? sectors : JSON.stringify(sectors);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAiEnabled(): boolean {
  return process.env.ENABLE_AI === "true" &&
    !!process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY !== "sk-ant-...";
}

async function analyzeWithFallback(title: string, contentSnippet: string | null, source: string) {
  if (!isAiEnabled()) {
    return { ...FALLBACK_ANALYSIS, summary: `[Pending analysis] ${title}` };
  }

  try {
    return await analyzeNewsItem({
      title,
      link: "",
      source,
      publishedAt: new Date(),
      contentSnippet,
    });
  } catch (err) {
    console.error(`[AI] Analysis failed for "${title.slice(0, 60)}...":`, err);
    return FALLBACK_ANALYSIS;
  }
}

export async function runAnalysisPipeline(): Promise<{
  analyzed: number;
  failed: number;
  errors: string[];
}> {
  const unanalyzed = await prisma.newsItem.findMany({
    where: { analyzedAt: null },
    select: { id: true, title: true, contentSnippet: true, source: true },
    orderBy: { publishedAt: "desc" },
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
        const analysis = await analyzeWithFallback(
          record.title,
          record.contentSnippet,
          record.source,
        );
        await prisma.newsItem.update({
          where: { id: record.id },
          data: {
            summary: analysis.summary,
            sentiment: analysis.sentiment,
            impactSectors: formatSectors(analysis.impactSectors) as string,
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
