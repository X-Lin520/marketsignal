import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PAGE_SIZE } from "@/lib/utils/constants";
import { parseSectors } from "@/lib/utils/helpers";
import type { PaginatedResponse, NewsItemData } from "@/types";

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)));
  const sentiment = searchParams.get("sentiment");
  const source = searchParams.get("source");
  const sector = searchParams.get("sector");
  const sort = searchParams.get("sort") ?? "publishedAt_desc";

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (sentiment && ["Bullish", "Bearish", "Neutral"].includes(sentiment)) {
    where.sentiment = sentiment;
  }
  if (source) {
    where.source = source;
  }
  if (sector) {
    where.impactSectors = { has: sector };
  }

  // Build orderBy
  let orderBy: Record<string, string>;
  switch (sort) {
    case "publishedAt_asc":
      orderBy = { publishedAt: "asc" };
      break;
    case "ingestedAt_desc":
      orderBy = { ingestedAt: "desc" };
      break;
    default:
      orderBy = { publishedAt: "desc" };
  }

  const [items, total] = await Promise.all([
    prisma.newsItem.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.newsItem.count({ where }),
  ]);

  const response: PaginatedResponse<NewsItemData> = {
    items: items.map(deserializeItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };

  return NextResponse.json(response);
}
