import { NextResponse } from "next/server";
import { fetchAllSources } from "@/lib/rss/fetcher";
import { filterNoise } from "@/lib/rss/noise-filter";
import { deduplicate } from "@/lib/rss/deduplicator";
import { runAnalysisPipeline } from "@/lib/ai/pipeline";
import { prisma } from "@/lib/db/prisma";
import type { IngestSummary } from "@/types";
import { authorized } from "@/lib/auth";

async function ingest(request: Request, secret: string | undefined) {
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];

  try {
    // Step 1: Fetch all RSS sources
    const fetchResults = await fetchAllSources();
    const allItems = fetchResults.flatMap((r) => r.items);
    const fetchErrors = fetchResults
      .filter((r) => r.error)
      .map((r) => `${r.sourceName}: ${r.error}`);
    errors.push(...fetchErrors);

    // Step 2: Noise filter
    const cleanItems = filterNoise(allItems);

    // Step 3: Deduplicate against DB
    const newItems = await deduplicate(cleanItems);

    // Step 4: Insert new items (unanalyzed)
    let inserted = 0;
    if (newItems.length > 0) {
      const result = await prisma.newsItem.createMany({
        data: newItems.map((item) => ({
          title: item.title,
          link: item.link,
          source: item.source,
          publishedAt: item.publishedAt,
          contentSnippet: item.contentSnippet,
        })),
        skipDuplicates: true,
      });
      inserted = result.count;
    }

    // Step 5: Run AI analysis on all unanalyzed items
    const analysisResult = await runAnalysisPipeline();
    errors.push(...analysisResult.errors);

    const summary: IngestSummary = {
      fetched: allItems.length,
      new: inserted,
      analyzed: analysisResult.analyzed,
      errors,
    };

    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest pipeline failed";
    console.error("[Cron] Ingest error:", message);
    return NextResponse.json(
      { fetched: 0, new: 0, analyzed: 0, errors: [message] },
      { status: 500 },
    );
  }
}

// Vercel Cron 使用 GET；手动调用仍可使用 POST，并共享鉴权逻辑。
export function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // 旧版可能曾把同一个密钥打包到前端；相同时暂停定时任务，避免任意访客触发收费调用。
  if (secret && secret === process.env.NEXT_PUBLIC_CRON_SECRET) {
    console.error("[Cron] A public variable matches the cron secret. Rotate the cron secret before enabling scheduled ingestion.");
    return NextResponse.json({ error: "Scheduled ingestion is unavailable until its secret is rotated." }, { status: 503 });
  }
  return ingest(request, secret);
}
export function POST(request: Request) { return ingest(request, process.env.ADMIN_SECRET); }
