import { paper } from "@/lib/paper";
import { paperRequest } from "@/lib/paper/http";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return paperRequest(request, () => paper.dashboard());
}
