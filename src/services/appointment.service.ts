/**
 * Citas.
 *
 * El solapamiento no se comprueba aquí: lo impide la restricción `exclude` de
 * la base. Dos clientes pueden pulsar "reservar" en el mismo milisegundo y solo
 * uno entra. Este servicio se limita a traducir ese rechazo a un resultado.
 */
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { toMin } from "@/lib/time";
import { isExclusionViolation } from "./db-errors";
import { fromDateString, isUuid, toAppointment } from "./mappers";

export type NewAppointment = {
  shopId: string;
  serviceId: string;
  barberId: string;
  serviceName: string;
  price: number;
  durationMin: number;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
};

/** `conflict` significa que el barbero acaba de quedar ocupado a esa hora. */
export type BookResult = { ok: true; id: string } | { ok: false; conflict: true };

// ---------- Lectura ----------

export async function listByDateRange(
  shopId: string,
  range: { from: string; to: string },
): Promise<Appointment[]> {
  await connection();
  const rows = await prisma().appointment.findMany({
    where: { shopId, date: { gte: fromDateString(range.from), lte: fromDateString(range.to) } },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  return rows.map(toAppointment);
}

export async function getById(shopId: string, id: string): Promise<Appointment | undefined> {
  await connection();
  if (!isUuid(id)) return undefined;
  // El shopId va en el where: una barbería no puede leer las citas de otra.
  const row = await prisma().appointment.findFirst({ where: { id, shopId } });
  return row ? toAppointment(row) : undefined;
}

/** Busca por el código corto que aparece bajo el QR del cliente. */
export async function findByCode(shopId: string, code: string): Promise<Appointment | undefined> {
  const row = await prisma().appointment.findFirst({
    where: { shopId, code: code.toUpperCase() },
    orderBy: { createdAt: "desc" },
  });
  return row ? toAppointment(row) : undefined;
}

// ---------- Escritura ----------

export async function book(input: NewAppointment): Promise<BookResult> {
  const startMin = toMin(input.time);
  try {
    const row = await prisma().appointment.create({
      data: {
        shopId: input.shopId,
        serviceId: input.serviceId,
        barberId: input.barberId,
        serviceName: input.serviceName,
        price: input.price,
        date: fromDateString(input.date),
        time: input.time,
        startMin,
        endMin: startMin + input.durationMin,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch (e) {
    if (isExclusionViolation(e)) return { ok: false, conflict: true };
    throw e;
  }
}

/**
 * Cambia el estado. Con `onlyFrom` solo lo cambia si está en ese estado, lo que
 * evita, por ejemplo, cancelar una cita ya completada.
 *
 * Devuelve `false` si reabrir la cita chocaría con otra que ya ocupó el hueco.
 */
export async function setStatus(
  shopId: string,
  id: string,
  status: AppointmentStatus,
  onlyFrom?: AppointmentStatus,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  try {
    await prisma().appointment.updateMany({
      where: { id, shopId, ...(onlyFrom ? { status: onlyFrom } : {}) },
      data: { status },
    });
    return true;
  } catch (e) {
    if (isExclusionViolation(e)) return false;
    throw e;
  }
}

/** Marca que el cliente llegó. Idempotente: solo escribe si aún no estaba marcada. */
export async function markCheckedIn(shopId: string, id: string): Promise<void> {
  if (!isUuid(id)) return;
  await prisma().appointment.updateMany({
    where: { id, shopId, status: "confirmada", checkedInAt: null },
    data: { checkedInAt: new Date() },
  });
}
