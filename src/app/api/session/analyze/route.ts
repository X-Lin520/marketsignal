import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth";
import { analyzeNewsItem } from "@/lib/ai/client";
import { safeAiError } from "@/lib/ai/errors";
import { readBatch } from "@/lib/session/news";
import { aiConfig } from "@/lib/ai/config";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!authorized(request, process.env.ADMIN_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.ENABLE_AI !== "true" || !aiConfig().configured)
    return NextResponse.json(
      { error: "AI 尚未配置或已停用。" },
      { status: 503 },
    );
  let inputs;
  try {
    inputs = await readBatch(request);
  } catch {
    return NextResponse.json(
      { error: "请提交 1–10 条完整且不重复的本页新闻。" },
      { status: 400 },
    );
  }
  const items = [];
  const errors = [];
  // 留出返回结果的时间；超时或离开页面后不再启动下一条收费请求。
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]);
  for (const input of inputs) {
    if (signal.aborted) {
      errors.push({ id: input.id, error: "本批已中断，未继续分析这条新闻。" });
      continue;
    }
    try {
      const result = await analyzeNewsItem(
        { ...input, publishedAt: new Date(input.publishedAt) },
        {
          operation: inputs.length === 1 ? "analyze" : "reanalyze",
          newsId: input.id,
        },
        signal,
      );
      items.push({ ...input, ...result, analyzedAt: new Date().toISOString() });
    } catch (error) {
      errors.push({ id: input.id, error: safeAiError(error) });
    }
  }
  return NextResponse.json(
    { items, errors, succeeded: items.length, failed: errors.length },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
