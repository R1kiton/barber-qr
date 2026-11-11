"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { formatPrice, formatWorkDays } from "@/lib/time";
import type { ShopCard } from "@/lib/types";

const SPEED_PX_S = 26; // avance del desplazamiento automatico
const DRAG_THRESHOLD = 6; // px antes de considerar que se arrastro y no se hizo clic

export default function ClientsCarousel({ shops }: { shops: ShopCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const dragging = useRef(false);
  const dragged = useRef(0);
  const startX = useRef(0);
  const startScroll = useRef(0);

  // Avance automatico. La pista lleva la lista duplicada: al pasar la mitad
  // restamos esa mitad y el bucle queda sin costura.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); // ignora saltos al volver de otra pestaña
      last = now;
      if (!paused.current && !dragging.current) el.scrollLeft += SPEED_PX_S * dt;
      const half = el.scrollWidth / 2;
      if (half > 0) {
        if (el.scrollLeft >= half) el.scrollLeft -= half;
        else if (el.scrollLeft < 0) el.scrollLeft += half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Arrastre con el mouse. En tactil no se toca: el scroll nativo ya lo resuelve.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    paused.current = true;
    if (e.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    dragging.current = true;
    dragged.current = 0;
    startX.current = e.clientX;
    startScroll.current = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - startX.current;
    dragged.current = Math.max(dragged.current, Math.abs(dx));
    el.scrollLeft = startScroll.current - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (dragging.current && el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    dragging.current = false;
    if (e.pointerType !== "mouse") paused.current = false; // en mouse lo reanuda pointerleave
  };

  // Si se arrastro, el clic que sigue no debe abrir la barberia.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragged.current > DRAG_THRESHOLD) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = 0;
    }
  };

  return (
    <div className="edge-fade -mx-5 mt-10 px-5">
      <div
        ref={trackRef}
        className="no-scrollbar flex cursor-grab gap-4 overflow-x-auto overscroll-x-contain pb-2 active:cursor-grabbing"
        onPointerEnter={() => (paused.current = true)}
        onPointerLeave={() => (paused.current = false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onFocusCapture={() => (paused.current = true)}
        onBlurCapture={() => (paused.current = false)}
      >
        {shops.map((shop) => (
          <ClientCard key={shop.slug} shop={shop} />
        ))}
        {/* Copia para el bucle: invisible para lectores de pantalla y fuera del tabulador. */}
        {shops.map((shop) => (
          <ClientCard key={`dup-${shop.slug}`} shop={shop} duplicate />
        ))}
      </div>
    </div>
  );
}

function ClientCard({ shop, duplicate = false }: { shop: ShopCard; duplicate?: boolean }) {
  return (
    <Link
      href={`/b/${shop.slug}`}
      draggable={false}
      aria-hidden={duplicate || undefined}
      tabIndex={duplicate ? -1 : undefined}
      className="group flex w-64 shrink-0 flex-col rounded-2xl border border-line bg-card p-5 transition hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass sm:w-72"
    >
      <h3 className="font-display text-xl leading-tight tracking-tight">{shop.name}</h3>
      {shop.address && <p className="mt-1 line-clamp-1 text-sm text-muted">{shop.address}</p>}
      <p className="mt-3 line-clamp-1 text-xs text-muted">
        {formatWorkDays(shop.workDays)} · {shop.openTime}–{shop.closeTime}
      </p>
      <p className="mt-auto flex items-center justify-between pt-4 text-sm">
        <span className="font-semibold text-brass-ink underline-offset-4 group-hover:underline">Reservar</span>
        {shop.priceFrom !== null && (
          <span className="text-xs text-muted">desde {formatPrice(shop.priceFrom)}</span>
        )}
      </p>
    </Link>
  );
}
