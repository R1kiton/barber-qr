import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppointment, getShop } from "@/lib/db";
import { cancelByCustomer } from "@/app/actions";
import { getOrigin } from "@/lib/origin";
import { qrPng, qrSvg } from "@/lib/qr";
import { formatDateLong, formatPrice } from "@/lib/time";

export default function CitaPage({ params }: PageProps<"/b/[slug]/cita/[id]">) {
  return (
    <main className="flex-1">
      <div className="pole" />
      <Suspense fallback={<p className="p-8 text-center text-muted">Cargando…</p>}>
        <CitaContent params={params} />
      </Suspense>
    </main>
  );
}

async function CitaContent({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const shop = await getShop(slug);
  const appt = shop ? await getAppointment(shop.id, id) : undefined;
  if (!shop || !appt) notFound();

  const barber = shop.barbers.find((b) => b.id === appt.barberId);
  const active = appt.status === "confirmada" && !appt.checkedInAt;
  const code = appt.code;

  // El QR abre la ficha de la cita en el panel de la barbería (requiere PIN).
  const checkInUrl = `${await getOrigin()}/admin/${slug}/checkin/${appt.id}`;
  const [svg, png] = active ? await Promise.all([qrSvg(checkInUrl), qrPng(checkInUrl)]) : ["", ""];

  const heading =
    appt.status === "cancelada"
      ? "Cita cancelada"
      : appt.status === "completada"
        ? "¡Gracias por tu visita!"
        : appt.checkedInAt
          ? "Llegada confirmada"
          : "¡Cita reservada!";
  const sub =
    appt.status === "cancelada"
      ? "Puedes reservar otro horario cuando quieras."
      : appt.status === "completada"
        ? `Esperamos verte pronto en ${shop.name}.`
        : appt.checkedInAt
          ? "Ya estás registrado. En breve te atienden."
          : "Al llegar a la barbería muestra este código QR para confirmar tu cita.";

  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-ink">{shop.name}</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">{heading}</h1>
        <p className="mt-2 text-muted">{sub}</p>
      </div>

      {/* Ticket */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-card">
        {active && (
          <div className="flex flex-col items-center border-b border-dashed border-line bg-white px-6 py-6">
            <div
              className="w-full max-w-60 [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
              role="img"
              aria-label={`Código QR de la cita ${code}`}
            />
            <p className="mt-3 text-xs text-muted">Código</p>
            <p className="font-mono text-2xl font-semibold tracking-[0.3em]">{code}</p>
          </div>
        )}
        {!active && appt.status !== "cancelada" && (
          <div className="grid place-items-center border-b border-dashed border-line py-8">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-ink text-3xl text-paper" aria-hidden>
              ✓
            </span>
          </div>
        )}

        <div className="p-5">
          <p className="font-display text-2xl first-letter:uppercase">{formatDateLong(appt.date)}</p>
          <p className="font-display text-5xl tabular-nums">{appt.time}</p>
          <dl className="mt-4 grid gap-1 text-sm">
            <Row k="Servicio" v={appt.serviceName} />
            <Row k="Barbero" v={barber?.name ?? "—"} />
            <Row k="Duración" v={`${appt.durationMin} min`} />
            <Row k="Precio" v={formatPrice(appt.price)} />
            <Row k="A nombre de" v={appt.customerName} />
            {shop.address && <Row k="Dirección" v={shop.address} />}
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {active && (
          <>
            <a href={png} download={`cita-${code}.png`} className="btn w-full">
              Guardar QR en el celular
            </a>
            <p className="text-center text-xs text-muted">
              También puedes guardar esta página o hacer captura de pantalla.
            </p>
            <form action={cancelByCustomer}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={id} />
              <button className="btn btn-ghost w-full">Cancelar cita</button>
            </form>
          </>
        )}
        <Link href={`/b/${slug}`} className={active ? "text-center text-sm underline underline-offset-4" : "btn w-full"}>
          Hacer otra reserva
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
