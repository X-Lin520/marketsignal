import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const secret = process.env.CRON_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    },
  });

  return NextResponse.json({ reset: result.count });
}
