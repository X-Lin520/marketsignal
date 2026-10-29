import { z } from "zod";
import type { AiAnalysis } from "./client";
import {
  AnalysisDiagnosticError,
  type AnalysisDiagnostic,
} from "./diagnostics";

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
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
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
    const sentimentMatch = raw.match(
      /"sentiment"\s*:\s*"(Bullish|Bearish|Neutral)"/i,
    );
    const summaryMatch = raw.match(/"summary"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
    const sectorsMatch = raw.match(/"impactSectors"\s*:\s*\[([^\]]*)\]/);
    const adviceMatch = raw.match(
      /"actionableAdvice"\s*:\s*(null|"([\s\S]*?)(?:"\s*[,}]|$))/,
    );

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
  let validationFailure: AnalysisDiagnostic | undefined;
  function validate(candidate: unknown): AiAnalysis {
    const result = aiAnalysisSchema.safeParse(candidate);
    if (result.success) return result.data;
    // 保留首次真实字段错误，避免后续恢复尝试把它淹没为笼统的 JSON 错误。
    validationFailure ??= {
      code: "OUTPUT_SCHEMA_INVALID",
      contentLength: raw.length,
      summaryLength:
        typeof candidate === "object" &&
        candidate !== null &&
        "summary" in candidate &&
        typeof candidate.summary === "string"
          ? candidate.summary.length
          : undefined,
      issues: result.error.issues.map((issue) => ({
        field: typeof issue.path[0] === "string" ? issue.path[0] : "other",
        code: issue.code,
        limit:
          "maximum" in issue && typeof issue.maximum === "number"
            ? issue.maximum
            : "minimum" in issue && typeof issue.minimum === "number"
              ? issue.minimum
              : undefined,
      })),
    };
    throw new AnalysisDiagnosticError(validationFailure);
  }
  // Attempt 1: clean JSON parse
  try {
    const jsonStr = stripMarkdownFences(raw);
    const parsed = JSON.parse(jsonStr);
    return validate(parsed);
  } catch {
    // Attempt 2: try closing truncated JSON
    try {
      const jsonStr = closeTruncatedJson(stripMarkdownFences(raw));
      const parsed = JSON.parse(jsonStr);
      return validate(parsed);
    } catch {
      // Attempt 3: regex field extraction from broken JSON
      const extracted = extractFieldsManually(raw);
      if (extracted) {
        // Validate through zod
        const result = aiAnalysisSchema.safeParse(extracted);
        if (result.success) {
          return result.data;
        }
      }
    }
  }

  throw new AnalysisDiagnosticError(
    validationFailure ?? {
      code: "OUTPUT_INVALID_JSON",
      contentLength: raw.length,
    },
  );
}
