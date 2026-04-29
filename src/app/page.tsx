import { prisma } from "@/lib/db/prisma";
import { PAGE_SIZE } from "@/lib/utils/constants";
import { parseSectors } from "@/lib/utils/helpers";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import type { NewsItemData, PaginatedResponse } from "@/types";

function deserializeItem(item: {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: Date;
  contentSnippet: string | null;
  summary: string | null;
  sentiment: string | null;
  impactSectors: string | string[];
  actionableAdvice: string | null;
  analyzedAt: Date | null;
  ingestedAt: Date;
}): NewsItemData {
  return {
    ...item,
    publishedAt: item.publishedAt.toISOString(),
    ingestedAt: item.ingestedAt.toISOString(),
    analyzedAt: item.analyzedAt?.toISOString() ?? null,
    sentiment: item.sentiment as NewsItemData["sentiment"],
    impactSectors: parseSectors(item.impactSectors),
  };
}

export default async function HomePage() {
  // Fetch initial page of news
  const items = await prisma.newsItem.findMany({
    orderBy: { publishedAt: "desc" },
    take: PAGE_SIZE,
  });

  const total = await prisma.newsItem.count();

  // Fetch sentiment counts
  const [bullishCount, bearishCount, neutralCount] = await Promise.all([
    prisma.newsItem.count({ where: { sentiment: "Bullish" } }),
    prisma.newsItem.count({ where: { sentiment: "Bearish" } }),
    prisma.newsItem.count({ where: { sentiment: "Neutral" } }),
  ]);

  // Get last ingested timestamp
  const lastItem = await prisma.newsItem.findFirst({
    orderBy: { ingestedAt: "desc" },
    select: { ingestedAt: true },
  });

  // Get distinct sources for filter dropdown
  const sourceRows = await prisma.newsItem.findMany({
    select: { source: true },
    distinct: ["source"],
    orderBy: { source: "asc" },
  });

  const initialData: PaginatedResponse<NewsItemData> = {
    items: items.map(deserializeItem),
    pagination: {
      page: 1,
      limit: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  };

  const stats = {
    totalNews: total,
    bullishCount,
    bearishCount,
    neutralCount,
    lastIngestedAt: lastItem?.ingestedAt?.toISOString() ?? null,
  };

  const sources = sourceRows.map((r) => r.source);

  return <DashboardClient initialData={initialData} stats={stats} sources={sources} />;
}
