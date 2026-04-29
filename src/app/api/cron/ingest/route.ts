import { NextResponse } from "next/server";
import { fetchAllSources } from "@/lib/rss/fetcher";
import { filterNoise } from "@/lib/rss/noise-filter";
import { deduplicate } from "@/lib/rss/deduplicator";
import { runAnalysisPipeline } from "@/lib/ai/pipeline";
import { prisma } from "@/lib/db/prisma";
import type { IngestSummary } from "@/types";

export async function POST(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const secret = process.env.CRON_SECRET;

  if (!secret || token !== secret) {
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
    if (newItems.length > 0) {
      await prisma.newsItem.createMany({
        data: newItems.map((item) => ({
          title: item.title,
          link: item.link,
          source: item.source,
          publishedAt: item.publishedAt,
          contentSnippet: item.contentSnippet,
        })),
      });
    }

    // Step 5: Run AI analysis on all unanalyzed items
    const analysisResult = await runAnalysisPipeline();
    errors.push(...analysisResult.errors);

    const summary: IngestSummary = {
      fetched: allItems.length,
      new: newItems.length,
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
