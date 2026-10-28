import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createPaperService } from "../../src/lib/paper/service";

test("独立 PostgreSQL 中验证模拟实验闭环", async (t) => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(
    url &&
      new URL(url).hostname === "127.0.0.1" &&
      new URL(url).pathname === "/paper_test",
    "仅允许专用临时测试库",
  );
  const db = new PrismaClient({ datasources: { db: { url } } });
  let now = new Date("2026-10-23T08:00:00Z");
  const paper = createPaperService(db, () => now);
  const importPrices = (rows: string) =>
    paper.importCsv({
      kind: "prices",
      csv: `date,symbol,close,status,source\n${rows}`,
      preview: false,
    });
  try {
    await t.test("预检不写数据，日历重复导入不增加记录且禁止冲突", async () => {
      const csv =
        "date,is_open,source\n2026-10-23,1,合成测试\n2026-10-24,0,合成测试\n2026-10-25,0,合成测试\n2026-10-26,1,合成测试\n2026-10-27,1,合成测试\n2026-10-28,1,合成测试";
      await paper.importCsv({ kind: "calendar", csv, preview: true });
      assert.equal(await db.paperCalendarDay.count(), 0);
      await paper.importCsv({ kind: "calendar", csv });
      await paper.importCsv({ kind: "calendar", csv });
      assert.equal(await db.paperCalendarDay.count(), 6);
      await assert.rejects(
        paper.importCsv({
          kind: "calendar",
          csv: "date,is_open,source\n2026-10-24,1,冲突测试",
        }),
        /日历已锁定/,
      );
    });
    await t.test("初始资金与基准同日起算，账户不能重复创建", async () => {
      await importPrices("2026-10-23,000300,4000,OPEN,合成测试");
      const input = {
        initialCash: "100000",
        startDate: "2026-10-23",
        feeBps: 0,
        minimumFee: "5",
        instruments: [{ symbol: "600000.SH", name: "合成测试标的" }],
      };
      await paper.createAccount(input);
      await assert.rejects(paper.createAccount(input), /已创建/);
      const view = await paper.dashboard();
      assert.equal(view.series[0].equity, "100000.00");
      assert.equal(view.series[0].benchmarkReturn, 0);
    });
    const news = await db.newsItem.create({
      data: {
        title: "合成证据：需独立核实的市场新闻",
        link: "https://example.invalid/paper-evidence",
        source: "合成测试",
        publishedAt: new Date("2026-10-23T05:00:00Z"),
        ingestedAt: new Date("2026-10-23T06:00:00Z"),
        analyzedAt: new Date("2026-10-23T06:05:00Z"),
        summary: "决策当时可见的合成分析摘要",
        sentiment: "Neutral",
        analysisStatus: "success",
        analysisModel: "fixture-model",
        promptVersion: "fixture-v1",
      },
    });
    const decision = {
      kind: "TRADE",
      rationale: "仅用于验证下一交易日成交与不可变证据的合成决策。",
      orders: [{ symbol: "600000.SH", side: "BUY", quantity: 100 }],
      newsIds: [news.id],
    };
    await t.test("盘中或伪造历史日期的决策被拒绝", async () => {
      now = new Date("2026-10-23T06:59:00Z");
      await assert.rejects(paper.submitDecision(decision), /收盘后/);
      now = new Date("2026-10-23T08:00:00Z");
      await assert.rejects(
        paper.submitDecision({ ...decision, date: "2026-10-22" }),
      );
    });
    await t.test("并发重复提交只产生一份决策，修改内容不能覆盖", async () => {
      await Promise.all([
        paper.submitDecision(decision),
        paper.submitDecision(decision),
      ]);
      assert.equal(await db.paperDecision.count(), 1);
      await assert.rejects(
        paper.submitDecision({
          ...decision,
          rationale: "尝试修改当天已经锁定的历史决策内容。",
        }),
        /已经锁定/,
      );
      const saved = await db.paperDecision.findFirstOrThrow();
      assert.match(JSON.stringify(saved.context), /100000.00/);
    });
    await t.test(
      "未来行情被拒绝；缺少执行日价格暂停结算，账户不会先扣款",
      async () => {
        await assert.rejects(
          importPrices("2026-10-26,000300,4200,OPEN,合成测试"),
          /未来收盘价/,
        );
        now = new Date("2026-10-26T08:00:00Z");
        await importPrices("2026-10-26,000300,4200,OPEN,合成测试");
        const result = await paper.settle();
        assert.match(result.issues.join(), /600000.SH/);
        assert.equal(await db.paperTrade.count(), 0);
        await assert.rejects(
          paper.submitDecision({
            kind: "HOLD",
            rationale: "未核对当天持仓之前不能锁定新的决策。",
            orders: [],
            newsIds: [],
          }),
          /当天结算/,
        );
      },
    );
    await t.test("跨周末成交正确扣费，并发结算不重复成交", async () => {
      await importPrices("2026-10-26,600000.SH,10,OPEN,合成测试");
      await Promise.all([paper.settle(), paper.settle()]);
      assert.equal(await db.paperTrade.count(), 1);
      const view = await paper.dashboard(),
        latest = view.series.at(-1)!;
      assert.equal(latest.cash, "98995.00");
      assert.equal(latest.equity, "99995.00");
      assert.ok(Math.abs(latest.benchmarkReturn - 0.05) < 1e-10);
    });
    await t.test("新闻重分析不能改变已锁定证据", async () => {
      await db.newsItem.updateMany({
        data: {
          summary: null,
          sentiment: null,
          analyzedAt: null,
          analysisStatus: "pending",
        },
      });
      const saved = await db.paperDecision.findFirstOrThrow();
      assert.match(
        JSON.stringify(saved.evidence),
        /决策当时可见的合成分析摘要/,
      );
      assert.match(JSON.stringify(saved.evidence), /fixture-v1/);
    });
    await t.test("行情修订新增估值版本，不改写成交价格", async () => {
      await importPrices("2026-10-26,600000.SH,11,OPEN,合成修正测试");
      assert.equal(
        (await db.paperTrade.findFirstOrThrow()).price.toFixed(4),
        "10.0000",
      );
      assert.equal(
        await db.paperSnapshot.count({ where: { tradeDate: "2026-10-26" } }),
        2,
      );
      assert.equal(
        (await paper.dashboard()).series.at(-1)!.equity,
        "100095.00",
      );
    });
    await paper.submitDecision({
      kind: "HOLD",
      rationale: "合成测试选择保持当前持仓，验证不产生新订单。",
      orders: [],
      newsIds: [],
    });
    await t.test(
      "不交易仍有每日净值，未记录日期如实标出，回撤由历史高点计算",
      async () => {
        now = new Date("2026-10-27T08:00:00Z");
        await importPrices(
          "2026-10-27,000300,4100,OPEN,合成测试\n2026-10-27,600000.SH,9,OPEN,合成测试",
        );
        await paper.settle();
        const last = (await paper.dashboard()).series.at(-1)!;
        assert.equal(last.missingDecision, true);
        assert.equal(last.equity, "99895.00");
        assert.ok(
          Math.abs(last.maximumDrawdown - (1 - 99895 / 100095)) < 1e-10,
        );
      },
    );
    await t.test("分红事件可审计且请求幂等，历史估值重算", async () => {
      const event = {
        requestId: randomUUID(),
        date: "2026-10-27",
        symbol: "600000.SH",
        kind: "DIVIDEND",
        cash: "10",
        quantity: 0,
        source: "合成权益来源",
        reason: "合成测试已核对本账户应得净现金红利。",
        confirmed: true,
      };
      await Promise.all([
        paper.addAdjustment(event),
        paper.addAdjustment(event),
      ]);
      assert.equal(await db.paperAdjustment.count(), 1);
      const last = (await paper.dashboard()).series.at(-1)!;
      assert.equal(last.cash, "99005.00");
      assert.equal(last.equity, "99905.00");
    });
    await paper.submitDecision({
      kind: "TRADE",
      rationale: "合成测试计划下一交易日卖出，验证停牌时不模拟成交。",
      orders: [{ symbol: "600000.SH", side: "SELL", quantity: 100 }],
      newsIds: [],
    });
    await t.test("停牌估值明确标记，但不生成虚假卖出", async () => {
      now = new Date("2026-10-28T08:00:00Z");
      await importPrices(
        "2026-10-28,000300,4120,OPEN,合成测试\n2026-10-28,600000.SH,9,HALTED,合成停牌估值来源",
      );
      const result = await paper.settle();
      assert.equal(result.rejected.length, 1);
      assert.equal(await db.paperTrade.count(), 1);
      assert.match(
        JSON.stringify((await paper.dashboard()).holdings),
        /"stale":true/,
      );
    });
    await t.test("导出包含全部证据和修订；数据库约束阻止负资产", async () => {
      const exported = await paper.exportData();
      assert.equal(exported.format, "marketsignal-paper-v1");
      assert.ok(exported.snapshots.length > 4);
      await assert.rejects(
        db.$executeRaw`UPDATE "PaperAccount" SET "initialCash" = -1 WHERE id = 'primary'`,
      );
      assert.equal(
        (
          await db.paperAccount.findUniqueOrThrow({ where: { id: "primary" } })
        ).initialCash.toFixed(2),
        "100000.00",
      );
    });
  } finally {
    await db.$disconnect();
  }
});
