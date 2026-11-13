"use client";

import { useActionState } from "react";
import { verifyRegistration } from "./actions";

export default function VerificationForm() {
  const [state, action, pending] = useActionState(verifyRegistration, undefined);
  return (
    <form action={action} className="mt-8 grid gap-4">
      <label htmlFor="code" className="label">Código de verificación</label>
      <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className="field text-center text-2xl tracking-[0.3em]" placeholder="000000" aria-describedby="code-hint" />
      <p id="code-hint" className="text-sm text-muted">Son 6 dígitos. El código caduca en 10 minutos y admite hasta 5 intentos.</p>
      {state?.error && <p role="alert" className="text-sm text-pole-red">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-brass-ink">{state.message}</p>}
      <button name="intent" value="verify" className="btn w-full" disabled={pending}>{pending ? "Procesando…" : "Verificar y crear barbería"}</button>
      <button name="intent" value="resend" formNoValidate className="btn btn-ghost w-full" disabled={pending}>Reenviar código</button>
    </form>
  );
}
