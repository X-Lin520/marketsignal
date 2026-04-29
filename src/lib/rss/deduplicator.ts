import { prisma } from "@/lib/db/prisma";
import type { NormalizedItem } from "./types";

export async function deduplicate(
  items: NormalizedItem[],
): Promise<NormalizedItem[]> {
  if (items.length === 0) return [];

  const links = items.map((item) => item.link);

  const existing = await prisma.newsItem.findMany({
    where: { link: { in: links } },
    select: { link: true },
  });

  const existingLinks = new Set(existing.map((e) => e.link));

  return items.filter((item) => !existingLinks.has(item.link));
}
