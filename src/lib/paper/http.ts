import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireSession } from "./auth";
import { check, PaperError } from "./errors";

export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function jsonBody(request: Request): Promise<unknown> {
  check(
    request.headers.get("content-type")?.includes("application/json"),
    "请使用 JSON 请求",
    415,
  );
  const reader = request.body?.getReader();
  check(reader, "请求内容不能为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      check(size <= 1_100_000, "请求不能超过 1 MB", 413);
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PaperError("JSON 格式不正确");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof PaperError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: privateHeaders },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "输入不正确" },
      { status: 400, headers: privateHeaders },
    );
  // 不将数据库连接字符串、模型请求或用户输入写入日志与错误响应。
  console.error(
    "[Paper] Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    { error: "服务暂不可用，请检查数据库连接与迁移状态后重试" },
    { status: 500, headers: privateHeaders },
  );
}

export async function paperRequest(
  request: Request,
  action: () => Promise<unknown>,
) {
  try {
    requireSession(request, request.method !== "GET");
    return NextResponse.json(await action(), { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
