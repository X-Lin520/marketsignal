import { NextResponse } from "next/server";
import { paper } from "@/lib/paper";
import { requireSession } from "@/lib/paper/auth";
import { errorResponse, privateHeaders } from "@/lib/paper/http";

export async function GET(request: Request) {
  try {
    requireSession(request);
    return NextResponse.json(await paper.exportData(), {
      headers: {
        ...privateHeaders,
        "Content-Disposition":
          'attachment; filename="marketsignal-paper-backup.json"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
