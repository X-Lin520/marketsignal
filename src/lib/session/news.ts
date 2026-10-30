import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NewsItemData } from "@/types";
import type { FetchResult } from "@/lib/rss/types";
import { filterNoise } from "@/lib/rss/noise-filter";

const webUrl = z
  .string()
  .max(2048)
  .url()
  .regex(/^https?:\/\//);
export const sessionInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(1000),
  link: webUrl,
  source: z.string().trim().min(1).max(100),
  publishedAt: z.iso.datetime(),
  contentSnippet: z.string().max(503).nullable(),
  ingestedAt: z.iso.datetime(),
});
export const sessionBatchInput = z
  .object({
    items: z.array(sessionInput).min(1).max(10),
  })
  .refine(
    ({ items }) => new Set(items.map((item) => item.id)).size === items.length,
  );

// 仅在本次请求中整理结果；不连接数据库，不缓存到服务器或浏览器存储。
export function createSnapshot(results: FetchResult[], now = new Date()) {
  const seen = new Set<string>();
  const items: NewsItemData[] = filterNoise(
    results.flatMap((result) => result.items),
  )
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .filter((item) => {
      if (!/^https?:\/\//.test(item.link) || seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    })
    .slice(0, 200)
    .map((item) => ({
      id: randomUUID(),
      title: item.title.slice(0, 1000),
      link: item.link,
      source: item.source,
      publishedAt: item.publishedAt.toISOString(),
      contentSnippet: item.contentSnippet?.slice(0, 503) ?? null,
      summary: null,
      sentiment: null,
      impactSectors: [],
      actionableAdvice: null,
      analyzedAt: null,
      ingestedAt: now.toISOString(),
    }));
  return {
    items,
    fetchedAt: now.toISOString(),
    errors: results
      .filter((result) => result.error)
      .map((result) => `${result.sourceName}: ${result.error}`),
    allFailed: results.length === 0 || results.every((result) => result.error),
  };
}

// 输入设上限，旧版只传数据库 ID 的请求不能调用模型。
export async function readBatch(request: Request) {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 32_768)
    throw new Error("Request too large");
  return sessionBatchInput.parse(JSON.parse(text)).items;
}
