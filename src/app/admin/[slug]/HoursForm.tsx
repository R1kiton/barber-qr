"use client";

import { useActionState, useState } from "react";
import { updateHours } from "@/app/actions";
import { weeklyHoursFor } from "@/lib/hours";
import { DAY_LONG } from "@/lib/time";
import type { PublicShop } from "@/lib/types";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function HoursForm({ shop }: { shop: Pick<PublicShop, "slug" | "openTime" | "closeTime" | "workDays" | "weeklyHours"> }) {
  const initialHours = weeklyHoursFor(shop);
  const [enabled, setEnabled] = useState(initialHours.map(Boolean));
  const [state, action, pending] = useActionState(updateHours, {});

  return (
    <form action={action} className="rounded-2xl border border-line bg-card p-5 md:col-span-2">
      <input type="hidden" name="slug" value={shop.slug} />
      <h3 className="font-semibold">Horario por día</h3>
      <p className="mt-1 text-sm text-muted">Define cuándo abres cada día. Desmarca los días que cierras.</p>
      <div className="mt-4 divide-y divide-line">
        {ORDER.map((day) => (
          <div key={day} className="grid gap-3 py-3 sm:grid-cols-[minmax(130px,1fr)_1fr_1fr] sm:items-center">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" name={`enabled-${day}`} checked={enabled[day]} disabled={pending}
                onChange={(event) => setEnabled((days) => days.map((value, index) => index === day ? event.target.checked : value))}
                className="h-4 w-4 accent-ink" />
              {DAY_LONG[day]}
              {!enabled[day] && <span className="text-xs font-normal text-muted">Cerrado</span>}
            </label>
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <label className="min-w-0 text-xs text-muted">
                Apertura
                <input name={`open-${day}`} aria-label={`Apertura ${DAY_LONG[day]}`} type="time"
                  defaultValue={initialHours[day]?.openTime ?? shop.openTime} required={enabled[day]}
                  disabled={!enabled[day] || pending} className="field mt-1 min-w-0 text-sm disabled:opacity-40" />
              </label>
              <label className="min-w-0 text-xs text-muted">
                Cierre
                <input name={`close-${day}`} aria-label={`Cierre ${DAY_LONG[day]}`} type="time"
                  defaultValue={initialHours[day]?.closeTime ?? shop.closeTime} required={enabled[day]}
                  disabled={!enabled[day] || pending} className="field mt-1 min-w-0 text-sm disabled:opacity-40" />
              </label>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Los cambios se aplican a nuevas reservas. Las citas existentes se conservan.</p>
      <div aria-live="polite" role="status">
        {state.error && <p className="mt-3 text-sm text-pole-red">{state.error}</p>}
        {state.success && <p className="mt-3 text-sm">Horario guardado.</p>}
      </div>
      <button disabled={pending} className="btn mt-4 px-4 py-2 text-sm disabled:opacity-50">
        {pending ? "Guardando…" : "Guardar horario"}
      </button>
    </form>
  );
}
