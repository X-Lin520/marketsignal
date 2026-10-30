import type { NewsItemData } from "@/types";

export function sessionStats(items: NewsItemData[]) {
  return {
    totalNews: items.length,
    bullishCount: items.filter((item) => item.sentiment === "Bullish").length,
    bearishCount: items.filter((item) => item.sentiment === "Bearish").length,
    neutralCount: items.filter((item) => item.sentiment === "Neutral").length,
  };
}

export function filterSession(items: NewsItemData[], params: URLSearchParams) {
  const sentiment = params.get("sentiment");
  const source = params.get("source");
  const sector = params.get("sector");
  return items.filter(
    (item) =>
      (!sentiment || sentiment === "all" || item.sentiment === sentiment) &&
      (!source || source === "all" || item.source === source) &&
      (!sector || sector === "all" || item.impactSectors.includes(sector)),
  );
}

export function toAnalysisInput(item: NewsItemData) {
  const { id, title, link, source, publishedAt, contentSnippet, ingestedAt } =
    item;
  return { id, title, link, source, publishedAt, contentSnippet, ingestedAt };
}
