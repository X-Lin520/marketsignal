import type { NormalizedItem } from "./types";
import { NOISE_KEYWORDS } from "@/lib/utils/constants";

function hasNoiseKeywords(title: string): boolean {
  const lower = title.toLowerCase();
  return NOISE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isTooShort(title: string): boolean {
  return title.length < 30;
}

function isSpamPattern(title: string): boolean {
  // All-caps titles (more than 50% uppercase letters)
  const letters = title.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 10) return false;
  const upperCount = letters.replace(/[^A-Z]/g, "").length;
  if (upperCount / letters.length > 0.5) return true;

  // Excessive punctuation (more than 5 ! or ?)
  const exclamations = (title.match(/[!?]/g) || []).length;
  if (exclamations > 5) return true;

  return false;
}

function isTooOld(publishedAt: Date): boolean {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return publishedAt < sevenDaysAgo;
}

export function filterNoise(items: NormalizedItem[]): NormalizedItem[] {
  return items.filter((item) => {
    if (!item.title || !item.link) return false;
    if (hasNoiseKeywords(item.title)) return false;
    if (isTooShort(item.title)) return false;
    if (isSpamPattern(item.title)) return false;
    if (isTooOld(item.publishedAt)) return false;
    return true;
  });
}
