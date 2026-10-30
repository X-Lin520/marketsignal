export function aiConfig(env: NodeJS.ProcessEnv = process.env) {
  const provider = env.AI_PROVIDER?.trim().toLowerCase() || "deepseek";
  if (provider !== "deepseek" && provider !== "openai") {
    return {
      configured: false as const,
      reason: "unsupported_provider" as const,
    };
  }
  // 旧部署未设置 AI_PROVIDER 时，OPENAI_API_KEY 实际保存 DeepSeek 密钥。
  const key =
    env.AI_API_KEY?.trim() ||
    (provider === "deepseek" ? env.OPENAI_API_KEY?.trim() : undefined);
  if (!key || key === "sk-...") {
    return {
      configured: false as const,
      reason: "missing_or_disabled" as const,
    };
  }
  return {
    configured: true as const,
    provider,
    key,
    model:
      env.AI_MODEL?.trim() ||
      (provider === "deepseek" ? "deepseek-flash" : "gpt-4o-mini"),
    baseURL: provider === "deepseek" ? "https://api.deepseek.com" : undefined,
  };
}
