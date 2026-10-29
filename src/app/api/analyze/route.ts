import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { analyzeNewsItem } from "@/lib/ai/client";
import { parseSectors } from "@/lib/utils/helpers";
import { authorized } from "@/lib/auth";
import { safeAiError } from "@/lib/ai/errors";
import { AnalysisDiagnosticError, logAiDiagnostic } from "@/lib/ai/diagnostics";

export async function POST(request: Request) {
  if (!authorized(request, process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { newsId } = await request.json();

    if (!newsId || typeof newsId !== "string") {
      return NextResponse.json(
        { error: "newsId is required" },
        { status: 400 },
      );
    }

    const item = await prisma.newsItem.findUnique({ where: { id: newsId } });

    if (!item) {
      return NextResponse.json(
        { error: "News item not found" },
        { status: 404 },
      );
    }

    if (
      process.env.ENABLE_AI !== "true" ||
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY === "sk-ant-..."
    ) {
      return NextResponse.json(
        { error: "AI analysis is disabled or not configured" },
        { status: 503 },
      );
    }
    const analysis = await analyzeNewsItem(
      {
        title: item.title,
        link: item.link,
        source: item.source,
        publishedAt: item.publishedAt,
        contentSnippet: item.contentSnippet,
      },
      { operation: "analyze", newsId },
    );

    const updated = await prisma.newsItem
      .update({
        where: { id: newsId },
        data: {
          summary: analysis.summary,
          sentiment: analysis.sentiment,
          impactSectors: analysis.impactSectors,
          actionableAdvice: analysis.actionableAdvice,
          analyzedAt: new Date(),
        },
      })
      .catch(() => {
        const diagnostic = { code: "SAVE_FAILED" as const };
        logAiDiagnostic(diagnostic, { operation: "analyze", newsId });
        throw new AnalysisDiagnosticError(diagnostic);
      });

    return NextResponse.json({
      item: {
        ...updated,
        publishedAt: updated.publishedAt.toISOString(),
        ingestedAt: updated.ingestedAt.toISOString(),
        analyzedAt: updated.analyzedAt?.toISOString() ?? null,
        impactSectors: parseSectors(updated.impactSectors),
      },
    });
  } catch (err) {
    const message = safeAiError(err);
    console.error("[API] Analyze error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
