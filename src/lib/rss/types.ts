export interface RawFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  guid?: string;
  creator?: string;
}

export interface NormalizedItem {
  title: string;
  link: string;
  source: string;
  publishedAt: Date;
  contentSnippet: string | null;
}

export interface RssSource {
  name: string;
  url: string;
  category: string;
}

export interface FetchResult {
  sourceName: string;
  items: NormalizedItem[];
  error?: string;
}
