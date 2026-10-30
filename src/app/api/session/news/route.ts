import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth";
import { fetchAllSources } from "@/lib/rss/fetcher";
import { createSnapshot } from "@/lib/session/news";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!authorized(request, process.env.ADMIN_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { allFailed, ...snapshot } = createSnapshot(await fetchAllSources());
    return NextResponse.json(snapshot, {
      status: allFailed ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "新闻抓取失败，请稍后重试。" },
      { status: 502 },
    );
  }
}
