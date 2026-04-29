import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sampleNews = [
  {
    title: "Federal Reserve Signals Potential Rate Cut in September After Inflation Cools to 2.4%",
    link: "https://example.com/fed-rate-cut-september",
    source: "Reuters",
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    contentSnippet:
      "Federal Reserve Chair indicated that a September rate cut is on the table after the latest CPI report showed inflation easing to 2.4%, below expectations. Markets rallied on the news with the S&P 500 gaining 1.2% in afternoon trading. Treasury yields fell to their lowest level in three months.",
    summary:
      "Fed signals potential rate cut in September following cooler-than-expected inflation data at 2.4%. Markets rally with S&P 500 up 1.2% and Treasury yields dropping to three-month lows. Dovish pivot could fuel broad market rally in coming weeks.",
    sentiment: "Bullish",
    impactSectors: JSON.stringify(["Technology", "Financials", "Real Estate"]),
    actionableAdvice:
      "Consider adding exposure to rate-sensitive sectors like Real Estate and Technology ahead of the anticipated September rate cut cycle.",
    analyzedAt: new Date(),
  },
  {
    title: "NVIDIA Reports Record Q2 Revenue, Data Center Sales Surge 154% Year-over-Year",
    link: "https://example.com/nvidia-q2-record",
    source: "CNBC",
    publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    contentSnippet:
      "NVIDIA reported Q2 earnings that blew past Wall Street estimates with record revenue of $35.1 billion, driven by a 154% surge in data center sales. The company raised its Q3 guidance above consensus, citing insatiable demand for its H200 and upcoming Blackwell GPUs. Shares rose 8% in after-hours trading.",
    summary:
      "NVIDIA posts record Q2 revenue of $35.1B with data center sales surging 154% YoY. Raises Q3 guidance above consensus on strong AI chip demand. Stock jumps 8% after hours, reinforcing AI sector momentum.",
    sentiment: "Bullish",
    impactSectors: JSON.stringify(["Technology"]),
    actionableAdvice:
      "NVIDIA's blowout results and guidance raise confirm AI infrastructure spending cycle remains robust — consider maintaining or increasing semiconductor exposure.",
    analyzedAt: new Date(),
  },
  {
    title: "China Imposes Export Restrictions on Rare Earth Minerals, Escalating Trade Tensions",
    link: "https://example.com/china-rare-earth-restrictions",
    source: "Bloomberg",
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    contentSnippet:
      "China announced new export restrictions on gallium and germanium, critical minerals used in semiconductor and defense applications. The move escalates ongoing trade tensions and could disrupt global supply chains for advanced electronics. Mining stocks with non-China rare earth exposure rallied sharply.",
    summary:
      "China restricts exports of critical minerals gallium and germanium, escalating trade tensions. Move threatens semiconductor and defense supply chains. Non-China rare earth miners rally on expected supply tightness.",
    sentiment: "Bearish",
    impactSectors: JSON.stringify(["Technology", "Materials", "Industrials"]),
    actionableAdvice:
      "Supply chain disruption risk elevated for semiconductor manufacturers dependent on Chinese rare earths — consider hedging via non-China mining companies.",
    analyzedAt: new Date(),
  },
  {
    title: "JPMorgan Beats Q2 Profit Estimates as Investment Banking Revenue Rebounds 52%",
    link: "https://example.com/jpmorgan-q2-beat",
    source: "MarketWatch",
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    contentSnippet:
      "JPMorgan Chase reported Q2 earnings that beat analyst expectations, driven by a 52% surge in investment banking revenue. CEO Jamie Dimon noted improving M&A activity and capital markets conditions. However, the bank increased its provision for credit losses by $1.2 billion, citing consumer loan deterioration.",
    summary:
      "JPMorgan beats Q2 estimates on 52% investment banking revenue surge. M&A activity improving. Offset by $1.2B increase in credit loss provisions on consumer loan concerns. Mixed signal for banking sector.",
    sentiment: "Bullish",
    impactSectors: JSON.stringify(["Financials"]),
    actionableAdvice:
      "Investment banking recovery is a positive signal for major Wall Street banks, but watch consumer credit quality — consider large-cap banks with diversified revenue over regional lenders.",
    analyzedAt: new Date(),
  },
  {
    title: "Oil Prices Drop 4% as OPEC+ Signals Production Increase Starting October",
    link: "https://example.com/oil-prices-drop-opec",
    source: "Reuters",
    publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    contentSnippet:
      "Crude oil prices fell 4% to $72 per barrel after OPEC+ members signaled plans to begin unwinding voluntary production cuts starting in October. The decision comes despite softening demand from China. Energy stocks led sector losses with the XLE ETF dropping 3.2%.",
    summary:
      "Oil prices plunge 4% to $72/bbl as OPEC+ plans to unwind production cuts from October despite weak Chinese demand. Energy sector ETF XLE drops 3.2%, leading market losses.",
    sentiment: "Bearish",
    impactSectors: JSON.stringify(["Energy"]),
    actionableAdvice:
      "OPEC+ supply increase combined with soft demand creates headwinds for oil prices — consider reducing energy sector exposure, especially E&P companies with high breakeven costs.",
    analyzedAt: new Date(),
  },
  {
    title: "Apple Unveils New AI-Powered iPhone Features at WWDC, Analysts See Upgrade Supercycle",
    link: "https://example.com/apple-ai-iphone-features",
    source: "CNBC",
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    contentSnippet:
      "Apple showcased a suite of AI features for the upcoming iPhone 18 at WWDC, including on-device large language models and enhanced Siri capabilities. Analysts at Morgan Stanley and Goldman Sachs predicted the AI integration could trigger a major upgrade supercycle, with estimates of 250 million units sold in FY2026.",
    summary:
      "Apple reveals AI-powered iPhone features at WWDC, prompting analysts to forecast an upgrade supercycle with 250M unit potential. On-device LLM integration could be a significant catalyst for Apple's consumer ecosystem.",
    sentiment: "Bullish",
    impactSectors: JSON.stringify(["Technology", "Consumer Discretionary"]),
    actionableAdvice:
      "Apple's AI-driven upgrade cycle thesis gaining momentum — consider building positions ahead of the iPhone 18 launch cycle. Suppliers in Apple's ecosystem may also benefit.",
    analyzedAt: new Date(),
  },
  {
    title: "Treasury Yield Curve Uninverts After 26 Months, Raising Recession Debate",
    link: "https://example.com/yield-curve-uninverts",
    source: "Bloomberg",
    publishedAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
    contentSnippet:
      "The 2-year/10-year Treasury yield curve has uninverted after 26 consecutive months, historically a signal that precedes recessions. Economists are divided on whether this time is different given the unusual post-pandemic economic cycle. The S&P 500 showed muted reaction, closing flat.",
    summary:
      "Treasury yield curve uninverts after 26 months, historically a recession precursor. Economists divided on interpretation given post-pandemic dynamics. Market reaction muted with S&P 500 flat.",
    sentiment: "Neutral",
    impactSectors: JSON.stringify(["Financials", "Real Estate"]),
    actionableAdvice:
      "Yield curve normalization is worth monitoring but the unusual economic backdrop reduces its predictive power — maintain neutral positioning until clearer recession signals emerge.",
    analyzedAt: new Date(),
  },
  {
    title: "European Central Bank Holds Rates Steady, Lagarde Warns of Sticky Services Inflation",
    link: "https://example.com/ecb-holds-rates",
    source: "Reuters",
    publishedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
    contentSnippet:
      "The ECB kept interest rates unchanged at 3.75% as widely expected, but President Lagarde warned that services inflation remains stubbornly high at 4.1%. Markets now price in only one more rate cut in 2025, down from two previously. The euro strengthened 0.4% against the dollar.",
    summary:
      "ECB holds rates at 3.75% with Lagarde highlighting sticky services inflation at 4.1%. Markets reduce 2025 rate cut expectations from two to one. Euro strengthens 0.4% vs USD.",
    sentiment: "Neutral",
    impactSectors: JSON.stringify(["Financials"]),
    actionableAdvice: null,
    analyzedAt: new Date(),
  },
  {
    title: "Startup raises $5M seed round for AI-powered pet food delivery app",
    link: "https://example.com/pet-food-startup",
    source: "Yahoo Finance",
    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    contentSnippet: "A small startup announced a seed funding round for its pet food delivery app that uses AI to recommend meals for dogs and cats.",
    summary: "",
    sentiment: null,
    impactSectors: JSON.stringify([]),
    actionableAdvice: null,
    analyzedAt: null,
  },
  {
    title: "Weekly Market Roundup: Stocks Mixed as Investors Digest Earnings and Economic Data",
    link: "https://example.com/weekly-roundup-mixed",
    source: "MarketWatch",
    publishedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    contentSnippet: "A look back at this week's market action...",
    summary: "",
    sentiment: null,
    impactSectors: JSON.stringify([]),
    actionableAdvice: null,
    analyzedAt: null,
  },
];

async function main() {
  console.log("Seeding database...");

  for (const news of sampleNews) {
    await prisma.newsItem.upsert({
      where: { link: news.link },
      create: news,
      update: {},
    });
  }

  console.log(`Seeded ${sampleNews.length} news items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
