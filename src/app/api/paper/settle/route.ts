import { paper } from "@/lib/paper";
import { jsonBody, paperRequest } from "@/lib/paper/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return paperRequest(request, async () =>
    paper.settle(await jsonBody(request)),
  );
}
