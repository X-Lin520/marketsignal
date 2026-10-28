import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  addDay,
  calendarRange,
  shanghaiClock,
} from "../../src/lib/paper/calendar";

test("运行站点的访问保护、导入、结算和导出", async (t) => {
  const origin = process.env.TEST_ORIGIN!,
    password = process.env.TEST_LOGIN_PASSWORD!;
  assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
  assert.equal(new URL(process.env.TEST_DATABASE_URL!).pathname, "/paper_test");
  const db = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL! } },
  });
  let cookie = "";
  const request = (
    path: string,
    body?: unknown,
    extra: Record<string, string> = {},
  ) =>
    fetch(origin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const current = shanghaiClock(),
    end = current.completedDate,
    start = addDay(end, -2);
  try {
    await t.test(
      "未登录无法读取或写入，跨站登录拒绝，Cron GET 存在且需鉴权",
      async () => {
        assert.equal((await request("/api/paper/dashboard")).status, 401);
        assert.equal((await request("/api/paper/account", {})).status, 401);
        assert.equal(
          (
            await request(
              "/api/paper/session",
              { password },
              { Origin: "https://example.invalid" },
            )
          ).status,
          403,
        );
        assert.equal((await request("/api/cron/ingest")).status, 401);
        const html = await (await fetch(origin + "/paper")).text();
        assert.match(html, /实验区登录口令/);
      },
    );
    await t.test(
      "登录建立 HttpOnly 会话，Cookie 不能跨站用于写入",
      async () => {
        const response = await request("/api/paper/session", { password });
        assert.equal(response.status, 200);
        const header = response.headers.get("set-cookie")!;
        assert.match(header, /HttpOnly/i);
        assert.match(header, /SameSite=strict/i);
        cookie = header.split(";")[0];
        assert.equal((await request("/api/paper/dashboard")).status, 200);
        assert.equal(
          (
            await request(
              "/api/paper/import",
              {},
              { Origin: "https://example.invalid" },
            )
          ).status,
          403,
        );
      },
    );
    await t.test("CSV 预检和错误导入不会写入半批数据", async () => {
      const rows = calendarRange(start, current.date)
        .map((date) => `${date},1,合成HTTP测试日历`)
        .join("\n");
      const csv = `date,is_open,source\n${rows}`;
      assert.equal(
        (
          await request("/api/paper/import", {
            kind: "calendar",
            csv,
            preview: true,
          })
        ).status,
        200,
      );
      assert.equal(await db.paperCalendarDay.count(), 0);
      assert.equal(
        (await request("/api/paper/import", { kind: "calendar", csv })).status,
        200,
      );
      const invalid = `date,symbol,close,status,source\n${start},000300,4000,OPEN,合成测试\n${start},600000.SH,0,OPEN,合成测试`;
      assert.equal(
        (await request("/api/paper/import", { kind: "prices", csv: invalid }))
          .status,
        400,
      );
      assert.equal(await db.paperPrice.count(), 0);
    });
    await t.test(
      "经真实接口创建账户并从前一日指令结算，重复请求只成交一次",
      async () => {
        const rows = calendarRange(start, end).flatMap((date, i) => [
          `${date},000300,${4000 + i * 100},OPEN,合成HTTP测试`,
          `${date},600000.SH,10,OPEN,合成HTTP测试`,
        ]);
        assert.equal(
          (
            await request("/api/paper/import", {
              kind: "prices",
              csv: "date,symbol,close,status,source\n" + rows.join("\n"),
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("/api/paper/account", {
              initialCash: "100000",
              startDate: start,
              feeBps: 0,
              minimumFee: "5",
              instruments: [{ symbol: "600000.SH", name: "合成HTTP测试标的" }],
            })
          ).status,
          200,
        );
        // 历史指令只作为测试夹具写入专用临时库；正式接口禁止回填决策日期。
        await db.paperDecision.create({
          data: {
            accountId: "primary",
            decisionDate: start,
            submittedAt: new Date(start + "T08:00:00Z"),
            kind: "TRADE",
            rationale: "合成HTTP测试历史夹具，仅在临时库验证执行接口。",
            evidence: [],
            context: { syntheticFixture: true },
            inputDigest: "http-fixture",
            orders: {
              create: { symbol: "600000.SH", side: "BUY", quantity: 100 },
            },
          },
        });
        for (let i = 0; i < 2; i++)
          assert.equal(
            (await request("/api/paper/settle", { through: end })).status,
            200,
          );
        assert.equal(await db.paperTrade.count(), 1);
        const view = await (await request("/api/paper/dashboard")).json();
        assert.equal(view.series.at(-1).cash, "98995.00");
        assert.equal(view.holdings[0].quantity, 100);
        assert.equal(
          (
            await request("/api/paper/settle", {
              through: addDay(current.date),
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "已登录页面包含账户和绩效，未登录 HTML 不包含私有标的",
      async () => {
        const page = await request("/paper");
        assert.equal(page.status, 200);
        const html = await page.text();
        for (const text of [
          "账户概览",
          "每日决策",
          "行情与日历",
          "流水与导出",
          "最大回撤",
          "合成HTTP测试标的",
        ])
          assert.ok(html.includes(text), `页面缺少 ${text}`);
        const publicHtml = await (await fetch(origin + "/paper")).text();
        assert.ok(!publicHtml.includes("合成HTTP测试标的"));
        const styles = [
          ...html.matchAll(/href="([^\"]+\.css(?:\?[^\"]*)?)"/g),
        ].map((m) => m[1].replace(/&amp;/g, "&"));
        assert.ok(styles.length > 0);
        for (const path of new Set(styles))
          assert.equal((await fetch(new URL(path, origin))).status, 200);
      },
    );
    await t.test("分析关闭不伪造中性成功，重置不会破坏决策", async () => {
      const item = await db.newsItem.create({
        data: {
          title: "合成HTTP分析状态测试",
          link: "https://example.invalid/http-news",
          source: "合成测试",
          publishedAt: new Date(start + "T01:00:00Z"),
        },
      });
      const response = await request("/api/analyze", { newsId: item.id });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.status, "disabled");
      assert.equal(body.item.analyzedAt, null);
      assert.equal(body.item.sentiment, null);
      assert.equal((await request("/api/reset-analysis", {})).status, 200);
      assert.equal(await db.paperDecision.count(), 1);
    });
    await t.test(
      "每日决策只能写当天；可写时间取决于服务器上海时钟",
      async () => {
        if (current.afterClose)
          assert.equal(
            (
              await request("/api/paper/decisions", {
                kind: "HOLD",
                rationale: "合成HTTP测试确认当天持仓后继续持有。",
                orders: [],
                newsIds: [],
              })
            ).status,
            200,
          );
        else
          assert.equal(
            (
              await request("/api/paper/decisions", {
                kind: "HOLD",
                rationale: "合成HTTP测试收盘之前不允许锁定决策。",
                orders: [],
                newsIds: [],
              })
            ).status,
            400,
          );
        assert.equal(
          (
            await request("/api/paper/decisions", {
              date: start,
              kind: "HOLD",
              rationale: "合成HTTP测试禁止伪造历史决策日期。",
              orders: [],
              newsIds: [],
            })
          ).status,
          400,
        );
      },
    );
    await t.test("完整导出受会话保护，Cron 结算鉴权生效", async () => {
      const exported = await request("/api/paper/export");
      assert.equal(exported.status, 200);
      assert.match(exported.headers.get("content-disposition")!, /attachment/);
      const content = await exported.json();
      assert.equal(content.trades.length, 1);
      assert.ok(content.snapshots.length >= 3);
      assert.equal(
        (
          await request("/api/cron/paper", undefined, {
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          })
        ).status,
        200,
      );
      const logout = await fetch(origin + "/api/paper/session", {
        method: "DELETE",
        headers: { Cookie: cookie, Origin: origin },
      });
      assert.equal(logout.status, 200);
      assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/i);
    });
  } finally {
    await db.$disconnect();
  }
});
