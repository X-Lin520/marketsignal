import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { analyzeNewsItem } from "@/lib/ai/client";

// 分批处理，只有成功取得新结果后才覆盖原记录；失败保留原结果。
export async function POST(request: Request) {
  if (!authorized(request, process.env.ADMIN_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.ENABLE_AI !== "true" || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-...") {
    return NextResponse.json({ error: "AI analysis is disabled or not configured" }, { status: 503 });
  }
  let cursor: string | null;
  try {
    const body = await request.json();
    cursor = body.cursor ?? null;
    if (cursor !== null && (typeof cursor !== "string" || cursor.length > 100)) throw new Error("invalid cursor");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const rows = await prisma.newsItem.findMany({
    where: cursor ? { id: { gt: cursor } } : {},
    orderBy: { id: "asc" }, take: 10,
  });
  let succeeded = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const result = await analyzeNewsItem(row);
      await prisma.newsItem.update({ where: { id: row.id }, data: { ...result, analyzedAt: new Date() } });
      succeeded++;
    } catch (error) {
      failed++;
      console.error("[AI] Re-analysis failed:", row.id, error);
    }
  }
  return NextResponse.json({ succeeded, failed, nextCursor: rows.length === 10 ? rows[rows.length - 1].id : null });
}
