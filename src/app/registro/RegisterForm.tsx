"use client";

import { useActionState } from "react";
import { registerShop } from "../actions";
import { DAY_SHORT } from "@/lib/time";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function RegisterForm() {
  const [state, action, pending] = useActionState(registerShop, undefined);

  return (
    <form action={action} className="mt-8 grid gap-6">
      <section className="grid gap-4 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-display text-xl">Datos</h2>
        <div>
          <label className="label" htmlFor="name">Nombre de la barbería</label>
          <input id="name" name="name" required className="field" placeholder="Barbería El Bigote" />
        </div>
        <div>
          <label className="label" htmlFor="slug">Enlace (opcional)</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">/b/</span>
            <input id="slug" name="slug" className="field" placeholder="el-bigote" />
          </div>
          <p className="mt-1 text-xs text-muted">Si lo dejas vacío se crea a partir del nombre.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="address">Dirección</label>
            <input id="address" name="address" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Teléfono</label>
            <input id="phone" name="phone" type="tel" className="field" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="pin">PIN del panel (4 a 8 dígitos)</label>
          <input
            id="pin"
            name="pin"
            required
            inputMode="numeric"
            pattern="\d{4,8}"
            type="password"
            className="field max-w-[12rem]"
          />
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-display text-xl">Horario</h2>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="label" htmlFor="openTime">Abre</label>
            <input id="openTime" name="openTime" type="time" defaultValue="09:00" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="closeTime">Cierra</label>
            <input id="closeTime" name="closeTime" type="time" defaultValue="19:00" className="field" />
          </div>
        </div>
        <fieldset>
          <legend className="label">Días que abre</legend>
          <div className="flex flex-wrap gap-2">
            {ORDER.map((d) => (
              <label key={d} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="workDays"
                  value={d}
                  defaultChecked={d !== 0}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full border border-line px-3 py-1.5 text-sm peer-checked:bg-ink peer-checked:text-paper peer-checked:border-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brass">
                  {DAY_SHORT[d]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="grid gap-4 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-display text-xl">Servicios y barberos</h2>
        <div>
          <label className="label" htmlFor="services">Servicios — uno por línea: nombre | minutos | precio</label>
          <textarea
            id="services"
            name="services"
            rows={4}
            required
            className="field font-mono text-sm"
            defaultValue={"Corte clásico | 30 | 150\nCorte + barba | 60 | 250\nArreglo de barba | 30 | 120"}
          />
        </div>
        <div>
          <label className="label" htmlFor="barbers">Barberos — uno por línea</label>
          <textarea
            id="barbers"
            name="barbers"
            rows={3}
            required
            className="field"
            placeholder={"Carlos\nMiguel"}
          />
          <p className="mt-1 text-xs text-muted">Escribe al menos uno; el ejemplo gris no cuenta.</p>
        </div>
      </section>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-pole-red/10 px-4 py-3 text-sm text-pole-red">
          {state.error}
        </p>
      )}

      <button className="btn justify-self-start" disabled={pending}>
        {pending ? "Creando…" : "Crear barbería"}
      </button>
    </form>
  );
}
