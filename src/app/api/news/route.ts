import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PAGE_SIZE } from "@/lib/utils/constants";
import { parseSectors } from "@/lib/utils/helpers";
import type { PaginatedResponse, NewsItemData } from "@/types";
import { isLegacyPlaceholder, validAnalysisFilter } from "@/lib/ai/legacy";

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
  const placeholder = isLegacyPlaceholder(item.summary);
  return {
    ...item,
    publishedAt: item.publishedAt.toISOString(),
    ingestedAt: item.ingestedAt.toISOString(),
    analyzedAt: placeholder ? null : item.analyzedAt?.toISOString() ?? null,
    summary: placeholder ? null : item.summary,
    actionableAdvice: placeholder ? null : item.actionableAdvice,
    sentiment: placeholder ? null : item.sentiment as NewsItemData["sentiment"],
    impactSectors: placeholder ? [] : parseSectors(item.impactSectors),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pageText = searchParams.get("page") ?? "1";
  const limitText = searchParams.get("limit") ?? String(PAGE_SIZE);
  if (!/^\d+$/.test(pageText) || !/^\d+$/.test(limitText)) {
    return NextResponse.json({ error: "page and limit must be positive integers" }, { status: 400 });
  }
  const pageValue = Number(pageText);
  const limitValue = Number(limitText);
  if (!Number.isSafeInteger(pageValue) || pageValue < 1 || !Number.isSafeInteger(limitValue) || limitValue < 1) {
    return NextResponse.json({ error: "page and limit must be positive integers" }, { status: 400 });
  }
  const page = pageValue;
  const limit = Math.min(50, limitValue);
  const sentiment = searchParams.get("sentiment");
  const source = searchParams.get("source");
  const sector = searchParams.get("sector");
  const sort = searchParams.get("sort") ?? "publishedAt_desc";

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (sentiment && ["Bullish", "Bearish", "Neutral"].includes(sentiment)) {
    where.sentiment = sentiment;
    Object.assign(where, validAnalysisFilter);
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
