import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

async function main() {
  if (
    process.env.ENABLE_AI !== "true" ||
    !process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY.endsWith("...")
  )
    throw new Error("请先在服务端启用并配置 AI 分析");
  const { prisma } = await import("../src/lib/db/prisma");
  const { analyzeRecord } = await import("../src/lib/ai/pipeline");
  try {
    const records = await prisma.newsItem.findMany({
      orderBy: { publishedAt: "asc" },
    });
    const summary = { success: 0, failed: 0, disabled: 0 };
    for (let i = 0; i < records.length; i += 5) {
      const results = await Promise.all(
        records.slice(i, i + 5).map(analyzeRecord),
      );
      for (const status of results) summary[status]++;
    }
    console.log("新闻重新分析完成（已保存的决策证据不会改变）", summary);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("重新分析未完成，请检查服务端配置和数据库连接");
  process.exitCode = 1;
});
