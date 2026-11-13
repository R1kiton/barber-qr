"use client";

import { useActionState } from "react";
import Link from "next/link";
import { adminLogin } from "@/app/actions";

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={action} className="mx-auto w-full max-w-md rounded-2xl bg-card p-6 sm:p-8">
      <Link href="/" className="font-display text-2xl">Barber<span className="text-brass">QR</span></Link>
      <h1 className="mt-8 font-display text-3xl">Entra a tu barbería</h1>
      <p className="mt-3 text-muted">Usa tu correo y contraseña. Te llevaremos al panel de tu barbería.</p>
      {next && <p className="mt-3 text-sm text-brass-ink">Inicia sesión como propietario para confirmar la llegada del cliente.</p>}
      {next && <input type="hidden" name="next" value={next} />}
      <label className="label mt-6" htmlFor="email">Correo electrónico</label>
      <input id="email" name="email" type="email" autoComplete="username" maxLength={254} required className="field" />
      <label className="label mt-5" htmlFor="password">Contraseña</label>
      <input id="password" name="password" type="password" autoComplete="current-password" maxLength={128} required className="field" />
      {state?.error && <p role="alert" className="mt-4 text-sm text-pole-red">{state.error}</p>}
      <button className="btn mt-6 w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar al panel"}</button>
      <p className="mt-6 text-sm text-muted">¿Aún no tienes una cuenta? <Link href="/registro" className="text-brass-ink underline underline-offset-4">Registra tu barbería</Link></p>
    </form>
  );
}
