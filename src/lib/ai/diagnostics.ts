export type AnalysisOperation = "ingest" | "analyze" | "reanalyze";

export interface AnalysisContext {
  operation?: AnalysisOperation;
  newsId?: string;
}

const diagnosticStages = {
  OUTPUT_ACCEPTED: "validation",
  OUTPUT_TRUNCATED: "generation",
  OUTPUT_EMPTY: "generation",
  OUTPUT_INTERRUPTED: "generation",
  OUTPUT_INVALID_JSON: "parse",
  OUTPUT_SCHEMA_INVALID: "validation",
  OUTPUT_PARSE_ERROR: "parse",
  SAVE_FAILED: "save",
  CONFIGURATION_MISSING: "configuration",
  PROVIDER_AUTH: "provider",
  PROVIDER_BALANCE: "provider",
  PROVIDER_RATE_LIMIT: "provider",
  PROVIDER_UNAVAILABLE: "provider",
  PROVIDER_CONNECTION: "provider",
  PROVIDER_TIMEOUT: "provider",
  PROVIDER_ERROR: "provider",
} as const;

export type AnalysisDiagnosticCode = keyof typeof diagnosticStages;

export interface AnalysisIssue {
  field: string;
  code: string;
  limit?: number;
}

export interface AnalysisDiagnostic {
  code: AnalysisDiagnosticCode;
  finishReason?: string | null;
  contentLength?: number;
  summaryLength?: number;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  issues?: AnalysisIssue[];
}

export class AnalysisDiagnosticError extends Error {
  constructor(public readonly diagnostic: AnalysisDiagnostic) {
    super(`AI analysis failed (${diagnostic.code})`);
    this.name = "AnalysisDiagnosticError";
  }
}

const fields = new Set([
  "summary",
  "sentiment",
  "impactSectors",
  "actionableAdvice",
]);
const issueCodes = new Set([
  "invalid_type",
  "too_big",
  "too_small",
  "invalid_value",
  "invalid_format",
  "unrecognized_keys",
  "custom",
]);
const finishReasons = new Set([
  "stop",
  "length",
  "content_filter",
  "tool_calls",
  "insufficient_system_resource",
  "aborted",
]);

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

// 只投影固定字段；不序列化供应商错误、模型文本或 Zod 的原始 message/input。
export function safeDiagnostic(
  diagnostic: AnalysisDiagnostic,
  context: AnalysisContext = {},
) {
  const code = Object.hasOwn(diagnosticStages, diagnostic.code)
    ? diagnostic.code
    : "PROVIDER_ERROR";
  return {
    event:
      code === "OUTPUT_ACCEPTED" ? "model_output_accepted" : "analysis_failure",
    model:
      process.env.AI_MODEL ||
      (process.env.AI_PROVIDER?.trim().toLowerCase() === "openai"
        ? "gpt-4o-mini"
        : "deepseek-flash"),
    code,
    stage: diagnosticStages[code],
    operation: ["ingest", "analyze", "reanalyze"].includes(
      context.operation ?? "",
    )
      ? context.operation
      : undefined,
    newsId:
      typeof context.newsId === "string" &&
      (/^c[a-z0-9]{24}$/.test(context.newsId) ||
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          context.newsId,
        ))
        ? context.newsId
        : undefined,
    finishReason:
      diagnostic.finishReason == null
        ? "missing"
        : finishReasons.has(diagnostic.finishReason)
          ? diagnostic.finishReason
          : "other",
    contentLength: safeNumber(diagnostic.contentLength),
    summaryLength: safeNumber(diagnostic.summaryLength),
    promptTokens: safeNumber(diagnostic.promptTokens),
    completionTokens: safeNumber(diagnostic.completionTokens),
    reasoningTokens: safeNumber(diagnostic.reasoningTokens),
    issues: diagnostic.issues?.slice(0, 8).map((issue) => ({
      field: fields.has(issue.field) ? issue.field : "other",
      code: issueCodes.has(issue.code) ? issue.code : "other",
      limit: safeNumber(issue.limit),
    })),
  };
}

export function logAiDiagnostic(
  diagnostic: AnalysisDiagnostic,
  context: AnalysisContext = {},
) {
  const value = JSON.stringify(safeDiagnostic(diagnostic, context));
  if (diagnostic.code === "OUTPUT_ACCEPTED") {
    console.info("[AI] Analysis diagnostic", value);
  } else {
    console.error("[AI] Analysis diagnostic", value);
  }
}
