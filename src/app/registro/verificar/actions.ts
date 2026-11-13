"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { REGISTRATION_COOKIE, setAdminSession } from "@/lib/auth";
import { completeRegistration, resendRegistrationCode } from "@/services/registration.service";

export type VerificationState = { error?: string; message?: string } | undefined;

export async function verifyRegistration(_prev: VerificationState, fd: FormData): Promise<VerificationState> {
  if (fd.get("intent") === "resend") {
    const error = await resendRegistrationCode();
    return error ? { error } : { message: "Enviamos un nuevo código. Usa el último correo; el vencimiento original se mantiene." };
  }
  const result = await completeRegistration(String(fd.get("code") ?? "").trim());
  if (!("shop" in result)) return { error: result.error };
  (await cookies()).delete(REGISTRATION_COOKIE);
  await setAdminSession(result.shop);
  revalidatePath("/");
  revalidatePath("/barberias");
  redirect(`/admin/${result.shop.slug}`);
}
