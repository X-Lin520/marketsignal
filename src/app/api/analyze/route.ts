import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { analyzeNewsItem } from "@/lib/ai/client";
import { FALLBACK_ANALYSIS } from "@/lib/ai/parser";
import { parseSectors } from "@/lib/utils/helpers";


export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const secret = process.env.CRON_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { newsId } = await request.json();

    if (!newsId || typeof newsId !== "string") {
      return NextResponse.json({ error: "newsId is required" }, { status: 400 });
    }

    const item = await prisma.newsItem.findUnique({ where: { id: newsId } });

    if (!item) {
      return NextResponse.json({ error: "News item not found" }, { status: 404 });
    }

    let analysis;
    if (process.env.ENABLE_AI !== "true" || !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "sk-ant-...") {
      analysis = FALLBACK_ANALYSIS;
    } else {
      analysis = await analyzeNewsItem({
        title: item.title,
        link: item.link,
        source: item.source,
        publishedAt: item.publishedAt,
        contentSnippet: item.contentSnippet,
      });
    }

    const updated = await prisma.newsItem.update({
      where: { id: newsId },
      data: {
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        impactSectors: analysis.impactSectors,
        actionableAdvice: analysis.actionableAdvice,
        analyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      item: {
        ...updated,
        publishedAt: updated.publishedAt.toISOString(),
        ingestedAt: updated.ingestedAt.toISOString(),
        analyzedAt: updated.analyzedAt?.toISOString() ?? null,
        impactSectors: parseSectors(updated.impactSectors),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Re-analysis failed";
    console.error("[API] Analyze error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
