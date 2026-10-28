import { createHash } from "node:crypto";
import { Prisma, PrismaClient, type PaperAccount } from "@prisma/client";
import { z } from "zod";
import {
  addDay,
  calendarRange,
  nextTradingDay,
  shanghaiClock,
  validDate,
} from "./calendar";
import {
  BENCHMARK,
  isStockSymbol,
  parseCalendar,
  parsePrices,
  type PriceStatus,
} from "./csv";
import { check } from "./errors";
import {
  execute,
  replay,
  valuePositions,
  type Adjustment,
  type Trade,
} from "./ledger";
import { decimal, money } from "./money";
import { performance } from "./performance";

type Tx = Prisma.TransactionClient;
const dateSchema = z.string().refine(validDate, "日期必须为有效的 YYYY-MM-DD");
const orderSchema = z
  .object({
    symbol: z.string(),
    side: z.enum(["BUY", "SELL"]),
    quantity: z.number().int().min(1).max(1_000_000),
  })
  .strict();
const decisionSchema = z
  .object({
    kind: z.enum(["TRADE", "HOLD", "CASH"]),
    rationale: z.string().trim().min(10, "请至少填写 10 字决策理由").max(2_000),
    orders: z.array(orderSchema).max(10),
    newsIds: z.array(z.string().max(100)).max(20),
  })
  .strict();
const accountSchema = z
  .object({
    initialCash: z.string(),
    startDate: dateSchema,
    feeBps: z.number().int().min(0).max(500),
    minimumFee: z.string(),
    instruments: z
      .array(
        z
          .object({
            symbol: z.string(),
            name: z.string().trim().min(1).max(60),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();
const importSchema = z
  .object({
    kind: z.enum(["calendar", "prices"]),
    csv: z.string(),
    preview: z.boolean().default(false),
  })
  .strict();
const adjustmentSchema = z
  .object({
    requestId: z.string().uuid(),
    date: dateSchema,
    symbol: z.string(),
    kind: z.enum(["DIVIDEND", "BONUS"]),
    cash: z.string(),
    quantity: z.number().int().min(0).max(1_000_000),
    source: z.string().trim().min(2).max(200),
    reason: z.string().trim().min(10).max(1_000),
    confirmed: z.literal(true),
  })
  .strict();
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const quoteKey = (date: string, symbol: string) => `${date}/${symbol}`;

async function loadData(tx: Tx) {
  const [calendar, prices, trades, adjustments, decisions] = await Promise.all([
    tx.paperCalendarDay.findMany({ orderBy: { date: "asc" } }),
    tx.paperPrice.findMany({
      orderBy: { revision: "desc" },
      distinct: ["symbol", "tradeDate"],
    }),
    tx.paperTrade.findMany({ orderBy: [{ tradeDate: "asc" }, { id: "asc" }] }),
    tx.paperAdjustment.findMany({
      orderBy: [{ eventDate: "asc" }, { id: "asc" }],
    }),
    tx.paperDecision.findMany({
      include: { orders: true },
      orderBy: { decisionDate: "asc" },
    }),
  ]);
  return {
    calendar: new Map(calendar.map((day) => [day.date, day.isOpen])),
    prices: new Map(
      prices.map((p) => [
        quoteKey(p.tradeDate, p.symbol),
        {
          id: p.id,
          close: p.close.toFixed(4),
          status: p.status as PriceStatus,
          source: p.source,
          revision: p.revision,
        },
      ]),
    ),
    trades: trades.map((t) => ({
      id: t.id,
      date: t.tradeDate,
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      gross: t.gross.toFixed(2),
      fee: t.fee.toFixed(2),
    })) as Trade[],
    adjustments: adjustments.map((a) => ({
      id: a.id,
      date: a.eventDate,
      symbol: a.symbol,
      cash: a.cashAmount.toFixed(2),
      quantity: a.shareDelta,
    })) as Adjustment[],
    decisions,
  };
}

async function rebuildSnapshots(tx: Tx, account: PaperAccount) {
  const data = await loadData(tx);
  const baseline = data.prices.get(quoteKey(account.startDate, BENCHMARK));
  const existing = await tx.paperSnapshot.findMany({
    where: { accountId: account.id },
    orderBy: { revision: "desc" },
    distinct: ["tradeDate"],
  });
  const latest = new Map(existing.map((s) => [s.tradeDate, s]));
  for (const date of calendarRange(account.startDate, account.settledThrough)) {
    check(data.calendar.has(date), `缺少 ${date} 交易日历，不能重新估值`, 409);
    if (!data.calendar.get(date)) continue;
    const benchmark = data.prices.get(quoteKey(date, BENCHMARK));
    check(benchmark, `缺少 ${date} 沪深 300 收盘点位`, 409);
    const state = replay(
      account.initialCash.toFixed(2),
      data.trades,
      data.adjustments,
      date,
    );
    const quotes = new Map(
      Object.keys(state.positions).flatMap((symbol) => {
        const quote = data.prices.get(quoteKey(date, symbol));
        return quote ? [[symbol, quote] as const] : [];
      }),
    );
    const value = valuePositions(state, quotes);
    const missingDecision =
      date !== account.startDate &&
      !data.decisions.some((d) => d.decisionDate === date);
    const inputDigest = fingerprint({
      value,
      benchmark,
      baseline,
      missingDecision,
      trades: data.trades.filter((t) => t.date <= date),
      adjustments: data.adjustments.filter((a) => a.date <= date),
    });
    const previous = latest.get(date);
    if (previous?.inputDigest === inputDigest) continue;
    await tx.paperSnapshot.create({
      data: {
        accountId: account.id,
        tradeDate: date,
        revision: (previous?.revision ?? 0) + 1,
        cash: value.cash,
        marketValue: value.marketValue,
        equity: value.equity,
        holdings: value.holdings,
        benchmarkClose: benchmark.close,
        missingDecision,
        inputDigest,
      },
    });
  }
}

export function createPaperService(
  client: PrismaClient,
  clock: () => Date = () => new Date(),
) {
  async function locked<T>(action: (tx: Tx) => Promise<T>) {
    return client.$transaction(
      async (tx) => {
        // 所有实验写操作共用事务锁，防止重复结算或导入与成交交错。
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734501)`;
        return action(tx);
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  async function importCsv(input: unknown) {
    const payload = importSchema.parse(input);
    const today = shanghaiClock(clock()).completedDate;
    const calendarRows =
      payload.kind === "calendar" ? parseCalendar(payload.csv) : [];
    const priceRows = payload.kind === "prices" ? parsePrices(payload.csv) : [];
    return locked(async (tx) => {
      const days = new Map(
        (await tx.paperCalendarDay.findMany()).map((day) => [day.date, day]),
      );
      const current =
        payload.kind === "prices"
          ? await tx.paperPrice.findMany({
              orderBy: { revision: "desc" },
              distinct: ["symbol", "tradeDate"],
            })
          : [];
      const quotes = new Map(
        current.map((p) => [quoteKey(p.tradeDate, p.symbol), p]),
      );
      let added = 0,
        unchanged = 0,
        corrected = 0;
      for (const row of calendarRows) {
        const old = days.get(row.date);
        check(
          !old || old.isOpen === row.isOpen,
          `${row.date} 日历已锁定，不能更改开休市状态`,
          409,
        );
        if (old) {
          unchanged++;
          continue;
        }
        added++;
        if (!payload.preview) await tx.paperCalendarDay.create({ data: row });
      }
      for (const row of priceRows) {
        check(row.date <= today, `${row.date} 尚未收盘，不能导入未来收盘价`);
        check(
          days.get(row.date)?.isOpen,
          `${row.date} 未确认为开市日，请先导入交易日历`,
        );
        const old = quotes.get(quoteKey(row.date, row.symbol));
        if (
          old?.close.toFixed(4) === row.close &&
          old.status === row.status &&
          old.source === row.source
        ) {
          unchanged++;
          continue;
        }
        if (old) corrected++;
        else added++;
        if (!payload.preview)
          await tx.paperPrice.create({
            data: {
              symbol: row.symbol,
              tradeDate: row.date,
              close: row.close,
              status: row.status,
              source: row.source,
              revision: (old?.revision ?? 0) + 1,
            },
          });
      }
      if (!payload.preview && corrected) {
        const account = await tx.paperAccount.findUnique({
          where: { id: "primary" },
        });
        if (account) await rebuildSnapshots(tx, account);
      }
      return {
        preview: payload.preview,
        added,
        unchanged,
        corrected,
        rows: [...calendarRows, ...priceRows].slice(0, 5),
        total: calendarRows.length + priceRows.length,
      };
    });
  }

  async function createAccount(input: unknown) {
    const payload = accountSchema.parse(input);
    const initial = money(payload.initialCash),
      minimum = money(payload.minimumFee);
    check(initial > 0n, "初始资金必须大于零");
    check(minimum <= initial, "最低模拟费用不能超过初始资金");
    check(
      payload.startDate <= shanghaiClock(clock()).completedDate,
      "开始日必须已收盘",
    );
    check(
      payload.instruments.every((i) => isStockSymbol(i.symbol)),
      "第一版仅支持沪深主板普通 A 股代码（60xxxx.SH / 00xxxx.SZ）",
    );
    check(
      new Set(payload.instruments.map((i) => i.symbol)).size ===
        payload.instruments.length,
      "白名单标的不能重复",
    );
    return locked(async (tx) => {
      check(
        !(await tx.paperAccount.findUnique({ where: { id: "primary" } })),
        "实验账户已创建，不能重置资金或覆盖历史",
        409,
      );
      const day = await tx.paperCalendarDay.findUnique({
        where: { date: payload.startDate },
      });
      check(day?.isOpen, "请先导入开始日的交易日历，并确认该日开市");
      const base = await tx.paperPrice.findFirst({
        where: { symbol: BENCHMARK, tradeDate: payload.startDate },
        orderBy: { revision: "desc" },
      });
      check(base, "请先导入开始日的沪深 300 收盘点位");
      const account = await tx.paperAccount.create({
        data: {
          id: "primary",
          initialCash: decimal(initial),
          minimumFee: decimal(minimum),
          feeBps: payload.feeBps,
          startDate: payload.startDate,
          settledThrough: payload.startDate,
          instruments: { create: payload.instruments },
        },
      });
      await rebuildSnapshots(tx, account);
      return { created: true };
    });
  }

  async function submitDecision(input: unknown) {
    const payload = decisionSchema.parse(input);
    check(
      new Set(payload.newsIds).size === payload.newsIds.length,
      "引用新闻不能重复",
    );
    check(
      new Set(payload.orders.map((o) => o.symbol)).size ===
        payload.orders.length,
      "同一决策中每个标的只能有一条指令",
    );
    check(
      payload.kind === "TRADE"
        ? payload.orders.length > 0
        : payload.orders.length === 0,
      "交易决策需要指令；持有或空仓决策不能包含指令",
    );
    const normalized = {
      ...payload,
      orders: [...payload.orders].sort((a, b) =>
        a.symbol.localeCompare(b.symbol),
      ),
      newsIds: [...payload.newsIds].sort(),
    };
    const digest = fingerprint(normalized);
    return locked(async (tx) => {
      const now = clock(),
        current = shanghaiClock(now);
      check(current.afterClose, "请在北京时间 15:00 收盘后记录当天决策");
      const day = await tx.paperCalendarDay.findUnique({
        where: { date: current.date },
      });
      check(day?.isOpen, "当天未被日历确认为开市日，请先核对交易日历");
      const account = await tx.paperAccount.findUnique({
        where: { id: "primary" },
        include: { instruments: true },
      });
      check(account, "请先创建实验账户", 409);
      check(current.date >= account.startDate, "决策不能早于账户开始日");
      const old = await tx.paperDecision.findUnique({
        where: {
          accountId_decisionDate: {
            accountId: account.id,
            decisionDate: current.date,
          },
        },
      });
      if (old) {
        check(
          old.inputDigest === digest,
          "当天决策已经锁定，不能覆盖；原始证据已保留",
          409,
        );
        return { id: old.id, duplicate: true };
      }
      check(
        account.settledThrough >= current.date,
        "请先补齐行情并完成当天结算，再基于已核对的持仓和现金记录决策",
        409,
      );
      check(
        payload.orders.every((o) =>
          account.instruments.some((i) => i.symbol === o.symbol),
        ),
        "指令包含账户白名单外的标的",
      );
      check(
        payload.orders.every((o) => o.side !== "BUY" || o.quantity % 100 === 0),
        "买入数量必须为 100 股的整数倍",
      );
      if (payload.kind === "CASH") {
        const data = await loadData(tx);
        const held = replay(
          account.initialCash.toFixed(2),
          data.trades,
          data.adjustments,
          current.date,
        );
        check(
          !Object.values(held.positions).some((q) => q > 0),
          "当前仍有持仓；如需清仓，请记录卖出指令",
        );
      }
      const news = await tx.newsItem.findMany({
        where: {
          id: { in: payload.newsIds },
          publishedAt: { lte: now },
          ingestedAt: { lte: now },
        },
        orderBy: { id: "asc" },
      });
      check(
        news.length === payload.newsIds.length,
        "引用包含不存在或决策时尚不可见的新闻",
      );
      const evidence = news.map((item) => {
        const available = item.analyzedAt !== null && item.analyzedAt <= now;
        return {
          newsId: item.id,
          title: item.title,
          link: item.link,
          source: item.source,
          contentSnippet: item.contentSnippet,
          publishedAt: item.publishedAt.toISOString(),
          ingestedAt: item.ingestedAt.toISOString(),
          capturedAt: now.toISOString(),
          analyzedAt: available ? item.analyzedAt!.toISOString() : null,
          analysisStatus: available ? item.analysisStatus : "unavailable",
          summary: available ? item.summary : null,
          sentiment: available ? item.sentiment : null,
          impactSectors: available ? item.impactSectors : [],
          actionableAdvice: available ? item.actionableAdvice : null,
          model: available ? item.analysisModel : null,
          promptVersion: available ? item.promptVersion : null,
        };
      });
      const snapshot = await tx.paperSnapshot.findFirst({
        where: { accountId: account.id, tradeDate: current.date },
        orderBy: { revision: "desc" },
      });
      check(snapshot, "当天估值尚未完成，不能锁定决策", 409);
      const context = {
        valuationDate: snapshot.tradeDate,
        valuationRevision: snapshot.revision,
        cash: snapshot.cash.toFixed(2),
        equity: snapshot.equity.toFixed(2),
        holdings: snapshot.holdings,
        benchmarkClose: snapshot.benchmarkClose.toFixed(4),
        initialCash: account.initialCash.toFixed(2),
        startDate: account.startDate,
        feeBps: account.feeBps,
        minimumFee: account.minimumFee.toFixed(2),
      };
      const decision = await tx.paperDecision.create({
        data: {
          accountId: account.id,
          decisionDate: current.date,
          submittedAt: now,
          kind: payload.kind,
          rationale: payload.rationale,
          evidence,
          context,
          inputDigest: digest,
          orders: { create: normalized.orders },
        },
      });
      await rebuildSnapshots(tx, account);
      return { id: decision.id, duplicate: false };
    });
  }

  async function settle(input: unknown = {}) {
    const { through } = z
      .object({ through: dateSchema.optional() })
      .strict()
      .parse(input);
    const completedDate = shanghaiClock(clock()).completedDate;
    const target = through ?? completedDate;
    check(target <= completedDate, "不能结算尚未收盘或未来的日期");
    return locked(async (tx) => {
      const account = await tx.paperAccount.findUnique({
        where: { id: "primary" },
      });
      check(account, "请先创建实验账户", 409);
      check(target >= account.startDate, "结算日期不能早于开始日");
      const data = await loadData(tx);
      const issues: string[] = [],
        completed: string[] = [],
        rejected: string[] = [];
      let throughDate = account.settledThrough;
      if (target > throughDate) {
        const dates = calendarRange(addDay(throughDate), target);
        for (const date of dates.slice(0, 90)) {
          if (!data.calendar.has(date)) {
            issues.push(`缺少 ${date} 交易日历，后续日期暂停结算`);
            break;
          }
          if (!data.calendar.get(date)) {
            throughDate = date;
            continue;
          }
          const orders = data.decisions
            .filter((d) => d.decisionDate < date)
            .flatMap((d) =>
              d.orders
                .filter((o) => o.status === "PENDING")
                .map((o) => ({
                  ...o,
                  due: nextTradingDay(d.decisionDate, data.calendar),
                })),
            )
            .filter((o) => o.due !== null && o.due <= date);
          check(
            orders.every((o) => o.due === date),
            "发现跨过应执行日的待处理指令，请核对账本",
            409,
          );
          const state = replay(
            account.initialCash.toFixed(2),
            data.trades,
            data.adjustments,
            date,
          );
          const required = new Set([
            BENCHMARK,
            ...Object.entries(state.positions)
              .filter(([, q]) => q > 0)
              .map(([s]) => s),
            ...orders.map((o) => o.symbol),
          ]);
          const missing = [...required].filter(
            (s) => !data.prices.has(quoteKey(date, s)),
          );
          if (missing.length) {
            issues.push(
              `${date} 缺少收盘数据：${missing.join("、")}；未模拟成交或伪造估值`,
            );
            break;
          }
          for (const order of orders.sort((a, b) =>
            a.side === b.side
              ? a.symbol.localeCompare(b.symbol)
              : a.side === "SELL"
                ? -1
                : 1,
          )) {
            check(
              order.side === "BUY" || order.side === "SELL",
              "指令方向异常",
              409,
            );
            const quote = data.prices.get(quoteKey(date, order.symbol))!;
            const result = execute(
              state,
              {
                symbol: order.symbol,
                side: order.side,
                quantity: order.quantity,
              },
              quote,
              { bps: account.feeBps, minimum: account.minimumFee.toFixed(2) },
            );
            if (result.filled) {
              const trade = await tx.paperTrade.create({
                data: {
                  accountId: account.id,
                  orderId: order.id,
                  tradeDate: date,
                  symbol: order.symbol,
                  side: order.side,
                  quantity: order.quantity,
                  price: quote.close,
                  gross: result.gross,
                  fee: result.fee,
                },
              });
              data.trades.push({
                id: trade.id,
                date,
                symbol: trade.symbol,
                side: trade.side,
                quantity: trade.quantity,
                gross: result.gross,
                fee: result.fee,
              });
            } else rejected.push(`${order.symbol}：${result.reason}`);
            await tx.paperOrder.update({
              where: { id: order.id },
              data: {
                status: result.filled ? "FILLED" : "REJECTED",
                executionDate: date,
                rejectionReason: result.filled ? null : result.reason,
              },
            });
            for (const decision of data.decisions) {
              const stored = decision.orders.find((o) => o.id === order.id);
              if (stored) stored.status = result.filled ? "FILLED" : "REJECTED";
            }
          }
          throughDate = date;
          completed.push(date);
        }
        if (dates.length > 90 && !issues.length)
          issues.push("本次已处理 90 个日历日，请再次结算以继续");
      }
      const updated = await tx.paperAccount.update({
        where: { id: account.id },
        data: { settledThrough: throughDate },
      });
      await rebuildSnapshots(tx, updated);
      return {
        through: throughDate,
        completed,
        issues,
        rejected,
        duplicate: !completed.length && throughDate === account.settledThrough,
      };
    });
  }

  async function addAdjustment(input: unknown) {
    const payload = adjustmentSchema.parse(input),
      amount = money(payload.cash);
    check(
      payload.kind === "DIVIDEND"
        ? amount > 0n && payload.quantity === 0
        : amount === 0n && payload.quantity > 0,
      "分红只增加现金，送转只增加股数；其他公司行为暂不支持",
    );
    check(
      payload.date <= shanghaiClock(clock()).completedDate,
      "不能录入未来公司行为",
    );
    return locked(async (tx) => {
      const old = await tx.paperAdjustment.findUnique({
        where: { requestId: payload.requestId },
      });
      if (old) {
        check(
          old.eventDate === payload.date &&
            old.symbol === payload.symbol &&
            old.kind === payload.kind &&
            old.cashAmount.toFixed(2) === decimal(amount) &&
            old.shareDelta === payload.quantity &&
            old.reason === payload.reason &&
            old.source === payload.source,
          "重复请求编号对应不同内容",
          409,
        );
        return { duplicate: true };
      }
      const account = await tx.paperAccount.findUnique({
        where: { id: "primary" },
        include: { instruments: true },
      });
      check(account, "请先创建实验账户", 409);
      check(
        payload.date > account.startDate &&
          account.instruments.some((i) => i.symbol === payload.symbol),
        "事件必须在开始日之后且属于账户白名单",
      );
      check(
        (
          await tx.paperCalendarDay.findUnique({
            where: { date: payload.date },
          })
        )?.isOpen,
        "公司行为日期必须是已确认的开市日",
      );
      await tx.paperAdjustment.create({
        data: {
          requestId: payload.requestId,
          accountId: account.id,
          eventDate: payload.date,
          symbol: payload.symbol,
          kind: payload.kind,
          cashAmount: decimal(amount),
          shareDelta: payload.quantity,
          source: payload.source,
          reason: payload.reason,
        },
      });
      await rebuildSnapshots(tx, account);
      return { duplicate: false };
    });
  }

  async function dashboard() {
    return client.$transaction(
      async (tx) => {
        const now = clock(),
          current = shanghaiClock(now);
        const [
          account,
          snapshots,
          decisions,
          trades,
          adjustments,
          news,
          calendar,
          prices,
        ] = await Promise.all([
          tx.paperAccount.findUnique({
            where: { id: "primary" },
            include: { instruments: true },
          }),
          tx.paperSnapshot.findMany({
            orderBy: { revision: "desc" },
            distinct: ["tradeDate"],
          }),
          tx.paperDecision.findMany({
            orderBy: { decisionDate: "desc" },
            take: 100,
            include: { orders: true },
          }),
          tx.paperTrade.findMany({
            orderBy: [{ tradeDate: "desc" }, { id: "desc" }],
            take: 100,
          }),
          tx.paperAdjustment.findMany({
            orderBy: { eventDate: "desc" },
            take: 100,
          }),
          tx.newsItem.findMany({
            where: { publishedAt: { lte: now }, ingestedAt: { lte: now } },
            orderBy: { publishedAt: "desc" },
            take: 30,
            select: {
              id: true,
              title: true,
              source: true,
              analysisStatus: true,
              publishedAt: true,
            },
          }),
          tx.paperCalendarDay.findMany({ orderBy: { date: "desc" }, take: 30 }),
          tx.paperPrice.findMany({
            orderBy: [{ tradeDate: "desc" }, { revision: "desc" }],
            distinct: ["symbol", "tradeDate"],
            take: 30,
          }),
        ]);
        const series = account
          ? performance(
              snapshots
                .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
                .map((s) => ({
                  date: s.tradeDate,
                  equity: s.equity.toFixed(2),
                  benchmark: s.benchmarkClose.toFixed(4),
                  cash: s.cash.toFixed(2),
                  marketValue: s.marketValue.toFixed(2),
                  revision: s.revision,
                  missingDecision: s.missingDecision,
                })),
              account.initialCash.toFixed(2),
            )
          : [];
        return {
          clock: { ...current, now: now.toISOString() },
          account: account
            ? {
                initialCash: account.initialCash.toFixed(2),
                startDate: account.startDate,
                settledThrough: account.settledThrough,
                feeBps: account.feeBps,
                minimumFee: account.minimumFee.toFixed(2),
                instruments: account.instruments.map((i) => ({
                  symbol: i.symbol,
                  name: i.name,
                })),
              }
            : null,
          series,
          holdings: snapshots.at(-1)?.holdings ?? [],
          decisions: decisions.map((d) => ({
            id: d.id,
            date: d.decisionDate,
            submittedAt: d.submittedAt.toISOString(),
            kind: d.kind,
            rationale: d.rationale,
            evidence: d.evidence,
            context: d.context,
            orders: d.orders.map((o) => ({
              id: o.id,
              symbol: o.symbol,
              side: o.side,
              quantity: o.quantity,
              status: o.status,
              executionDate: o.executionDate,
              rejectionReason: o.rejectionReason,
            })),
          })),
          trades: trades.map((t) => ({
            date: t.tradeDate,
            symbol: t.symbol,
            side: t.side,
            quantity: t.quantity,
            price: t.price.toFixed(4),
            gross: t.gross.toFixed(2),
            fee: t.fee.toFixed(2),
          })),
          adjustments: adjustments.map((a) => ({
            date: a.eventDate,
            symbol: a.symbol,
            kind: a.kind,
            cash: a.cashAmount.toFixed(2),
            quantity: a.shareDelta,
            source: a.source,
            reason: a.reason,
          })),
          news: news.map((n) => ({
            ...n,
            publishedAt: n.publishedAt.toISOString(),
          })),
          calendar: calendar.map((d) => ({
            date: d.date,
            isOpen: d.isOpen,
            source: d.source,
          })),
          prices: prices.map((p) => ({
            date: p.tradeDate,
            symbol: p.symbol,
            close: p.close.toFixed(4),
            status: p.status,
            source: p.source,
            revision: p.revision,
          })),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30_000,
      },
    );
  }

  async function exportData() {
    return client.$transaction(
      async (tx) => ({
        format: "marketsignal-paper-v1",
        exportedAt: clock().toISOString(),
        account: await tx.paperAccount.findMany(),
        instruments: await tx.paperInstrument.findMany(),
        calendar: await tx.paperCalendarDay.findMany(),
        prices: await tx.paperPrice.findMany(),
        decisions: await tx.paperDecision.findMany(),
        orders: await tx.paperOrder.findMany(),
        trades: await tx.paperTrade.findMany(),
        adjustments: await tx.paperAdjustment.findMany(),
        snapshots: await tx.paperSnapshot.findMany(),
      }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30_000,
      },
    );
  }

  return {
    importCsv,
    createAccount,
    submitDecision,
    settle,
    addAdjustment,
    dashboard,
    exportData,
  };
}

export type PaperDashboard = Awaited<
  ReturnType<ReturnType<typeof createPaperService>["dashboard"]>
>;
