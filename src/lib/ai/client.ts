import OpenAI from "openai";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import { parseAiResponse } from "./parser";
import type { NormalizedItem } from "@/lib/rss/types";

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "sk-...") {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
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

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    max_tokens: 600,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(item) },
    ],
  });

  const text = response.choices[0]?.message?.content || "";
  return parseAiResponse(text);
}
