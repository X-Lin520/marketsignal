import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  addDay,
  nextTradingDay,
  shanghaiClock,
  validDate,
} from "../../src/lib/paper/calendar";
import { parseCalendar, parsePrices, readCsv } from "../../src/lib/paper/csv";
import { execute, replay, valuePositions } from "../../src/lib/paper/ledger";
import {
  decimal,
  feeCents,
  grossCents,
  money,
} from "../../src/lib/paper/money";
import { performance } from "../../src/lib/paper/performance";
import {
  hashPassword,
  secretEquals,
  signSession,
  verifyPassword,
  verifySession,
} from "../../src/lib/paper/session";
import { parseAiResponse } from "../../src/lib/ai/parser";
import { buildUserMessage } from "../../src/lib/ai/prompt";
import { requireSameOrigin } from "../../src/lib/paper/auth";

test("日期按上海时区判断，15 点之前不能使用当日收盘数据", () => {
  assert.equal(
    shanghaiClock(new Date("2026-10-28T06:59:59Z")).completedDate,
    "2026-10-27",
  );
  assert.equal(
    shanghaiClock(new Date("2026-10-28T07:00:00Z")).afterClose,
    true,
  );
  assert.equal(
    shanghaiClock(new Date("2026-10-28T16:00:00Z")).date,
    "2026-10-29",
  );
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(addDay("2028-02-28"), "2028-02-29");
});

test("下一交易日跨过已确认休市日，但不猜测缺失日历", () => {
  const calendar = new Map([
    ["2026-10-24", false],
    ["2026-10-25", false],
    ["2026-10-26", true],
  ]);
  assert.equal(nextTradingDay("2026-10-23", calendar), "2026-10-26");
  calendar.delete("2026-10-25");
  assert.equal(nextTradingDay("2026-10-23", calendar), null);
});

test("CSV 支持 BOM、引号、逗号与 CRLF，损坏数据整体拒绝", () => {
  assert.equal(
    parsePrices(
      '\uFEFFdate,symbol,close,status,source\r\n2026-10-23,000300,4000,OPEN,"核实来源,人工"\r\n',
    )[0].source,
    "核实来源,人工",
  );
  assert.equal(readCsv('a,b\n"换\n行",值')[0].a, "换\n行");
  for (const csv of ["a,a\n1,2", "a,b\n1", 'a,b\n"1,2', 'a,b\n"1"x,2'])
    assert.throws(() => readCsv(csv));
  assert.throws(() =>
    parsePrices(
      "date,symbol,close,status,source\n2026-10-23,000300,0,OPEN,已核实",
    ),
  );
  assert.throws(() =>
    parsePrices(
      "date,symbol,close,status,source\n2026-10-23,000300,4000,OPEN,已核实\n2026-10-23,000300,4001,OPEN,已核实",
    ),
  );
  assert.throws(() =>
    parseCalendar("date,is_open,source\n2026-10-23,true,已核实"),
  );
});

test("金额按整数分计算，拒绝指数写法、多余小数和非法金额", () => {
  assert.equal(money("100000.01"), 10_000_001n);
  assert.equal(grossCents("10.0050", 101), 101_051n);
  assert.equal(feeCents(100_000n, 3, "5"), 500n);
  assert.equal(decimal(99_995n), "999.95");
  for (const value of ["-1", "NaN", "Infinity", "1e6", "0.001"])
    assert.throws(() => money(value));
});

test("买入和卖出扣减费用；现金与可卖数量不足不会成交", () => {
  const state = { cash: money("100000"), positions: {} };
  assert.equal(
    execute(
      state,
      { symbol: "600000.SH", side: "BUY", quantity: 100 },
      { close: "10", status: "OPEN" },
      { bps: 0, minimum: "5" },
    ).filled,
    true,
  );
  assert.equal(state.cash, money("98995"));
  assert.equal(
    execute(
      state,
      { symbol: "600000.SH", side: "SELL", quantity: 200 },
      { close: "10", status: "OPEN" },
      { bps: 0, minimum: "5" },
    ).filled,
    false,
  );
  assert.equal(
    execute(
      state,
      { symbol: "600000.SH", side: "BUY", quantity: 100_000 },
      { close: "10", status: "OPEN" },
      { bps: 0, minimum: "5" },
    ).filled,
    false,
  );
  assert.equal(
    execute(
      state,
      { symbol: "600000.SH", side: "SELL", quantity: 100 },
      { close: "11", status: "OPEN" },
      { bps: 0, minimum: "5" },
    ).filled,
    true,
  );
  assert.equal(state.cash, money("100090"));
});

test("停牌与涨跌停保守地不成交，零股只能一次卖清", () => {
  const state = { cash: money("100"), positions: { "600000.SH": 105 } };
  for (const status of ["HALTED", "LIMIT_UP", "LIMIT_DOWN"] as const)
    assert.equal(
      execute(
        state,
        { symbol: "600000.SH", side: "SELL", quantity: 105 },
        { close: "10", status },
        { bps: 0, minimum: "0" },
      ).filled,
      false,
    );
  assert.equal(
    execute(
      state,
      { symbol: "600000.SH", side: "SELL", quantity: 5 },
      { close: "10", status: "OPEN" },
      { bps: 0, minimum: "0" },
    ).filled,
    false,
  );
  assert.equal(
    execute(
      state,
      { symbol: "600000.SH", side: "SELL", quantity: 105 },
      { close: "10", status: "OPEN" },
      { bps: 0, minimum: "0" },
    ).filled,
    true,
  );
});

test("账本从成交与公司行为推导，缺持仓价格不能伪造估值", () => {
  const state = replay(
    "100000",
    [
      {
        id: "t",
        date: "2026-10-26",
        symbol: "600000.SH",
        side: "BUY",
        quantity: 100,
        gross: "1000",
        fee: "5",
      },
    ],
    [
      {
        id: "a",
        date: "2026-10-27",
        symbol: "600000.SH",
        cash: "10",
        quantity: 5,
      },
    ],
    "2026-10-27",
  );
  assert.equal(state.cash, money("99005"));
  assert.throws(() => valuePositions(state, new Map()));
  const value = valuePositions(
    state,
    new Map([["600000.SH", { close: "10", status: "HALTED" }]]),
  );
  assert.equal(value.equity, "100055.00");
  assert.equal(value.holdings[0].stale, true);
});

test("累计收益、基准、超额收益和回撤包括初始高点", () => {
  const values = ["100000", "110000", "99000"].map((equity, i) => ({
    date: `2026-10-${23 + i}`,
    equity,
    benchmark: ["4000", "4200", "4100"][i],
    cash: "0",
    marketValue: equity,
    revision: 1,
    missingDecision: false,
  }));
  const result = performance(values, "100000").at(-1)!;
  assert.ok(Math.abs(result.cumulativeReturn + 0.01) < 1e-10);
  assert.ok(Math.abs(result.benchmarkReturn - 0.025) < 1e-10);
  assert.ok(Math.abs(result.excessReturn + 0.035) < 1e-10);
  assert.ok(Math.abs(result.maximumDrawdown - 0.1) < 1e-10);
});

test("会话不能伪造、过期或在更换密钥后继续使用", () => {
  const password = randomBytes(24).toString("hex"),
    secret = randomBytes(32).toString("hex"),
    now = Date.parse("2026-10-28T08:00:00Z");
  const hash = hashPassword(password);
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword(password + "x", hash), false);
  const session = signSession(secret, now);
  assert.equal(verifySession(session, secret, now), true);
  assert.equal(verifySession(session + "x", secret, now), false);
  assert.equal(
    verifySession(session, secret, now + 13 * 60 * 60 * 1000),
    false,
  );
  assert.equal(
    verifySession(session, randomBytes(32).toString("hex"), now),
    false,
  );
  assert.equal(secretEquals(secret, secret), true);
  assert.equal(secretEquals("", secret), false);
});

test("内部 localhost 地址不误拒实际 Host；跨站、缺 Host 或伪造主机仍拒绝", () => {
  const request = (host: string, origin: string) =>
    new Request("http://localhost:3000/api/paper/session", {
      headers: { Host: host, Origin: origin },
    });
  assert.doesNotThrow(() =>
    requireSameOrigin(request("127.0.0.1:3000", "http://127.0.0.1:3000")),
  );
  assert.throws(() =>
    requireSameOrigin(request("127.0.0.1:3000", "https://example.invalid")),
  );
  assert.throws(() =>
    requireSameOrigin(request("victim.test@evil.test", "http://evil.test")),
  );
  assert.throws(() =>
    requireSameOrigin(
      new Request("http://localhost:3000/api/paper/session", {
        headers: { Origin: "http://localhost:3000" },
      }),
    ),
  );
});

test("AI 解析失败不会被当作中性成功，输入保留真实发布时间", () => {
  assert.throws(
    () => parseAiResponse("invalid model response"),
    /AI_RESPONSE_INVALID/,
  );
  const message = buildUserMessage({
    title: "测试新闻",
    link: "https://example.invalid",
    source: "测试",
    publishedAt: new Date("2026-10-23T01:00:00Z"),
    contentSnippet: null,
  });
  assert.match(message, /PUBLISHED: 2026-10-23T01:00:00.000Z/);
});
