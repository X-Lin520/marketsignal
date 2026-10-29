// 不把供应商原始错误及可能包含的密钥片段发送到页面或日志。
export function safeAiError(error: unknown): string {
  const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
  if (status === 401) return "DeepSeek API 密钥认证失败，请检查配置。";
  if (status === 402) return "DeepSeek 账户余额不足，请检查余额。";
  if (status === 429) return "DeepSeek 请求过于频繁，请稍后重试。";
  return "AI 分析失败，请检查服务状态及配置后重试。";
}
