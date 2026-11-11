"use client";

import { useActionState } from "react";
import { findByCode } from "@/app/actions";

export default function CodeLookup({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(findByCode, undefined);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="slug" value={slug} />
      <label className="label" htmlFor="code">¿La cámara no lee el QR? Escribe el código</label>
      <div className="flex gap-2">
        <input
          id="code"
          name="code"
          required
          maxLength={6}
          autoComplete="off"
          placeholder="A1B2C3"
          className="field font-mono uppercase tracking-[0.25em]"
        />
        <button className="btn px-4 text-sm" disabled={pending}>
          Buscar
        </button>
      </div>
      {state?.error && <p className="mt-2 text-sm text-pole-red">{state.error}</p>}
    </form>
  );
}
