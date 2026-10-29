import { timingSafeEqual } from "node:crypto";

// 定时任务与管理员操作使用独立密钥；缺少配置时拒绝请求。
export function authorized(request: Request, secret: string | undefined): boolean {
  const value = request.headers.get("authorization");
  if (!secret || !value?.startsWith("Bearer ")) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(value.slice(7));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
