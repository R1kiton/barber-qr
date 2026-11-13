import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "bq_owner_session";
export const REGISTRATION_COOKIE = "bq_registration";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
// Legacy fixtures only: PINs no longer authenticate anyone.
export const hashPin = (pin: string) => digest(`disabled-pin:${pin}`);

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const parts = stored?.split("$");
  const actual = await derive(password, parts?.[1] ?? "00000000000000000000000000000000");
  const expected = Buffer.from(parts?.[2] ?? "00".repeat(64), "hex");
  return parts?.[0] === "scrypt" && expected.length === actual.length && timingSafeEqual(actual, expected);
}
export async function currentOwner() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await prisma().adminSession.findUnique({
    where: { tokenHash: digest(token) },
    include: { shop: { select: { id: true, slug: true, emailVerifiedAt: true } } },
  });
  return session && session.expiresAt > new Date() && session.shop.emailVerifiedAt ? session.shop : null;
}
export async function isAdmin(shop: { id: string }) {
  return (await currentOwner())?.id === shop.id;
}
export async function setAdminSession(shop: { id: string }) {
  await clearAdminSession();
  const token = newToken();
  const maxAge = 60 * 60 * 24 * 7;
  await prisma().adminSession.create({
    data: { tokenHash: digest(token), shopId: shop.id, expiresAt: new Date(Date.now() + maxAge * 1000) },
  });
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieOptions, maxAge });
}
export async function clearAdminSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma().adminSession.deleteMany({ where: { tokenHash: digest(token) } });
  jar.delete(SESSION_COOKIE);
}
/** Atomic fixed-window limiter shared by every app instance. */
export async function allowAuthAttempt(scope: string, value: string, limit: number, seconds: number) {
  const key = digest(`${scope}:${value}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + seconds * 1000);
  const rows = await prisma().$queryRaw<{ count: number }[]>`
    INSERT INTO auth_rate_limits (key, count, expires_at) VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN auth_rate_limits.expires_at <= ${now} THEN 1 ELSE auth_rate_limits.count + 1 END,
      expires_at = CASE WHEN auth_rate_limits.expires_at <= ${now} THEN ${expiresAt} ELSE auth_rate_limits.expires_at END
    RETURNING count`;
  return rows[0].count <= limit;
}
