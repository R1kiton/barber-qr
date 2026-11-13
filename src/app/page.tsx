import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import ClientsCarousel from "@/components/ClientsCarousel";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import * as shops from "@/services/shop.service";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="inicio" className="flex-1">
        <Hero />
        <Clients />
        <ForBarbershops />
      </main>
      <SiteFooter />
    </>
  );
}

/* ---------- 1. Eslogan sobre la foto ---------- */

function Hero() {
  return (
    <section className="relative isolate flex min-h-svh items-center justify-center overflow-hidden">
      <Image
        src="/hero-barberia.jpg"
        alt="Barbero cortando el cabello a un cliente con tijera y peine"
        fill
        priority
        sizes="100vw"
        className="hero-photo -z-10 object-cover"
      />
      {/* Capa oscura para destacar el eslogan sin desenfocar la foto. */}
      <div className="hero-scrim absolute inset-0 -z-10" />

      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Reserva, escanea
          <br />
          <em className="text-brass">y disfruta.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-md text-balance text-muted sm:text-lg">
          Encuentra tu barbería, elige barbero y hora, y preséntate con el código QR de tu cita.
        </p>
      </div>
    </section>
  );
}

/* ---------- 2. Nuestros clientes ---------- */

function Clients() {
  return (
    <section id="clientes" className="flex min-h-svh items-center py-20">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-ink">Directorio</p>
          <h2 className="mt-2 font-display text-4xl tracking-tight">Nuestros clientes</h2>
        </div>

        <Suspense fallback={<CarouselSkeleton />}>
          <ClientsTrack />
        </Suspense>
      </div>
    </section>
  );
}

function CarouselSkeleton() {
  return (
    <div className="-mx-5 mt-10 flex gap-4 overflow-hidden px-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-44 w-64 shrink-0 animate-pulse rounded-2xl border border-line bg-card sm:w-72" />
      ))}
    </div>
  );
}

async function ClientsTrack() {
  const cards = await shops.listCards();

  if (cards.length === 0) {
    return (
      <p className="mt-10 text-center text-muted">
        Todavía no hay barberías registradas. La tuya puede ser la primera.
      </p>
    );
  }

  return (
    <>
      <ClientsCarousel shops={cards} />
      <div className="mt-8 text-center">
        <Link href="/barberias" className="btn btn-ghost btn-sm">
          Ver todas
        </Link>
      </div>
    </>
  );
}

/* ---------- 3. Registro de barberías ---------- */

function ForBarbershops() {
  return (
    <section id="para-barberias" style={{ scrollMarginTop: 0 }} className="flex min-h-svh items-center border-t border-line py-24">
      <div className="mx-auto w-full max-w-2xl px-5 text-center">
        <h2 className="font-display text-4xl tracking-tight">
          ¡Te ayudamos <em className="text-brass">a crecer</em> !
        </h2>
        <p className="mt-5 text-balance text-muted">
          Publica tu barbería, recibe reservas desde tu propio enlace y lleva la agenda del día en un
          panel. Cada cliente llega con un código QR: lo escaneas y su llegada queda confirmada.
        </p>
        <Link href="/registro" className="btn mt-9">
          Registrar mi barbería
        </Link>
      </div>
    </section>
  );
}
