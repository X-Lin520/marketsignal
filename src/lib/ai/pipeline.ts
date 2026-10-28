import { prisma } from "@/lib/db/prisma";
import { ANALYSIS_MODEL, analyzeNewsItem } from "./client";
import { PROMPT_VERSION } from "./prompt";
import type { NormalizedItem } from "@/lib/rss/types";

const CONCURRENCY = 5;

export async function analyzeRecord(record: NormalizedItem & { id: string }) {
  const enabled =
    process.env.ENABLE_AI === "true" &&
    !!process.env.OPENAI_API_KEY &&
    !process.env.OPENAI_API_KEY.endsWith("...");
  const attemptedAt = new Date();
  if (!enabled) {
    await prisma.newsItem.update({
      where: { id: record.id },
      data: {
        analysisStatus: "disabled",
        analysisAttemptedAt: attemptedAt,
        analysisError: null,
        analyzedAt: null,
        summary: null,
        sentiment: null,
        impactSectors: [],
        actionableAdvice: null,
        analysisModel: null,
        promptVersion: null,
      },
    });
    return "disabled" as const;
  }
  try {
    // 使用源文章真实发布时间；不把执行分析的时间冒充新闻发布时间。
    const analysis = await analyzeNewsItem(record);
    await prisma.newsItem.update({
      where: { id: record.id },
      data: {
        ...analysis,
        analyzedAt: new Date(),
        analysisStatus: "success",
        analysisAttemptedAt: attemptedAt,
        analysisModel: ANALYSIS_MODEL,
        promptVersion: PROMPT_VERSION,
        analysisError: null,
      },
    });
    return "success" as const;
  } catch {
    await prisma.newsItem.update({
      where: { id: record.id },
      data: {
        analyzedAt: null,
        summary: null,
        sentiment: null,
        impactSectors: [],
        actionableAdvice: null,
        analysisStatus: "failed",
        analysisAttemptedAt: attemptedAt,
        analysisError: "分析失败，请稍后重试",
        analysisModel: ANALYSIS_MODEL,
        promptVersion: PROMPT_VERSION,
      },
    });
    return "failed" as const;
  }
}

export async function runAnalysisPipeline() {
  const records = await prisma.newsItem.findMany({
    where: { analyzedAt: null },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  let analyzed = 0,
    failed = 0,
    disabled = 0;
  const errors: string[] = [];
  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(
      records.slice(i, i + CONCURRENCY).map(analyzeRecord),
    );
    for (const result of results) {
      if (result.status === "rejected" || result.value === "failed") {
        failed++;
        errors.push("部分新闻分析失败，已保留失败状态");
      } else if (result.value === "disabled") disabled++;
      else analyzed++;
    }
  }
  return { analyzed, failed, disabled, errors: [...new Set(errors)] };
}
