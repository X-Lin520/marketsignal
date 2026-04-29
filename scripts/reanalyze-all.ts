/**
 * Batch re-analyze all existing news items with the current AI prompt.
 * Usage: npx tsx scripts/reanalyze-all.ts
 */

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

// --- Copy of AI client logic (avoid Next.js import issues in script) ---
const SYSTEM_PROMPT = `You are a senior financial markets analyst at a top-tier hedge fund. Your analysis is read by professional traders who need actionable intelligence, not vague generalities. Be opinionated, specific, and commercially useful.

You will receive a news article (title + snippet). You MUST respond with ONLY a valid JSON object and nothing else. Do not include markdown code fences, explanations, or any text outside the JSON.

The JSON object MUST have exactly these four fields:

1. "summary": A sharp 2-3 sentence summary focused on WHAT the news means for markets.
   Include the key numbers, names, and directional impact. Bloomberg-terminal style.

2. "sentiment": One of "Bullish", "Bearish", or "Neutral".
   Judge the EXPECTED short-term (1-5 trading day) market impact:
   - "Bullish": Drives prices UP (earnings beats, dovish central banks, M&A deals,
     regulatory easing, strong macro data, product launches, analyst upgrades).
   - "Bearish": Drives prices DOWN (earnings misses, hawkish policy, geopolitical risk,
     recession signals, supply chain disruption, negative guidance, regulatory crackdowns).
   - "Neutral": ONLY when there is genuinely no directional market impact. Default to
     Bullish or Bearish if you can infer any directional signal — be opinionated.

3. "impactSectors": An array of strings naming sectors affected, from this list:
   Technology, Financials, Healthcare, Energy, Consumer Discretionary,
   Consumer Staples, Industrials, Materials, Utilities, Real Estate,
   Communication Services.
   ALWAYS include at least 1 sector. Identify 2-3 wherever possible.
   If the news is about a specific company, include its sector(s).

4. "actionableAdvice": One specific, concrete sentence a trader could act on today.
   Examples of good advice:
   - "Buy large-cap US tech ETFs on this dip with a 2-week hold."
   - "Reduce regional bank exposure ahead of potential regulatory action."
   - "Hedge energy longs with put spreads through month-end."
   Be direct and specific. NEVER return null — always provide at least a directional
   observation phrased as advice. Include a timeframe or specific action where possible.

KEY PRINCIPLES:
- Be opinionated. Traders can ignore your advice, but they can't act on silence.
- When the snippet is vague, INFER from context. Use the source, headline framing,
  and market conventions to fill gaps.
- Err on the side of Bullish or Bearish over Neutral. Only truly routine administrative
  news (e.g., "markets closed for holiday") deserves Neutral.
- Think about second-order effects: a tech earnings beat affects semiconductor suppliers;
  oil price moves affect airline margins; rate decisions affect real estate.`;

const CONCURRENCY = 5;
const BATCH_DELAY_MS = 500;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "sk-ant-...") {
    console.error("ERROR: ANTHROPIC_API_KEY not configured.");
    process.exit(1);
  }

  if (process.env.ENABLE_AI !== "true") {
    console.error("ERROR: ENABLE_AI is not true. Set ENABLE_AI=true in .env.local");
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey });

  const items = await prisma.newsItem.findMany({
    orderBy: { publishedAt: "desc" },
  });

  console.log(`Found ${items.length} items. Re-analyzing with concurrency ${CONCURRENCY}...\n`);

  let done = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const userMsg = [
          `TITLE: ${item.title}`,
          `SOURCE: ${item.source}`,
          `PUBLISHED: ${item.publishedAt.toISOString()}`,
          `SNIPPET: ${item.contentSnippet || "No snippet available."}`,
          "",
          "Analyze this financial news item and return the JSON.",
        ].join("\n");

        const resp = await anthropic.messages.create({
          model: "claude-sonnet-4-6-20250914",
          max_tokens: 600,
          temperature: 0.1,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        });

        const text = (resp.content[0] as { text: string }).text;
        // Strip markdown fences
        const clean = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, "$1").trim();
        const analysis = JSON.parse(clean);

        await prisma.newsItem.update({
          where: { id: item.id },
          data: {
            summary: analysis.summary,
            sentiment: analysis.sentiment,
            impactSectors: analysis.impactSectors,
            actionableAdvice: analysis.actionableAdvice ?? null,
            analyzedAt: new Date(),
          },
        });

        return { title: item.title.slice(0, 60), sentiment: analysis.sentiment };
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        done++;
        console.log(`[${done}/${items.length}] ${r.value.sentiment.padEnd(8)} | ${r.value.title}`);
      } else {
        failed++;
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        console.error(`[FAIL] ${msg.slice(0, 100)}`);
      }
    }

    if (i + CONCURRENCY < items.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(`\nDone. Analyzed: ${done}, Failed: ${failed}`);

  // Show summary stats
  const [bullish, bearish, neutral] = await Promise.all([
    prisma.newsItem.count({ where: { sentiment: "Bullish" } }),
    prisma.newsItem.count({ where: { sentiment: "Bearish" } }),
    prisma.newsItem.count({ where: { sentiment: "Neutral" } }),
  ]);
  console.log(`Bullish: ${bullish}, Bearish: ${bearish}, Neutral: ${neutral}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
