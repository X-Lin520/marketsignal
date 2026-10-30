import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth";
import { aiConfig } from "@/lib/ai/config";
import { testAiConnection } from "@/lib/ai/client";
import { safeAiError } from "@/lib/ai/errors";

export async function POST(request: Request) {
  if (!authorized(request, process.env.ADMIN_SECRET))
    return NextResponse.json(
      { error: "管理员密钥不正确，或当前环境未配置管理员密钥。" },
      { status: 401 },
    );
  let action: unknown;
  try {
    action = (await request.json()).action;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }
  if (action !== "status" && action !== "test")
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  const headers = { "Cache-Control": "no-store" };
  const config = aiConfig();
  if (process.env.ENABLE_AI !== "true")
    return NextResponse.json(
      { configured: false, message: "AI 未启用，请将 ENABLE_AI 设置为 true。" },
      { headers },
    );
  if (!config.configured)
    return NextResponse.json(
      {
        configured: false,
        message:
          config.reason === "unsupported_provider"
            ? "AI_PROVIDER 只支持 deepseek 或 openai。"
            : "缺少 AI 密钥，请检查 AI_API_KEY。",
      },
      { headers },
    );
  if (action === "test") {
    try {
      await testAiConnection(request.signal);
    } catch (error) {
      return NextResponse.json(
        {
          configured: true,
          tested: false,
          provider: config.provider,
          message: safeAiError(error),
        },
        { headers },
      );
    }
  }
  return NextResponse.json(
    {
      configured: true,
      provider: config.provider,
      tested: action === "test",
      message:
        action === "test"
          ? "连接测试成功。"
          : "配置已填写；尚未测试密钥或余额。",
    },
    { headers },
  );
}
