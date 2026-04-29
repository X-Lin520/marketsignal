import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const [total, bullishCount, bearishCount, neutralCount, lastItem] =
    await Promise.all([
      prisma.newsItem.count(),
      prisma.newsItem.count({ where: { sentiment: "Bullish" } }),
      prisma.newsItem.count({ where: { sentiment: "Bearish" } }),
      prisma.newsItem.count({ where: { sentiment: "Neutral" } }),
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
