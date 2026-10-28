import { validDate } from "./calendar";
import { check } from "./errors";
import { decimal, price } from "./money";

export const BENCHMARK = "000300";
export const isStockSymbol = (value: string) =>
  /^(60\d{4}\.SH|00\d{4}\.SZ)$/.test(value);
export const PRICE_STATUSES = [
  "OPEN",
  "HALTED",
  "LIMIT_UP",
  "LIMIT_DOWN",
] as const;
export type PriceStatus = (typeof PRICE_STATUSES)[number];
export type PriceRow = {
  date: string;
  symbol: string;
  close: string;
  status: PriceStatus;
  source: string;
};
export type CalendarRow = { date: string; isOpen: boolean; source: string };

// 支持 BOM、CRLF、带逗号/换行的引号字段及双引号转义，不容忍损坏行。
export function readCsv(input: string): Record<string, string>[] {
  check(
    typeof input === "string" && Buffer.byteLength(input, "utf8") <= 1_048_576,
    "CSV 不能超过 1 MB",
  );
  const text = input.replace(/^\uFEFF/, "");
  check(
    !text.includes("\uFFFD"),
    "CSV 包含无法解码的字符，请另存为 UTF-8 后导入",
  );
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const finish = () => {
    row.push(field.trim());
    field = "";
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else field += char;
    } else if (char === '"') {
      check(!field && !closed, "CSV 引号位置不正确");
      quoted = true;
    } else if (char === ",") finish();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finish();
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      check(!closed || /\s/.test(char), "CSV 引号结束后有多余字符");
      if (!closed) field += char;
    }
    check(rows.length <= 2_001, "每次最多导入 2,000 行");
  }
  check(!quoted, "CSV 有未闭合的引号");
  finish();
  if (row.some(Boolean)) rows.push(row);
  check(
    rows.length >= 2 && rows.length <= 2_001,
    "CSV 必须包含表头及 1–2,000 行数据",
  );
  const headers = rows.shift()!;
  check(
    new Set(headers).size === headers.length && headers.every(Boolean),
    "CSV 表头不能重复或为空",
  );
  return rows.map((values, i) => {
    check(values.length === headers.length, `CSV 第 ${i + 2} 行列数不正确`);
    return Object.fromEntries(headers.map((key, j) => [key, values[j]]));
  });
}

function validateRows<T>(
  rows: Record<string, string>[],
  headers: string[],
  parse: (row: Record<string, string>) => T,
  key: (row: T) => string,
): T[] {
  const seen = new Set<string>();
  return rows.map((row, i) => {
    check(
      Object.keys(row).sort().join() === [...headers].sort().join(),
      `CSV 表头必须为 ${headers.join(",")}`,
    );
    check(validDate(row.date), `第 ${i + 2} 行日期无效`);
    check(
      row.source.length >= 2 && row.source.length <= 200,
      `第 ${i + 2} 行必须填写数据来源（2–200 字）`,
    );
    const result = parse(row),
      id = key(result);
    check(!seen.has(id), `第 ${i + 2} 行重复：${id}`);
    seen.add(id);
    return result;
  });
}

export function parsePrices(input: string): PriceRow[] {
  return validateRows(
    readCsv(input),
    ["date", "symbol", "close", "status", "source"],
    (row) => {
      check(
        row.symbol === BENCHMARK || isStockSymbol(row.symbol),
        "代码仅支持 000300 或白名单范围的沪深主板股票格式",
      );
      check(
        PRICE_STATUSES.includes(row.status as PriceStatus),
        "行情状态必须为 OPEN / HALTED / LIMIT_UP / LIMIT_DOWN",
      );
      check(
        row.symbol !== BENCHMARK || row.status === "OPEN",
        "指数状态必须为 OPEN",
      );
      return {
        ...row,
        close: decimal(price(row.close), 4),
        status: row.status as PriceStatus,
      } as PriceRow;
    },
    (row) => `${row.date}/${row.symbol}`,
  );
}

export function parseCalendar(input: string): CalendarRow[] {
  return validateRows(
    readCsv(input),
    ["date", "is_open", "source"],
    (row) => {
      check(
        row.is_open === "1" || row.is_open === "0",
        "is_open 仅支持 1（开市）或 0（休市）",
      );
      return {
        date: row.date,
        isOpen: row.is_open === "1",
        source: row.source,
      };
    },
    (row) => row.date,
  );
}
