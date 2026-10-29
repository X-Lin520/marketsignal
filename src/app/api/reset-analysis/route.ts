import { NextResponse } from "next/server";

// 旧接口会先清空全部历史分析，已停用以保护现有数据。
export async function POST() {
  return NextResponse.json({ error: "此接口已停用，请使用安全的重新分析功能。" }, { status: 410 });
}
