import { PaperError, check } from "./errors";
import {
  SESSION_COOKIE,
  secretEquals,
  validPasswordHash,
  verifySession,
} from "./session";

export function authConfigured() {
  return (
    validPasswordHash(process.env.PAPER_PASSWORD_HASH ?? "") &&
    (process.env.PAPER_SESSION_SECRET?.length ?? 0) >= 32
  );
}

export function isAuthenticated(value: string | undefined) {
  return (
    authConfigured() && verifySession(value, process.env.PAPER_SESSION_SECRET!)
  );
}

export function requireSameOrigin(request: Request) {
  // Next 的内部 URL 可能使用 localhost，浏览器实际访问的主机由 Host 提供。
  const host = request.headers.get("host");
  const protocol = new URL(request.url).protocol;
  let expected = "";
  if (host) {
    try {
      const address = new URL(`${protocol}//${host}`);
      if (address.host === host.toLowerCase()) expected = address.origin;
    } catch {
      /* 非法 Host 保持拒绝。 */
    }
  }
  check(
    expected && request.headers.get("origin") === expected,
    "请求来源校验失败，请从本站页面操作",
    403,
  );
}

export function requireSession(request: Request, mutation = false) {
  check(authConfigured(), "实验区尚未完成服务器访问配置", 503);
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  check(isAuthenticated(value), "请先登录实验区，再执行操作", 401);
  if (mutation) requireSameOrigin(request);
}

export function requireCron(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  check(secretEquals(token, process.env.CRON_SECRET), "Unauthorized", 401);
}

export function requireOperator(request: Request) {
  try {
    requireCron(request);
  } catch (error) {
    if (!(error instanceof PaperError)) throw error;
    requireSession(request, true);
  }
}
