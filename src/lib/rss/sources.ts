import type { RssSource } from "./types";

export const RSS_SOURCES: RssSource[] = [
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
    // 综合新闻入口已失效；使用官方标普 500 相关新闻 RSS，覆盖范围相应缩小。
    url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US",
    category: "markets",
  },
  {
    name: "Investing.com",
    url: "https://www.investing.com/rss/news.rss",
    category: "markets",
  },
];

// 暂停来源不参与抓取，但保留记录，避免把移除失效入口误称为恢复来源。
export const PAUSED_RSS_SOURCES = [
  {
    name: "Reuters",
    reason:
      "旧 Reuters Agency RSS 返回 404，尚未确认可用的官方替代入口；接入授权内容后再恢复。",
  },
] as const;
