import { check } from "./errors";

export const MAX_CENTS = 100_000_000_000_000n;

function units(value: string, scale: number): bigint {
  check(typeof value === "string" && value.length <= 24, "金额格式不正确");
  const text = value.trim();
  check(
    new RegExp(`^\\d{1,12}(?:\\.\\d{1,${scale}})?$`).test(text),
    `金额最多支持 ${scale} 位小数`,
  );
  const [whole, fraction = ""] = text.split(".");
  return (
    BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0"))
  );
}

export function money(value: string): bigint {
  const result = units(value, 2);
  check(result <= MAX_CENTS, "金额超出实验账户上限");
  return result;
}

export function price(value: string): bigint {
  const result = units(value, 4);
  check(
    result > 0n && result <= 10_000_000_000n,
    "价格必须大于零且不超过 1,000,000 元",
  );
  return result;
}

export function decimal(value: bigint, scale = 2): string {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value)
    .toString()
    .padStart(scale + 1, "0");
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

// 账本始终使用整数分；四位小数报价乘股数后，按四舍五入计入人民币分。
export function grossCents(quote: string, quantity: number): bigint {
  const result = (price(quote) * BigInt(quantity) + 50n) / 100n;
  check(result <= MAX_CENTS, "成交金额超出实验上限");
  return result;
}

export function feeCents(gross: bigint, bps: number, minimum: string): bigint {
  const variable = (gross * BigInt(bps) + 5_000n) / 10_000n;
  const floor = money(minimum);
  return variable > floor ? variable : floor;
}
