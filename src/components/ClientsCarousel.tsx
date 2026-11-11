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

  // Arrastre con el mouse; en tactil el scroll nativo ya lo resuelve.
  //
  // Nada de setPointerCapture: capturar el puntero en la pista hace que el
  // navegador despache el `click` sobre ella y no sobre el <a>, y las tarjetas
  // dejan de abrir. Para que el arrastre sobreviva si el cursor se sale de la
  // pista, escuchamos en document mientras dura.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    paused.current = true;
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = trackRef.current;
    if (!el) return;

    dragging.current = true;
    dragged.current = 0;
    const startX = e.clientX;
    const startScroll = el.scrollLeft;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      dragged.current = Math.max(dragged.current, Math.abs(dx));
      el.scrollLeft = startScroll - dx;
      if (dragged.current > DRAG_THRESHOLD) ev.preventDefault(); // no selecciona texto
    };
    const up = () => {
      dragging.current = false;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  };

  // En tactil, al soltar se reanuda; con mouse lo reanuda pointerleave.
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") paused.current = false;
  };

  // Si se arrastro, el clic que sigue no debe abrir la barberia.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragged.current > DRAG_THRESHOLD) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragged.current = 0;
  };

  return (
    <div className="edge-fade -mx-5 mt-10 px-5">
      <div
        ref={trackRef}
        className="no-scrollbar flex cursor-grab gap-4 overflow-x-auto overscroll-x-contain pb-2 active:cursor-grabbing"
        onPointerEnter={() => (paused.current = true)}
        onPointerLeave={() => (paused.current = false)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
