import Parser from "rss-parser";
import type { RawFeedItem, FetchResult } from "./types";
import { RSS_SOURCES } from "./sources";
import { normalizeItems } from "./parser";

async function fetchSingleSource(
  source: (typeof RSS_SOURCES)[number],
): Promise<FetchResult> {
  try {
    const parser = new Parser<Record<string, unknown>, RawFeedItem>({
      timeout: 15000,
      // rss-parser 自身超时只拒绝 Promise；额外中止底层连接，避免检查进程悬挂。
      requestOptions: { signal: AbortSignal.timeout(15000) },
    });
    const feed = await parser.parseURL(source.url);

    if (!feed?.items?.length) {
      return {
        sourceName: source.name,
        items: [],
        error: "Feed returned no items",
      };
    }

    const normalized = normalizeItems(feed.items, source.name);
    if (normalized.length === 0) {
      return {
        sourceName: source.name,
        items: [],
        error: "Feed returned no usable news items",
      };
    }
    return { sourceName: source.name, items: normalized };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    console.error(`[RSS] Failed to fetch ${source.name}:`, message);
    return { sourceName: source.name, items: [], error: message };
  }
}

export async function fetchAllSources(): Promise<FetchResult[]> {
  const results = await Promise.all(
    RSS_SOURCES.map((source) => fetchSingleSource(source)),
  );
  return results;
}
