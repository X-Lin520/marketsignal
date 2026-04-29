import { z } from "zod";
import type { AiAnalysis } from "./client";

const aiAnalysisSchema = z.object({
  summary: z.string().min(10).max(500),
  sentiment: z.enum(["Bullish", "Bearish", "Neutral"]),
  impactSectors: z.array(z.string()).max(3),
  actionableAdvice: z.string().nullable(),
});

export const FALLBACK_ANALYSIS: AiAnalysis = {
  summary: "Unable to analyze this article.",
  sentiment: "Neutral",
  impactSectors: [],
  actionableAdvice: null,
};

function stripMarkdownFences(text: string): string {
  const cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return cleaned;
}

/** Try to close a truncated JSON object by adding missing braces */
function closeTruncatedJson(json: string): string {
  let openBraces = 0;
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") openBraces++;
    if (ch === "}") openBraces--;
  }
  if (openBraces > 0) {
    return json + "}".repeat(openBraces);
  }
  return json;
}

/** Quick regex extraction of known fields when JSON is broken */
function extractFieldsManually(raw: string): AiAnalysis | null {
  try {
    const sentimentMatch = raw.match(/"sentiment"\s*:\s*"(Bullish|Bearish|Neutral)"/i);
    const summaryMatch = raw.match(/"summary"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
    const sectorsMatch = raw.match(/"impactSectors"\s*:\s*\[([^\]]*)\]/);
    const adviceMatch = raw.match(/"actionableAdvice"\s*:\s*(null|"([\s\S]*?)(?:"\s*[,}]|$))/);

    if (!sentimentMatch) return null;

    let sectors: string[] = [];
    if (sectorsMatch) {
      sectors = sectorsMatch[1]
        .split(",")
        .map((s) => s.replace(/["\s]/g, ""))
        .filter(Boolean);
    }

    let advice: string | null = null;
    if (adviceMatch) {
      if (adviceMatch[1] === "null") {
        advice = null;
      } else {
        advice = (adviceMatch[2] || "").replace(/["]+$/, "").trim() || null;
      }
    }

    return {
      summary: summaryMatch?.[1]?.trim() || "Analysis unavailable.",
      sentiment: sentimentMatch[1] as AiAnalysis["sentiment"],
      impactSectors: sectors.slice(0, 3),
      actionableAdvice: advice,
    };
  } catch {
    return null;
  }
}

export function parseAiResponse(raw: string): AiAnalysis {
  // Attempt 1: clean JSON parse
  try {
    const jsonStr = stripMarkdownFences(raw);
    const parsed = JSON.parse(jsonStr);
    const validated = aiAnalysisSchema.parse(parsed);
    return validated;
  } catch {
    // Attempt 2: try closing truncated JSON
    try {
      const jsonStr = closeTruncatedJson(stripMarkdownFences(raw));
      const parsed = JSON.parse(jsonStr);
      const validated = aiAnalysisSchema.parse(parsed);
      return validated;
    } catch {
      // Attempt 3: regex field extraction from broken JSON
      const extracted = extractFieldsManually(raw);
      if (extracted) {
        // Validate through zod
        const result = aiAnalysisSchema.safeParse(extracted);
        if (result.success) {
          console.warn("[AI] Recovered via regex extraction");
          return result.data;
        }
      }
    }
  }

  console.error("[AI] All parse attempts failed. Raw:", raw.slice(0, 300));
  return FALLBACK_ANALYSIS;
}
