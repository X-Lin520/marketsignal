import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseSectors } from "@/lib/utils/helpers";
import type { NewsItemData } from "@/types";

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
