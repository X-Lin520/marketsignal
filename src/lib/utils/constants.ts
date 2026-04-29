export const SENTIMENT_COLORS = {
  Bullish: {
    border: "border-l-bullish",
    bg: "bg-bullish-muted",
    text: "text-bullish",
    badge: "bg-bullish-muted text-bullish border-bullish/30",
  },
  Bearish: {
    border: "border-l-bearish",
    bg: "bg-bearish-muted",
    text: "text-bearish",
    badge: "bg-bearish-muted text-bearish border-bearish/30",
  },
  Neutral: {
    border: "border-l-neutral-sentiment",
    bg: "bg-neutral-sentiment-muted",
    text: "text-neutral-sentiment",
    badge:
      "bg-neutral-sentiment-muted text-neutral-sentiment border-neutral-sentiment/30",
  },
  Pending: {
    border: "border-l-blue-500",
    bg: "bg-blue-950",
    text: "text-blue-400",
    badge: "bg-blue-950 text-blue-400 border-blue-500/30",
  },
} as const;

export const FINANCE_SECTORS = [
  "Technology",
  "Financials",
  "Healthcare",
  "Energy",
  "Consumer Discretionary",
  "Consumer Staples",
  "Industrials",
  "Materials",
  "Utilities",
  "Real Estate",
  "Communication Services",
] as const;

export const PAGE_SIZE = 20;

export const NOISE_KEYWORDS = [
  "sponsored",
  "advertisement",
  "opinion",
  "best of",
  "top 10",
  "how to",
  "5 things",
  "what to watch",
  "podcast",
  "newsletter",
  "recap",
  "weekly roundup",
];
