import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getShop, toPublic } from "@/lib/db";
import { localDateStr } from "@/lib/time";
import BookingWizard from "./BookingWizard";

export default function ShopPage({ params }: PageProps<"/b/[slug]">) {
  return (
    <main className="flex-1">
      <div className="pole" />
      <Suspense fallback={<p className="p-8 text-center text-muted">Cargando…</p>}>
        <ShopContent params={params} />
      </Suspense>
    </main>
  );
}

async function ShopContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) notFound();

  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-16">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-ink">Reserva tu cita</p>
        <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight">{shop.name}</h1>
        {(shop.address || shop.phone) && (
          <p className="mt-1 text-sm text-muted">
            {[shop.address, shop.phone].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>
      <BookingWizard shop={toPublic(shop)} today={localDateStr(new Date())} />
    </div>
  );
}
