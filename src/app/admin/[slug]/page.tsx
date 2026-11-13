import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import * as shops from "@/services/shop.service";
import * as appointments from "@/services/appointment.service";
import { isAdmin } from "@/lib/auth";
import { getOrigin } from "@/lib/origin";
import { DAY_SHORT, addDays, formatDateLong, formatPrice, isValidDate, localDateStr, weekday } from "@/lib/time";
import type { Appointment, Shop } from "@/lib/types";
import {
  addBarber,
  addService,
  adminLogout,
  checkInAppointment,
  removeBarber,
  removeService,
  setAppointmentStatus,
} from "@/app/actions";
import CodeLookup from "./CodeLookup";
import HoursForm from "./HoursForm";

export default function AdminPage({ params, searchParams }: PageProps<"/admin/[slug]">) {
  return (
    <main className="flex-1">
      <Suspense fallback={<p className="p-8 text-center text-muted">Cargando…</p>}>
        <AdminContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AdminContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await shops.getBySlug(slug);
  if (!shop) notFound();
  if (!(await isAdmin(shop))) redirect("/login");

  const today = localDateStr(new Date());
  const fecha = typeof sp.fecha === "string" && isValidDate(sp.fecha) ? sp.fecha : today;

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [ofDay, weekAppts] = await Promise.all([
    appointments.listByDateRange(shop.id, { from: fecha, to: fecha }),
    appointments.listByDateRange(shop.id, { from: week[0], to: week[6] }),
  ]);
  const countFor = (d: string) => weekAppts.filter((a) => a.date === d && a.status !== "cancelada").length;
  const income = ofDay.filter((a) => a.status !== "cancelada").reduce((sum, a) => sum + a.price, 0);

  const bookingUrl = `${await getOrigin()}/b/${slug}`;
  const arrived = ofDay.filter((a) => a.checkedInAt && a.status !== "cancelada").length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-ink">Panel</p>
          <h1 className="font-display text-4xl tracking-tight">{shop.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/b/${slug}`} className="btn btn-ghost text-sm" target="_blank">
            Ver página de reservas
          </Link>
          <form action={adminLogout}>
            <input type="hidden" name="slug" value={slug} />
            <button className="btn btn-ghost text-sm">Salir</button>
          </form>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Agenda */}
        <section className="min-w-0 rounded-2xl border border-line bg-card p-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {week.map((d) => (
              <Link
                key={d}
                href={`?fecha=${d}`}
                className={`flex min-w-16 flex-col items-center rounded-xl border px-3 py-2 text-sm ${
                  d === fecha ? "border-ink bg-ink text-paper" : "border-line"
                }`}
              >
                <span className="text-xs opacity-75">{d === today ? "Hoy" : DAY_SHORT[weekday(d)]}</span>
                <span className="font-display text-xl">{d.slice(8)}</span>
                <span className="text-[11px] opacity-75">{countFor(d)} citas</span>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href={`?fecha=${addDays(fecha, -1)}`} className="btn btn-ghost px-3 py-1.5" aria-label="Día anterior">
                ←
              </Link>
              <h2 className="font-display text-2xl first-letter:uppercase">{formatDateLong(fecha)}</h2>
              <Link href={`?fecha=${addDays(fecha, 1)}`} className="btn btn-ghost px-3 py-1.5" aria-label="Día siguiente">
                →
              </Link>
            </div>
            <p className="text-sm text-muted">
              {ofDay.filter((a) => a.status !== "cancelada").length} citas · {arrived} llegaron ·{" "}
              {formatPrice(income)} estimado
            </p>
          </div>

          {ofDay.length === 0 ? (
            <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-muted">
              No hay citas este día.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-line">
              {ofDay.map((a) => (
                <AppointmentRow key={a.id} a={a} shop={shop} />
              ))}
            </ul>
          )}
        </section>

        <aside className="grid content-start gap-6">
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-display text-xl">Registrar llegada</h2>
            <p className="mt-2 text-sm text-muted">
              Cuando llegue un cliente, escanea el QR de su cita con la cámara de este celular. Se abrirá
              su ficha para confirmar la llegada.
            </p>
            <CodeLookup slug={slug} />
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-display text-xl">Enlace de reservas</h2>
            <p className="mt-2 text-sm text-muted">
              Compártelo en WhatsApp, Instagram o Google para que tus clientes reserven.
            </p>
            <p className="mt-3 break-all rounded-xl bg-paper px-3 py-2 font-mono text-xs">{bookingUrl}</p>
          </section>
        </aside>
      </div>

      <Settings shop={shop} />
    </div>
  );
}

const STATUS_STYLE: Record<Appointment["status"], string> = {
  confirmada: "bg-brass/15 text-brass-ink",
  completada: "bg-pole-blue/10 text-pole-blue",
  cancelada: "bg-line text-muted line-through",
};

function AppointmentRow({ a, shop }: { a: Appointment; shop: Shop }) {
  const barber = shop.barbers.find((b) => b.id === a.barberId);
  const wa = a.customerPhone.replace(/\D/g, "");
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <span className="w-14 font-display text-xl tabular-nums">{a.time}</span>
      <span className="font-mono text-xs text-muted">{a.code}</span>
      <div className="min-w-40 flex-1">
        <p className="font-semibold">{a.customerName}</p>
        <p className="text-sm text-muted">
          {a.serviceName} · {barber?.name ?? "—"} ·{" "}
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {a.customerPhone}
          </a>
        </p>
      </div>
      {a.checkedInAt && a.status === "confirmada" ? (
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-paper">
          llegó {new Date(a.checkedInAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[a.status]}`}>
          {a.status}
        </span>
      )}
      <div className="flex gap-1">
        {a.status === "confirmada" && (
          <>
            {!a.checkedInAt && (
              <form action={checkInAppointment}>
                <input type="hidden" name="slug" value={shop.slug} />
                <input type="hidden" name="id" value={a.id} />
                <button className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">Llegó</button>
              </form>
            )}
            <StatusButton shop={shop} id={a.id} status="completada" label="Atendida" />
            <StatusButton shop={shop} id={a.id} status="cancelada" label="Cancelar" />
          </>
        )}
        {a.status !== "confirmada" && (
          <StatusButton shop={shop} id={a.id} status="confirmada" label="Reabrir" />
        )}
      </div>
    </li>
  );
}

function StatusButton({ shop, id, status, label }: { shop: Shop; id: string; status: string; label: string }) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="slug" value={shop.slug} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-ink">
        {label}
      </button>
    </form>
  );
}

function Settings({ shop }: { shop: Shop }) {
  const slug = <input type="hidden" name="slug" value={shop.slug} />;
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Configuración</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-semibold">Servicios</h3>
          <ul className="mt-3 divide-y divide-line text-sm">
            {shop.services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {s.name} <span className="text-muted">· {s.durationMin} min · {formatPrice(s.price)}</span>
                </span>
                {shop.services.length > 1 && (
                  <form action={removeService}>
                    {slug}
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-muted hover:text-pole-red" aria-label={`Eliminar ${s.name}`}>
                      ×
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form action={addService} className="mt-3 grid grid-cols-[1fr_4.5rem_4.5rem] gap-2">
            {slug}
            <input name="name" placeholder="Nuevo servicio" required className="field col-span-3 text-sm" />
            <input name="durationMin" type="number" min={15} step={15} defaultValue={30} className="field text-sm" aria-label="Minutos" />
            <input name="price" type="number" min={0} placeholder="$" className="field text-sm" aria-label="Precio" />
            <button className="btn px-3 py-2 text-sm">Agregar</button>
          </form>
        </div>

        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-semibold">Barberos</h3>
          <ul className="mt-3 divide-y divide-line text-sm">
            {shop.barbers.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>{b.name}</span>
                {shop.barbers.length > 1 && (
                  <form action={removeBarber}>
                    {slug}
                    <input type="hidden" name="id" value={b.id} />
                    <button className="text-muted hover:text-pole-red" aria-label={`Eliminar ${b.name}`}>
                      ×
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form action={addBarber} className="mt-3 flex gap-2">
            {slug}
            <input name="name" placeholder="Nombre" required className="field text-sm" />
            <button className="btn px-3 py-2 text-sm">Agregar</button>
          </form>
        </div>

        <HoursForm shop={{ slug: shop.slug, openTime: shop.openTime, closeTime: shop.closeTime, workDays: shop.workDays, weeklyHours: shop.weeklyHours }} />
      </div>
    </section>
  );
}
