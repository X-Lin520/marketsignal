import { check } from "./errors";
import { decimal, feeCents, grossCents, MAX_CENTS, money } from "./money";
import type { PriceStatus } from "./csv";

export type LedgerState = { cash: bigint; positions: Record<string, number> };
export type Trade = {
  id: string;
  date: string;
  symbol: string;
  side: string;
  quantity: number;
  gross: string;
  fee: string;
};
export type Adjustment = {
  id: string;
  date: string;
  symbol: string;
  cash: string;
  quantity: number;
};
export type Instruction = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
};

export function replay(
  initialCash: string,
  trades: Trade[],
  adjustments: Adjustment[],
  through: string,
): LedgerState {
  const state: LedgerState = { cash: money(initialCash), positions: {} };
  const events = [
    ...trades
      .filter((t) => t.date <= through)
      .map((t) => ({ ...t, type: "trade" as const })),
    ...adjustments
      .filter((a) => a.date <= through)
      .map((a) => ({ ...a, type: "adjustment" as const })),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.type === b.type
        ? a.id.localeCompare(b.id)
        : a.type === "adjustment"
          ? -1
          : 1),
  );
  for (const event of events) {
    if (event.type === "adjustment") {
      state.cash += money(event.cash);
      state.positions[event.symbol] =
        (state.positions[event.symbol] ?? 0) + event.quantity;
    } else {
      const sign = event.side === "BUY" ? 1 : -1;
      state.cash += -BigInt(sign) * money(event.gross) - money(event.fee);
      state.positions[event.symbol] =
        (state.positions[event.symbol] ?? 0) + sign * event.quantity;
    }
  }
  check(
    state.cash >= 0n && Object.values(state.positions).every((q) => q >= 0),
    "账本校验失败：现金或持仓为负",
    409,
  );
  check(state.cash <= MAX_CENTS, "账户现金超出实验上限", 409);
  return state;
}

export function execute(
  state: LedgerState,
  instruction: Instruction,
  quote: { close: string; status: PriceStatus },
  fees: { bps: number; minimum: string },
) {
  if (quote.status !== "OPEN")
    return {
      filled: false as const,
      reason: "停牌或涨跌停：按本实验的保守规则不模拟成交",
    };
  const held = state.positions[instruction.symbol] ?? 0;
  if (instruction.side === "BUY" && instruction.quantity % 100 !== 0)
    return { filled: false as const, reason: "买入数量必须为 100 股的整数倍" };
  if (
    instruction.side === "SELL" &&
    (instruction.quantity > held ||
      (instruction.quantity % 100 !== 0 && instruction.quantity !== held))
  )
    return { filled: false as const, reason: "可卖持仓不足，或零股未一次卖清" };
  const gross = grossCents(quote.close, instruction.quantity),
    fee = feeCents(gross, fees.bps, fees.minimum);
  if (instruction.side === "BUY" && state.cash < gross + fee)
    return { filled: false as const, reason: "现金不足（含模拟交易费用）" };
  if (instruction.side === "SELL" && state.cash + gross < fee)
    return { filled: false as const, reason: "卖出所得不足以支付模拟费用" };
  const sign = instruction.side === "BUY" ? 1 : -1;
  state.cash += -BigInt(sign) * gross - fee;
  state.positions[instruction.symbol] = held + sign * instruction.quantity;
  return { filled: true as const, gross: decimal(gross), fee: decimal(fee) };
}

export function valuePositions(
  state: LedgerState,
  quotes: Map<string, { close: string; status: string }>,
) {
  let marketValue = 0n;
  const holdings = Object.entries(state.positions)
    .filter(([, q]) => q > 0)
    .sort()
    .map(([symbol, quantity]) => {
      const quote = quotes.get(symbol);
      check(quote, `缺少持仓 ${symbol} 收盘价`, 409);
      const value = grossCents(quote.close, quantity);
      marketValue += value;
      return {
        symbol,
        quantity,
        close: quote.close,
        value: decimal(value),
        stale: quote.status === "HALTED",
      };
    });
  return {
    cash: decimal(state.cash),
    marketValue: decimal(marketValue),
    equity: decimal(state.cash + marketValue),
    holdings,
  };
}
