import OpenAI from "openai";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import { parseAiResponse } from "./parser";
import { providerError } from "./errors";
import {
  AnalysisDiagnosticError,
  logAiDiagnostic,
  type AnalysisContext,
  type AnalysisDiagnostic,
} from "./diagnostics";
import type { NormalizedItem } from "@/lib/rss/types";

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "sk-...") {
      throw new AnalysisDiagnosticError({ code: "CONFIGURATION_MISSING" });
    }
    // 现有环境变量中保存的是 DeepSeek 密钥；使用兼容接口而不是 OpenAI 服务。
    openai = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return openai;
}

export interface AiAnalysis {
  summary: string;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  impactSectors: string[];
  actionableAdvice: string | null;
}

export async function analyzeNewsItem(
  item: NormalizedItem,
  context: AnalysisContext = {},
  signal?: AbortSignal,
): Promise<AiAnalysis> {
  const response = await (async () => {
    try {
      return await getClient().chat.completions.create(
        {
          model: "deepseek-flash",
          // 短新闻只生成最终结果，避免思考过程耗尽正文预算。
          reasoning_effort: "none",
          response_format: { type: "json_object" },
          max_tokens: 1024,
          temperature: 0.1,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserMessage(item) },
          ],
        },
        { signal, maxRetries: 0, timeout: 45_000 },
      );
    } catch (error) {
      const failure = providerError(error);
      logAiDiagnostic(failure.diagnostic, context);
      throw failure;
    }
  })();

  const choice = response.choices[0];
  const text = choice?.message?.content || "";
  const metadata = {
    finishReason: choice?.finish_reason,
    contentLength: text.length,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    reasoningTokens:
      response.usage?.completion_tokens_details?.reasoning_tokens,
  };
  try {
    // 达到生成上限时，禁止把正则恢复出的局部结果标为成功。
    if (choice?.finish_reason === "length") {
      throw new AnalysisDiagnosticError({ code: "OUTPUT_TRUNCATED" });
    }
    if (!choice) throw new AnalysisDiagnosticError({ code: "OUTPUT_EMPTY" });
    if (choice.finish_reason !== "stop") {
      throw new AnalysisDiagnosticError({ code: "OUTPUT_INTERRUPTED" });
    }
    if (!text.trim())
      throw new AnalysisDiagnosticError({ code: "OUTPUT_EMPTY" });
    const analysis = parseAiResponse(text);
    logAiDiagnostic(
      {
        code: "OUTPUT_ACCEPTED",
        ...metadata,
        summaryLength: analysis.summary.length,
      },
      context,
    );
    return analysis;
  } catch (error) {
    const diagnostic: AnalysisDiagnostic =
      error instanceof AnalysisDiagnosticError
        ? error.diagnostic
        : { code: "OUTPUT_PARSE_ERROR" };
    const failure = new AnalysisDiagnosticError({ ...diagnostic, ...metadata });
    logAiDiagnostic(failure.diagnostic, context);
    throw failure;
  }
}
