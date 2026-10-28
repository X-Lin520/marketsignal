import { paper } from "@/lib/paper";
import { jsonBody, paperRequest } from "@/lib/paper/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return paperRequest(request, async () =>
    paper.importCsv(await jsonBody(request)),
  );
}
