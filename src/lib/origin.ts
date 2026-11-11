import { headers } from "next/headers";

/** URL base pública (la que va dentro del QR). Se puede fijar con NEXT_PUBLIC_BASE_URL. */
export async function getOrigin() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (/^(localhost|127\.|192\.168\.|10\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
