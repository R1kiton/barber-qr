import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import * as shops from "@/services/shop.service";
import * as appointments from "@/services/appointment.service";
import { isAdmin } from "@/lib/auth";
import { checkInAppointment } from "@/app/actions";
import { formatDateLong, formatPrice, localDateStr, toMin } from "@/lib/time";

export default function CheckInPage({ params }: PageProps<"/admin/[slug]/checkin/[id]">) {
  return (
    <main className="flex-1">
      <div className="pole" />
      <Suspense fallback={<p className="p-8 text-center text-muted">Cargando…</p>}>
        <CheckIn params={params} />
      </Suspense>
    </main>
  );
}

async function CheckIn({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const shop = await shops.getBySlug(slug);
  if (!shop) notFound();
  if (!(await isAdmin(shop)))
    redirect(`/login?next=${encodeURIComponent(`/admin/${slug}/checkin/${id}`)}`);

  const appt = await appointments.getById(shop.id, id);
  if (!appt) {
    return (
      <Message tone="bad" title="QR no válido" slug={slug}>
        Esta cita no existe o es de otra barbería.
      </Message>
    );
  }

  const barber = shop.barbers.find((b) => b.id === appt.barberId);
  const now = new Date();
  const today = localDateStr(now);
  const diffMin = toMin(appt.time) - (now.getHours() * 60 + now.getMinutes());

  // Estado y aviso según la situación de la cita.
  let tone: "ok" | "warn" | "bad" = "ok";
  let title = "Cita válida";
  let note = "";
  if (appt.status === "cancelada") {
    tone = "bad";
    title = "Cita cancelada";
    note = "Esta reserva fue cancelada y no se puede confirmar.";
  } else if (appt.status === "completada") {
    tone = "bad";
    title = "Cita ya atendida";
    note = "Este QR ya se usó.";
  } else if (appt.checkedInAt) {
    tone = "warn";
    title = "Llegada ya confirmada";
    note = `Se confirmó a las ${new Date(appt.checkedInAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}.`;
  } else if (appt.date !== today) {
    tone = "warn";
    title = appt.date < today ? "Esta cita ya pasó" : "La cita no es hoy";
    note = `Está reservada para el ${formatDateLong(appt.date)}.`;
  } else if (diffMin < -15) {
    tone = "warn";
    title = "Llega tarde";
    note = `Su cita era a las ${appt.time} (hace ${-diffMin} min).`;
  } else if (diffMin > 0) {
    note = `Llega ${diffMin} min antes de su hora.`;
  }

  const canCheckIn = appt.status === "confirmada" && !appt.checkedInAt;
  const toneStyle = {
    ok: "bg-ink text-paper",
    warn: "bg-brass text-white",
    bad: "bg-pole-red text-white",
  }[tone];

  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-16">
      <div className={`rounded-2xl p-5 ${toneStyle}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">{shop.name}</p>
        <h1 className="mt-1 font-display text-3xl">{title}</h1>
        {note && <p className="mt-1 opacity-90">{note}</p>}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-card p-5">
        <p className="font-display text-3xl">{appt.customerName}</p>
        <p className="text-sm text-muted">{appt.customerPhone}</p>
        <dl className="mt-4 grid gap-1 text-sm">
          <Row k="Fecha" v={formatDateLong(appt.date)} />
          <Row k="Hora" v={appt.time} />
          <Row k="Servicio" v={appt.serviceName} />
          <Row k="Barbero" v={barber?.name ?? "—"} />
          <Row k="Precio" v={formatPrice(appt.price)} />
          <Row k="Código" v={appt.code} />
        </dl>
      </div>

      <div className="mt-6 grid gap-3">
        {canCheckIn && (
          <form action={checkInAppointment}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={appt.id} />
            <button className="btn w-full py-4 text-lg">Confirmar llegada</button>
          </form>
        )}
        <Link href={`/admin/${slug}?fecha=${appt.date}`} className="btn btn-ghost w-full">
          Ir a la agenda
        </Link>
      </div>
    </div>
  );
}

function Message({
  title,
  children,
  slug,
}: {
  tone: "bad";
  title: string;
  children: React.ReactNode;
  slug: string;
}) {
  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-16">
      <div className="rounded-2xl bg-pole-red p-5 text-white">
        <h1 className="font-display text-3xl">{title}</h1>
        <p className="mt-1 opacity-90">{children}</p>
      </div>
      <Link href={`/admin/${slug}`} className="btn btn-ghost mt-6 w-full">
        Ir al panel
      </Link>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right first-letter:uppercase">{v}</dd>
    </div>
  );
}
