import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validAnalysisFilter } from "@/lib/ai/legacy";

export async function GET() {
  const [total, bullishCount, bearishCount, neutralCount, lastItem] =
    await Promise.all([
      prisma.newsItem.count(),
      prisma.newsItem.count({ where: { sentiment: "Bullish", ...validAnalysisFilter } }),
      prisma.newsItem.count({ where: { sentiment: "Bearish", ...validAnalysisFilter } }),
      prisma.newsItem.count({ where: { sentiment: "Neutral", ...validAnalysisFilter } }),
      prisma.newsItem.findFirst({
        orderBy: { ingestedAt: "desc" },
        select: { ingestedAt: true },
      }),
    ]);

  return NextResponse.json({
    totalNews: total,
    bullishCount,
    bearishCount,
    neutralCount,
    lastIngestedAt: lastItem?.ingestedAt?.toISOString() ?? null,
  });
}
