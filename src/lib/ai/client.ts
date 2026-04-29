import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import { parseAiResponse } from "./parser";
import type { NormalizedItem } from "@/lib/rss/types";

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "sk-ant-...") {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

export interface AiAnalysis {
  summary: string;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  impactSectors: string[];
  actionableAdvice: string | null;
}

export async function analyzeNewsItem(
  item: NormalizedItem,
): Promise<AiAnalysis> {
  const client = getClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250914",
    max_tokens: 600,
    temperature: 0.1,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(item) }],
  });

  const text = (response.content[0] as { text: string }).text;
  return parseAiResponse(text);
}
