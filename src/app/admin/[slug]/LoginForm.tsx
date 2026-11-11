"use client";

import { useActionState } from "react";
import { adminLogin } from "@/app/actions";

export default function LoginForm({
  slug,
  shopName,
  next,
}: {
  slug: string;
  shopName: string;
  next?: string;
}) {
  const [state, action, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={action} className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-ink">Panel</p>
      <h1 className="mt-1 font-display text-3xl">{shopName}</h1>
      {next && (
        <p className="mt-2 text-sm text-muted">
          Este QR es de una cita de cliente. Entra con el PIN de la barbería para confirmarla.
        </p>
      )}
      <input type="hidden" name="slug" value={slug} />
      {next && <input type="hidden" name="next" value={next} />}
      <label className="label mt-6" htmlFor="pin">PIN</label>
      <input
        id="pin"
        name="pin"
        type="password"
        inputMode="numeric"
        autoFocus
        required
        className="field text-center text-2xl tracking-[0.4em]"
      />
      {state?.error && <p className="mt-3 text-sm text-pole-red">{state.error}</p>}
      <button className="btn mt-5 w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
