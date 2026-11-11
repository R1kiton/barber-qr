import { Suspense } from "react";
import Link from "next/link";
import ShopTile from "@/components/ShopTile";
import SiteHeader from "@/components/SiteHeader";
import { listShops } from "@/lib/db";

export const metadata = {
  title: "Barberías · BarberQR",
  description: "Todas las barberías que reciben reservas con BarberQR.",
};

export default function BarberiasPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-ink">Directorio</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">Todas las barberías</h1>
          <p className="mt-2 text-muted">Elige una para ver sus servicios, barberos y horarios libres.</p>

          <Suspense fallback={<GridSkeleton />}>
            <Grid />
          </Suspense>
        </div>
      </main>
    </>
  );
}

function GridSkeleton() {
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="h-48 animate-pulse rounded-2xl border border-line bg-card" />
      ))}
    </ul>
  );
}

async function Grid() {
  const shops = await listShops();

  if (shops.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-line bg-card p-10 text-center">
        <p className="font-semibold">Todavía no hay barberías registradas.</p>
        <Link href="/registro" className="btn mt-6">
          Registrar mi barbería
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shops.map((shop) => (
        <ShopTile key={shop.slug} shop={shop} />
      ))}
    </ul>
  );
}
