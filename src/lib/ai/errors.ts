import {
  AnalysisDiagnosticError,
  type AnalysisDiagnosticCode,
} from "./diagnostics";

export function providerError(error: unknown): AnalysisDiagnosticError {
  if (error instanceof AnalysisDiagnosticError) return error;
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : 0;
  let code: AnalysisDiagnosticCode = "PROVIDER_ERROR";
  if (status === 401) code = "PROVIDER_AUTH";
  else if (status === 402) code = "PROVIDER_BALANCE";
  else if (status === 429) code = "PROVIDER_RATE_LIMIT";
  else if (status >= 500 && status <= 599) code = "PROVIDER_UNAVAILABLE";
  else if (typeof error === "object" && error !== null && "name" in error) {
    if (error.name === "APIConnectionError") code = "PROVIDER_CONNECTION";
    if (error.name === "APIConnectionTimeoutError") code = "PROVIDER_TIMEOUT";
  }
  return new AnalysisDiagnosticError({ code });
}

// 页面只显示固定提示，详细字段和结束原因留在受权限保护的服务器日志中。
export function safeAiError(error: unknown): string {
  const { code } = providerError(error).diagnostic;
  switch (code) {
    case "OUTPUT_TRUNCATED":
      return "AI 输出达到长度上限，结果不完整，请稍后重试。";
    case "OUTPUT_EMPTY":
      return "AI 未返回可用内容，请稍后重试。";
    case "OUTPUT_INTERRUPTED":
      return "AI 生成中断，请稍后重试。";
    case "OUTPUT_INVALID_JSON":
      return "AI 返回内容格式异常，请稍后重试。";
    case "OUTPUT_SCHEMA_INVALID":
      return "AI 返回字段不符合要求，请稍后重试。";
    case "OUTPUT_PARSE_ERROR":
      return "AI 返回内容处理失败，请稍后重试。";
    case "SAVE_FAILED":
      return "分析结果保存失败，请检查数据库状态。";
    case "CONFIGURATION_MISSING":
      return "AI 尚未配置，请检查服务配置。";
    case "PROVIDER_AUTH":
      return "AI 服务密钥认证失败，请检查配置。";
    case "PROVIDER_BALANCE":
      return "AI 服务账户余额不足，请检查余额。";
    case "PROVIDER_RATE_LIMIT":
      return "AI 服务请求过于频繁，请稍后重试。";
    case "PROVIDER_UNAVAILABLE":
      return "AI 服务暂时不可用，请稍后重试。";
    case "PROVIDER_CONNECTION":
      return "连接 AI 服务失败，请稍后重试。";
    case "PROVIDER_TIMEOUT":
      return "AI 服务请求超时，请稍后重试。";
    default:
      return "AI 分析失败，请检查服务状态及配置后重试。";
  }
}
