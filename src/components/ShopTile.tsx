import Link from "next/link";
import { formatPrice, formatWorkDays } from "@/lib/time";
import type { ShopCard } from "@/lib/types";

/** Tarjeta de barbería para la rejilla de /barberias. */
export default function ShopTile({ shop }: { shop: ShopCard }) {
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

        <p className="mt-auto pt-4 text-sm font-semibold text-brass-ink underline-offset-4 group-hover:underline">
          Reservar · {shop.barbers} {shop.barbers === 1 ? "barbero" : "barberos"}
        </p>
      </Link>
    </li>
  );
}
