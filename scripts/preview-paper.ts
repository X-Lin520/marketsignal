import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  addDay,
  calendarRange,
  shanghaiClock,
} from "../src/lib/paper/calendar";
import { createPaperService } from "../src/lib/paper/service";
import {
  command,
  freePort,
  temporaryDatabase,
  waitForServer,
} from "./test-database";

async function main() {
  const database = await temporaryDatabase();
  let server: ReturnType<typeof spawn> | undefined;
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise<void>((resolve) =>
        server!.once("exit", () => resolve()),
      );
    }
    await database.stop();
  };
  process.once("SIGINT", () => {
    void stop().then(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void stop().then(() => process.exit(0));
  });
  try {
    await command(
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      database.env,
    );
    const db = new PrismaClient({ datasources: { db: { url: database.url } } });
    try {
      const real = shanghaiClock(),
        end = real.completedDate,
        start = addDay(end, -3);
      let now = new Date(`${end}T08:30:00Z`);
      const paper = createPaperService(db, () => now);
      const days = calendarRange(start, addDay(real.date, 2));
      await paper.importCsv({
        kind: "calendar",
        csv:
          "date,is_open,source\n" +
          days
            .map((date) => `${date},1,合成演示日历（非真实交易日历）`)
            .join("\n"),
      });
      const values = calendarRange(start, end).flatMap((date, i) => [
        `${date},000300,${4000 + [0, 50, 20, 90][i]},OPEN,合成演示点位（非真实行情）`,
        `${date},600000.SH,${[10, 10.5, 10.1, 10.8][i]},OPEN,合成演示未复权价格`,
        `${date},000001.SZ,${[20, 20.3, 19.8, 20.4][i]},OPEN,合成演示未复权价格`,
      ]);
      await paper.importCsv({
        kind: "prices",
        csv: "date,symbol,close,status,source\n" + values.join("\n"),
      });
      await paper.createAccount({
        initialCash: "100000",
        startDate: start,
        feeBps: 3,
        minimumFee: "5",
        instruments: [
          { symbol: "600000.SH", name: "合成标的 A" },
          { symbol: "000001.SZ", name: "合成标的 B" },
        ],
      });
      const news = await db.newsItem.create({
        data: {
          title: "合成示例：如何把一条新闻留作当日判断的证据",
          link: "https://example.invalid/synthetic-news",
          source: "合成演示",
          publishedAt: new Date(`${start}T01:00:00Z`),
          ingestedAt: new Date(`${start}T01:05:00Z`),
          analyzedAt: new Date(`${start}T01:06:00Z`),
          summary: "这是一条用于展示证据快照的合成摘要，没有真实的市场结论。",
          sentiment: "Neutral",
          analysisStatus: "success",
          analysisModel: "synthetic-demo",
          promptVersion: "demo-v1",
          impactSectors: [],
        },
      });
      now = new Date(`${start}T08:00:00Z`);
      await paper.submitDecision({
        kind: "TRADE",
        rationale:
          "合成演示：以小仓位验证账本和下一交易日收盘成交规则，数据不代表真实证券表现。",
        newsIds: [news.id],
        orders: [
          { symbol: "600000.SH", side: "BUY", quantity: 1000 },
          { symbol: "000001.SZ", side: "BUY", quantity: 500 },
        ],
      });
      now = new Date(`${addDay(start)}T08:00:00Z`);
      await paper.settle();
      await paper.submitDecision({
        kind: "HOLD",
        rationale: "合成演示：继续持有，记录等待而不产生新的交易指令。",
        newsIds: [news.id],
        orders: [],
      });
      now = new Date(`${end}T08:30:00Z`);
      await paper.settle();
    } finally {
      await db.$disconnect();
    }
    const port = await freePort(),
      origin = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        env: {
          ...database.env,
          PAPER_DEMO: "true",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let errors = "";
    server.stderr?.on("data", (data) => {
      errors = (errors + String(data)).slice(-3_000);
    });
    await waitForServer(origin, server);
    console.log(`合成演示已就绪：${origin}/paper`);
    console.log(`临时登录口令（只用于本次演示）：${database.loginPassword}`);
    console.log("所有记录均为合成演示数据，关闭后不保留。Ctrl+C 退出。");
    await new Promise<void>((resolve, reject) =>
      server!.once("exit", (code) =>
        code && !stopping ? reject(new Error(errors)) : resolve(),
      ),
    );
  } finally {
    await stop();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message.replace(
          /postgres(?:ql)?:\/\/[^\s]+/g,
          "[local demo database]",
        )
      : "Preview failed",
  );
  process.exit(1);
});
