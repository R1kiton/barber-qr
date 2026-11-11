import { Suspense } from "react";
import Link from "next/link";
import { listShops } from "@/lib/db";
import { formatPrice, formatWorkDays } from "@/lib/time";
import type { ShopCard } from "@/lib/types";

export default function Home() {
  return (
    <main className="flex-1">
      <div className="pole" />
      <section className="mx-auto max-w-5xl px-5 pt-16 pb-20 grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass-ink">BarberQR</p>
          <h1 className="mt-4 font-display text-5xl md:text-6xl leading-[1.02] tracking-tight">
            Reserva, llega
            <br />
            <em className="text-brass">y muestra tu QR.</em>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Tus clientes reservan desde el celular en menos de un minuto y reciben un código QR con su
            cita. Al llegar, lo escaneas y la llegada queda confirmada.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#barberias" className="btn">
              Ver barberías
            </a>
            <Link href="/registro" className="btn btn-ghost">
              Registrar mi barbería
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            Panel de la demo:{" "}
            <Link href="/admin/barberia-demo" className="underline underline-offset-4">
              /admin/barberia-demo
            </Link>{" "}
            · PIN 1234
          </p>
        </div>

        <ol className="grid gap-3">
          {[
            ["01", "El cliente reserva", "Elige servicio, barbero y hora desde tu enlace."],
            ["02", "Recibe su QR", "Con los datos de la cita, listo para guardar en el celular."],
            ["03", "Lo escaneas al llegar", "Confirmas la llegada y la ves en tu agenda."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-4 rounded-2xl border border-line bg-card p-5">
              <span className="font-display text-2xl text-brass">{n}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="barberias" className="border-t border-line bg-card/40">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-ink">Directorio</p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">Elige tu barbería</h2>
          <p className="mt-2 text-muted">Toca una para ver sus servicios, barberos y horarios libres.</p>

          <Suspense fallback={<DirectorySkeleton />}>
            <Directory />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

function DirectorySkeleton() {
  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="h-40 animate-pulse rounded-2xl border border-line bg-card" />
      ))}
    </ul>
  );
}

async function Directory() {
  const shops = await listShops();

  if (shops.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-line bg-card p-8 text-center">
        <p className="font-semibold">Todavía no hay barberías registradas.</p>
        <p className="mt-1 text-sm text-muted">¿Tienes una? Súbela y recibe reservas hoy mismo.</p>
        <Link href="/registro" className="btn mt-6">
          Registrar mi barbería
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
      {shops.map((shop) => (
        <ShopTile key={shop.slug} shop={shop} />
      ))}
    </ul>
  );
}

function ShopTile({ shop }: { shop: ShopCard }) {
  return (
    <li>
      <Link
        href={`/b/${shop.slug}`}
        className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl leading-tight tracking-tight">{shop.name}</h3>
          {shop.priceFrom !== null && (
            <span className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-brass-ink">
              desde {formatPrice(shop.priceFrom)}
            </span>
          )}
        </div>

        {shop.address && <p className="mt-1 text-sm text-muted">{shop.address}</p>}

        <p className="mt-3 text-sm text-muted">
          {formatWorkDays(shop.workDays)} · {shop.openTime}–{shop.closeTime}
        </p>

        {shop.services.length > 0 && (
          <p className="mt-3 line-clamp-2 text-sm">{shop.services.join(" · ")}</p>
        )}

        <p className="mt-auto pt-4 text-sm font-semibold text-brass-ink group-hover:underline underline-offset-4">
          Reservar · {shop.barbers} {shop.barbers === 1 ? "barbero" : "barberos"}
        </p>
      </Link>
    </li>
  );
}
