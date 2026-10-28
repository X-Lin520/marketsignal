import { NextResponse } from "next/server";
import { z } from "zod";
import { authConfigured, requireSameOrigin } from "@/lib/paper/auth";
import { check } from "@/lib/paper/errors";
import { errorResponse, jsonBody, privateHeaders } from "@/lib/paper/http";
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
  signSession,
  verifyPassword,
} from "@/lib/paper/session";

export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    check(authConfigured(), "实验区尚未完成服务器访问配置", 503);
    const key =
      request.headers.get("x-forwarded-for")?.split(",")[0].slice(0, 80) ??
      "local";
    const now = Date.now();
    for (const [id, attempt] of attempts)
      if (attempt.until < now) attempts.delete(id);
    check(
      attempts.size < 1_000 || attempts.has(key),
      "登录请求过多，请稍后重试",
      429,
    );
    const attempt = attempts.get(key) ?? { count: 0, until: now + 60_000 };
    check(attempt.count < 5, "尝试次数过多，请一分钟后重试", 429);
    attempt.count++;
    attempts.set(key, attempt);
    const { password } = z
      .object({ password: z.string().min(1).max(1_024) })
      .strict()
      .parse(await jsonBody(request));
    check(
      verifyPassword(password, process.env.PAPER_PASSWORD_HASH!),
      "登录口令不正确",
      401,
    );
    attempts.delete(key);
    const response = NextResponse.json(
      { ok: true },
      { headers: privateHeaders },
    );
    response.cookies.set(
      SESSION_COOKIE,
      signSession(process.env.PAPER_SESSION_SECRET!),
      {
        httpOnly: true,
        sameSite: "strict",
        secure: new URL(request.url).protocol === "https:",
        path: "/",
        maxAge: SESSION_SECONDS,
      },
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const response = NextResponse.json(
      { ok: true },
      { headers: privateHeaders },
    );
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
