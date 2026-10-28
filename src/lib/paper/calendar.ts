import { check } from "./errors";

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function addDay(value: string, days = 1): string {
  check(validDate(value), "日期必须为有效的 YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function shanghaiClock(now = new Date()) {
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const date = local.toISOString().slice(0, 10);
  const afterClose = local.getUTCHours() >= 15;
  return {
    date,
    afterClose,
    completedDate: afterClose ? date : addDay(date, -1),
  };
}

export function calendarRange(start: string, end: string): string[] {
  check(validDate(start) && validDate(end) && end >= start, "日期范围不正确");
  const result: string[] = [];
  for (let date = start; date <= end; date = addDay(date)) {
    check(result.length < 3_660, "单个实验最长支持十年");
    result.push(date);
  }
  return result;
}

export function nextTradingDay(
  date: string,
  calendar: Map<string, boolean>,
): string | null {
  for (let cursor = addDay(date), i = 0; i < 31; cursor = addDay(cursor), i++) {
    if (!calendar.has(cursor)) return null;
    if (calendar.get(cursor)) return cursor;
  }
  return null;
}
