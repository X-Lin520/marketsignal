import { NextResponse } from "next/server";

// 旧页面与外部任务也不能再写入、读取历史新闻或触发数据库分析。
export function retiredNewsEndpoint() {
  return NextResponse.json(
    {
      error: "已改为当前页面临时浏览，请刷新页面后重新抓取新闻。",
      code: "SESSION_ONLY",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
