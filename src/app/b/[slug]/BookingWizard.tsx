"use client";

import { hoursForDay } from "@/lib/hours";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookAppointment } from "@/app/actions";
import type { PublicShop } from "@/lib/types";
import { DAY_SHORT, addDays, dayOfMonth, formatDateLong, formatPrice, monthShort, weekday } from "@/lib/time";

const DAYS_SHOWN = 14;
const STEPS = ["Servicio", "Barbero", "Fecha y hora", "Tus datos"] as const;
const SAVED_KEY = "barberqr:cliente";

export default function BookingWizard({ shop, today }: { shop: PublicShop; today: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(shop.barbers.length === 1 ? shop.barbers[0].id : null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slotsData, setSlotsData] = useState<{ key: string; slots: string[] } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [pending, startTransition] = useTransition();

  const service = shop.services.find((s) => s.id === serviceId);
  const barberName =
    barberId === "any" ? "Cualquiera" : shop.barbers.find((b) => b.id === barberId)?.name;

  const days = useMemo(
    () => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)),
    [today],
  );

  // Horarios: se guardan junto a la consulta que los produjo; si no coincide, están "cargando".
  const slotsKey = `${serviceId}|${barberId}|${date}|${reload}`;
  const slots = slotsData?.key === slotsKey ? slotsData.slots : null;

  useEffect(() => {
    if (!serviceId || !barberId || !date) return;
    let cancelled = false;
    const q = new URLSearchParams({ slug: shop.slug, date, serviceId, barberId });
    fetch(`/api/slots?${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { slots: string[] }) => !cancelled && setSlotsData({ key: slotsKey, slots: d.slots }))
      .catch(() => !cancelled && setSlotsData({ key: slotsKey, slots: [] }));
    return () => {
      cancelled = true;
    };
  }, [shop.slug, serviceId, barberId, date, slotsKey]);

  function go(n: number) {
    setError(null);
    // Al llegar a "Tus datos", rellena nombre/teléfono de una reserva anterior.
    if (n === 3 && !name && !phone) {
      try {
        const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null");
        if (saved?.name) setName(saved.name);
        if (saved?.phone) setPhone(saved.phone);
      } catch {}
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || !barberId || !date || !time) return;
    setError(null);
    startTransition(async () => {
      const res = await bookAppointment({ slug: shop.slug, serviceId, barberId, date, time, name, phone });
      if (res.ok) {
        try {
          localStorage.setItem(SAVED_KEY, JSON.stringify({ name, phone }));
        } catch {}
        router.push(`/b/${shop.slug}/cita/${res.id}`);
      } else {
        setError(res.error);
        if (res.error.includes("ocupar")) {
          setTime(null);
          setReload((n) => n + 1); // vuelve a pedir horarios
          go(2);
        }
      }
    });
  }

  return (
    <div>
      {/* Progreso */}
      <ol className="mb-6 grid grid-cols-4 gap-1.5" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => go(i)}
              className="w-full text-left disabled:cursor-default"
              aria-current={i === step ? "step" : undefined}
            >
              <span className={`block h-1 rounded-full ${i <= step ? "bg-ink" : "bg-line"}`} />
              <span className={`mt-1.5 block text-[11px] ${i === step ? "font-semibold" : "text-muted"}`}>
                {s}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* Resumen */}
      {step > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 text-sm">
          {service && <Chip>{service.name}</Chip>}
          {step > 1 && barberName && <Chip>{barberName}</Chip>}
          {step > 2 && date && time && (
            <Chip>
              {formatDateLong(date)} · {time}
            </Chip>
          )}
        </div>
      )}

      {step === 0 && (
        <Section title="¿Qué te vas a hacer?">
          <div className="grid gap-2">
            {shop.services.map((s) => (
              <Option
                key={s.id}
                selected={serviceId === s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setTime(null);
                  go(shop.barbers.length === 1 ? 2 : 1);
                }}
              >
                <span className="font-semibold">{s.name}</span>
                <span className="text-sm text-muted">{s.durationMin} min</span>
                <span className="ml-auto font-display text-lg">{formatPrice(s.price)}</span>
              </Option>
            ))}
          </div>
        </Section>
      )}

      {step === 1 && (
        <Section title="¿Con quién?">
          <div className="grid gap-2">
            <Option
              selected={barberId === "any"}
              onClick={() => {
                setBarberId("any");
                setTime(null);
                go(2);
              }}
            >
              <Avatar>★</Avatar>
              <span>
                <span className="block font-semibold">Cualquiera disponible</span>
                <span className="text-sm text-muted">Más horarios para elegir</span>
              </span>
            </Option>
            {shop.barbers.map((b) => (
              <Option
                key={b.id}
                selected={barberId === b.id}
                onClick={() => {
                  setBarberId(b.id);
                  setTime(null);
                  go(2);
                }}
              >
                <Avatar>{b.name.charAt(0).toUpperCase()}</Avatar>
                <span className="font-semibold">{b.name}</span>
              </Option>
            ))}
          </div>
        </Section>
      )}

      {step === 2 && (
        <Section title="¿Cuándo?">
          <div className="-mx-5 overflow-x-auto px-5 pb-2">
            <div className="flex gap-2">
              {days.map((d) => {
                const open = !!hoursForDay(shop, weekday(d));
                const sel = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!open}
                    onClick={() => {
                      setDate(d);
                      setTime(null);
                    }}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition ${
                      sel ? "border-ink bg-ink text-paper" : "border-line bg-card"
                    } disabled:opacity-35 disabled:line-through`}
                  >
                    <span className="text-xs">{d === today ? "Hoy" : DAY_SHORT[weekday(d)]}</span>
                    <span className="font-display text-2xl leading-tight">{dayOfMonth(d)}</span>
                    <span className="text-[11px] opacity-70">{monthShort(d)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            {!date && <p className="text-sm text-muted">Elige un día para ver los horarios.</p>}
            {date && slots === null && <p className="text-sm text-muted">Buscando horarios…</p>}
            {date && slots?.length === 0 && (
              <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted border border-line">
                No quedan horarios este día. Prueba con otro.
              </p>
            )}
            {date && slots && slots.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    className={`rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition ${
                      t === time ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <ErrorBox>{error}</ErrorBox>}

          <button type="button" className="btn mt-8 w-full" disabled={!time} onClick={() => go(3)}>
            Continuar
          </button>
        </Section>
      )}

      {step === 3 && service && date && time && (
        <Section title="Tus datos">
          <form onSubmit={submit} className="grid gap-4">
            <div>
              <label className="label" htmlFor="name">Nombre</label>
              <input
                id="name"
                className="field"
                autoComplete="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="phone">Teléfono / WhatsApp</label>
              <input
                id="phone"
                className="field"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-line bg-card p-4 text-sm">
              <Row k="Servicio" v={service.name} />
              <Row k="Barbero" v={barberName ?? ""} />
              <Row k="Fecha" v={formatDateLong(date)} />
              <Row k="Hora" v={time} />
              <Row k="Duración" v={`${service.durationMin} min`} />
              <div className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
                <span>Total</span>
                <span className="font-display text-lg">{formatPrice(service.price)}</span>
              </div>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <button className="btn w-full" disabled={pending}>
              {pending ? "Reservando…" : "Confirmar cita"}
            </button>
          </form>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-display text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Option({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-4 text-left transition hover:border-ink ${
        selected ? "border-ink ring-1 ring-ink" : "border-line"
      }`}
    >
      {children}
    </button>
  );
}

function Avatar({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper font-display text-lg text-brass-ink border border-line">
      {children}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-card px-3 py-1 first-letter:uppercase">{children}</span>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{k}</span>
      <span className="first-letter:uppercase">{v}</span>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-4 rounded-xl bg-pole-red/10 px-4 py-3 text-sm text-pole-red">
      {children}
    </p>
  );
}
