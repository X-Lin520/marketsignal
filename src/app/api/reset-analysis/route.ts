import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOperator } from "@/lib/paper/auth";
import { errorResponse } from "@/lib/paper/http";

export async function POST(request: Request) {
  try {
    requireOperator(request);
  } catch (error) {
    return errorResponse(error);
  }

  // Reset ALL items for fresh analysis
  const result = await prisma.newsItem.updateMany({
    where: {},
    data: {
      analyzedAt: null,
      summary: null,
      sentiment: null,
      impactSectors: [],
      actionableAdvice: null,
      analysisStatus: "pending",
      analysisModel: null,
      promptVersion: null,
      analysisAttemptedAt: null,
      analysisError: null,
    },
  });

  return NextResponse.json({ reset: result.count });
}
