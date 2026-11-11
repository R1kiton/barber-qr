import type { Appointment, Shop } from "./types";
import { localDateStr, toHHMM, toMin, weekday } from "./time";

export const SLOT_STEP_MIN = 30;
export const MAX_DAYS_AHEAD = 30;

/** Barberos libres para [start, start + duration) en una fecha. */
export function freeBarbers(
  shop: Shop,
  appointments: Appointment[],
  date: string,
  startMin: number,
  durationMin: number,
): string[] {
  const end = startMin + durationMin;
  return shop.barbers
    .filter(
      (b) =>
        !appointments.some((a) => {
          if (a.shopId !== shop.id || a.barberId !== b.id || a.date !== date) return false;
          if (a.status === "cancelada") return false;
          const s = toMin(a.time);
          const dur = shop.services.find((x) => x.id === a.serviceId)?.durationMin ?? SLOT_STEP_MIN;
          return startMin < s + dur && s < end;
        }),
    )
    .map((b) => b.id);
}

/** Horarios disponibles. barberId puede ser "any" (cualquier barbero). */
export function availableSlots(
  shop: Shop,
  appointments: Appointment[],
  date: string,
  serviceId: string,
  barberId: string,
  now: Date,
): string[] {
  const service = shop.services.find((s) => s.id === serviceId);
  if (!service) return [];
  if (barberId !== "any" && !shop.barbers.some((b) => b.id === barberId)) return [];
  if (!shop.workDays.includes(weekday(date))) return [];

  const today = localDateStr(now);
  if (date < today) return [];
  const limit = new Date(now);
  limit.setDate(limit.getDate() + MAX_DAYS_AHEAD);
  if (date > localDateStr(limit)) return [];

  const nowMin = date === today ? now.getHours() * 60 + now.getMinutes() : -1;
  const open = toMin(shop.openTime);
  const close = toMin(shop.closeTime);
  const out: string[] = [];

  for (let s = open; s + service.durationMin <= close; s += SLOT_STEP_MIN) {
    if (s <= nowMin) continue;
    const free = freeBarbers(shop, appointments, date, s, service.durationMin);
    if (barberId === "any" ? free.length > 0 : free.includes(barberId)) out.push(toHHMM(s));
  }
  return out;
}
