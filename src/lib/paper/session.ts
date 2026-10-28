import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const SESSION_COOKIE = "marketsignal-operator";
export const SESSION_SECONDS = 12 * 60 * 60;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function validPasswordHash(value: string) {
  return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value);
}

export function verifyPassword(password: string, hash: string) {
  if (!validPasswordHash(hash) || password.length > 1_024) return false;
  const [, salt, expected] = hash.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(expected, "hex"),
  );
}

export function signSession(secret: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function verifySession(
  value: string | undefined,
  secret: string,
  now = Date.now(),
) {
  if (
    !value ||
    secret.length < 32 ||
    !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)
  )
    return false;
  const [expires, nonce, signature] = value.split(".");
  const remaining = Number(expires) - now / 1000;
  if (remaining <= 0 || remaining > SESSION_SECONDS) return false;
  const expected = createHmac("sha256", secret)
    .update(`${expires}.${nonce}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function secretEquals(
  actual: string | null,
  expected: string | undefined,
) {
  if (!actual || !expected || expected.length < 32) return false;
  // 先散列到固定长度，避免 timingSafeEqual 因输入长度不同抛出异常。
  const digest = (value: string) =>
    createHmac("sha256", expected).update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}
