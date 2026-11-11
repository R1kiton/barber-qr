import { createHash } from "crypto";
import { cookies } from "next/headers";
import type { Shop } from "./types";

const SECRET = process.env.ADMIN_SECRET ?? "barberqr-dev-secret-cambiar";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const hashPin = (pin: string) => sha(`pin:${pin}:${SECRET}`);
const cookieName = (slug: string) => `bq_admin_${slug}`;
const token = (shop: Shop) => sha(`${shop.slug}:${shop.pinHash}:${SECRET}`);

export async function isAdmin(shop: Shop) {
  const jar = await cookies();
  return jar.get(cookieName(shop.slug))?.value === token(shop);
}

export async function setAdminSession(shop: Shop) {
  const jar = await cookies();
  jar.set(cookieName(shop.slug), token(shop), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession(slug: string) {
  const jar = await cookies();
  jar.delete(cookieName(slug));
}
