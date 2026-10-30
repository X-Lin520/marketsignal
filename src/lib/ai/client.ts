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
import { aiConfig } from "./config";

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    const config = aiConfig();
    if (!config.configured) {
      throw new AnalysisDiagnosticError({ code: "CONFIGURATION_MISSING" });
    }
    // 根据选定服务商使用对应接口；未指定时兼容已有 DeepSeek 配置。
    openai = new OpenAI({ apiKey: config.key, baseURL: config.baseURL });
  }
  return openai;
}

export interface AiAnalysis {
  summary: string;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  impactSectors: string[];
  actionableAdvice: string | null;
}

// 显式测试时仅发送一条简短请求，不记录模型正文或密钥。
export async function testAiConnection(signal?: AbortSignal): Promise<void> {
  const config = aiConfig();
  if (!config.configured)
    throw new AnalysisDiagnosticError({ code: "CONFIGURATION_MISSING" });
  try {
    const response = await getClient().chat.completions.create(
      {
        model: config.model,
        ...(config.provider === "deepseek"
          ? { reasoning_effort: "none" as const }
          : {}),
        messages: [{ role: "user", content: "Reply OK." }],
        max_tokens: 32,
      },
      { signal, maxRetries: 0, timeout: 20_000 },
    );
    if (!response.choices[0]?.message?.content?.trim())
      throw new AnalysisDiagnosticError({ code: "OUTPUT_EMPTY" });
  } catch (error) {
    throw providerError(error);
  }
}

export async function analyzeNewsItem(
  item: NormalizedItem,
  context: AnalysisContext = {},
  signal?: AbortSignal,
): Promise<AiAnalysis> {
  const config = aiConfig();
  if (!config.configured)
    throw new AnalysisDiagnosticError({ code: "CONFIGURATION_MISSING" });
  const response = await (async () => {
    try {
      return await getClient().chat.completions.create(
        {
          model: config.model,
          // 短新闻只生成最终结果，避免思考过程耗尽正文预算。
          ...(config.provider === "deepseek"
            ? { reasoning_effort: "none" as const }
            : {}),
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
