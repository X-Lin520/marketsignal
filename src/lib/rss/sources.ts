import type { RssSource } from "./types";

export const RSS_SOURCES: RssSource[] = [
  {
    name: "Reuters",
    url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",
    category: "business",
  },
  {
    name: "CNBC",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    category: "markets",
  },
  {
    name: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    category: "markets",
  },
  {
    name: "Bloomberg",
    url: "https://feeds.bloomberg.com/markets/news.rss",
    category: "markets",
  },
  {
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
    category: "business",
  },
  {
    name: "Investing.com",
    url: "https://www.investing.com/rss/news.rss",
    category: "markets",
  },
];
