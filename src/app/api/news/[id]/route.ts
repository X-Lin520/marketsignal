import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseSectors } from "@/lib/utils/helpers";
import type { NewsItemData } from "@/types";
import { isLegacyPlaceholder } from "@/lib/ai/legacy";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const item = await prisma.newsItem.findUnique({ where: { id } });

  if (!item) {
    return NextResponse.json(
      { error: "News item not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ item: deserializeItem(item) });
}
