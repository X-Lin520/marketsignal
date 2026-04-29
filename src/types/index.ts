export interface NewsItemData {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  contentSnippet: string | null;
  summary: string | null;
  sentiment: "Bullish" | "Bearish" | "Neutral" | null;
  impactSectors: string[];
  actionableAdvice: string | null;
  analyzedAt: string | null;
  ingestedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IngestSummary {
  fetched: number;
  new: number;
  analyzed: number;
  errors: string[];
}
