import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { allowAuthAttempt, cookieOptions, digest, hashPassword, newToken, REGISTRATION_COOKIE } from "@/lib/auth";
import { emailConfigured, sendVerificationCode } from "@/lib/email";
import type { NewShop } from "./shop.service";
import { isUniqueViolation } from "./db-errors";

type RegistrationData = Omit<NewShop, "pinHash"> & { passwordHash: string };
const expiry = () => new Date(Date.now() + 10 * 60 * 1000);
const codeHash = (token: string, code: string) => digest(`${token}:${code}`);

export async function pendingRegistration() {
  const token = (await cookies()).get(REGISTRATION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const pending = await prisma().pendingRegistration.findUnique({ where: { tokenHash: digest(token) } });
  return pending && pending.expiresAt > new Date() ? { pending, token } : null;
}

export async function beginRegistration(email: string, password: string, shop: Omit<NewShop, "pinHash">) {
  if (!emailConfigured()) return "El envío de correos aún no está configurado. Intenta más tarde.";
  if (!(await allowAuthAttempt("register", email, 3, 900)))
    return "Ya solicitaste varios códigos. Intenta de nuevo en 15 minutos.";
  const existing = await prisma().shop.findFirst({ where: { OR: [{ ownerEmail: email }, { slug: shop.slug }] }, select: { id: true } });
  if (existing) return "El correo o el enlace ya están registrados. Inicia sesión o usa otros datos.";
  const token = newToken();
  const code = randomInt(0, 1000000).toString().padStart(6, "0");
  const payload: RegistrationData = { ...shop, passwordHash: await hashPassword(password) };
  await prisma().pendingRegistration.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma().pendingRegistration.create({
    data: { tokenHash: digest(token), email, codeHash: codeHash(token, code), payload, expiresAt: expiry() },
  });
  try {
    await sendVerificationCode(email, code);
  } catch {
    await prisma().pendingRegistration.delete({ where: { tokenHash: digest(token) } });
    return "No pudimos enviar el código. Revisa el correo e intenta de nuevo.";
  }
  (await cookies()).set(REGISTRATION_COOKIE, token, { ...cookieOptions, maxAge: 600 });
  return null;
}

export async function resendRegistrationCode() {
  const current = await pendingRegistration();
  if (!current) return "El registro caducó. Vuelve a ingresar los datos.";
  const { pending, token } = current;
  if (pending.attempts >= 5) return "Se agotaron los intentos. Inicia un nuevo registro.";
  if (!(await allowAuthAttempt("resend", pending.email, 1, 60)) ||
      !(await allowAuthAttempt("verification-mail", pending.email, 5, 3600)))
    return "Espera antes de solicitar otro código.";
  const code = randomInt(0, 1000000).toString().padStart(6, "0");
  // Lock the row while replacing the code; concurrent verification cannot use a stale code.
  await prisma().pendingRegistration.update({
    where: { tokenHash: pending.tokenHash }, data: { codeHash: codeHash(token, code) },
  });
  try { await sendVerificationCode(pending.email, code); }
  catch { return "No pudimos enviar el código. Intenta reenviarlo en un minuto."; }
  return null;
}

export async function completeRegistration(code: string) {
  const current = await pendingRegistration();
  if (!current) return { error: "El código caducó. Inicia un nuevo registro." };
  const { pending, token } = current;
  try {
    return await prisma().$transaction(async (tx) => {
      // Increment first to serialize concurrent guesses and cap attempts at five.
      const claimed = await tx.pendingRegistration.updateMany({
        where: { tokenHash: pending.tokenHash, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
        data: { attempts: { increment: 1 } },
      });
      if (!claimed.count) return { error: "Se agotaron los intentos o el código caducó. Inicia un nuevo registro." };
      const fresh = await tx.pendingRegistration.findUniqueOrThrow({ where: { tokenHash: pending.tokenHash } });
      if (!/^\d{6}$/.test(code) || fresh.codeHash !== codeHash(token, code))
        return { error: "Código incorrecto. Revisa el último correo que recibiste." };
      const data = fresh.payload as unknown as RegistrationData;
      const { services, barbers, passwordHash, ...shop } = data;
      const created = await tx.shop.create({
        data: {
          ...shop, pinHash: newToken(), ownerEmail: fresh.email, passwordHash, emailVerifiedAt: new Date(),
          services: { create: services }, barbers: { create: barbers },
        },
        select: { id: true, slug: true },
      });
      await tx.pendingRegistration.delete({ where: { tokenHash: pending.tokenHash } });
      return { shop: created };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "El correo o el enlace ya están en uso. Inicia un nuevo registro." };
    throw error;
  }
}
