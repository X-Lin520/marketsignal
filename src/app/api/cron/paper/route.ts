import { NextResponse } from "next/server";
import { paper } from "@/lib/paper";
import { requireCron } from "@/lib/paper/auth";
import { errorResponse, privateHeaders } from "@/lib/paper/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    requireCron(request);
    return NextResponse.json(await paper.settle(), { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
