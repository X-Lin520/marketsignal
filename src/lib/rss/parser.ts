import type { RawFeedItem, NormalizedItem } from "./types";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function extractSnippet(item: RawFeedItem): string | null {
  const raw = item.contentSnippet || item.content || "";
  const cleaned = stripHtml(raw);
  if (!cleaned) return null;
  return cleaned.length > 500 ? cleaned.slice(0, 500) + "..." : cleaned;
}

function parseDate(item: RawFeedItem): Date {
  // Try isoDate first (ISO 8601), then pubDate (RFC 822)
  const dateStr = item.isoDate || item.pubDate;
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date(); // fallback to now
}

export function normalizeItems(
  items: RawFeedItem[],
  sourceName: string,
): NormalizedItem[] {
  return items
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title!.trim(),
      link: item.link!.trim(),
      source: sourceName,
      publishedAt: parseDate(item),
      contentSnippet: extractSnippet(item),
    }));
}
