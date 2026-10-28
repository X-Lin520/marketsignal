import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { analyzeRecord } from "@/lib/ai/pipeline";
import { requireOperator } from "@/lib/paper/auth";
import { check } from "@/lib/paper/errors";
import { errorResponse, jsonBody, privateHeaders } from "@/lib/paper/http";

export async function POST(request: Request) {
  try {
    requireOperator(request);
    const { newsId } = z
      .object({ newsId: z.string().min(1).max(100) })
      .strict()
      .parse(await jsonBody(request));
    const item = await prisma.newsItem.findUnique({ where: { id: newsId } });
    check(item, "新闻不存在", 404);
    const status = await analyzeRecord(item);
    return NextResponse.json(
      {
        status,
        item: await prisma.newsItem.findUnique({ where: { id: newsId } }),
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
