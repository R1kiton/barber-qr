import type { Appointment, Shop } from "./types";
import { localDateStr, toHHMM, toMin, weekday } from "./time";
import { hoursForDay } from "./hours";

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
          return startMin < s + a.durationMin && s < end;
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
  const hours = hoursForDay(shop, weekday(date));
  if (!hours) return [];

  const today = localDateStr(now);
  if (date < today) return [];
  const limit = new Date(now);
  limit.setDate(limit.getDate() + MAX_DAYS_AHEAD);
  if (date > localDateStr(limit)) return [];

  const nowMin = date === today ? now.getHours() * 60 + now.getMinutes() : -1;
  const open = toMin(hours.openTime);
  const close = toMin(hours.closeTime);
  const out: string[] = [];

  for (let s = open; s + service.durationMin <= close; s += SLOT_STEP_MIN) {
    if (s <= nowMin) continue;
    const free = freeBarbers(shop, appointments, date, s, service.durationMin);
    if (barberId === "any" ? free.length > 0 : free.includes(barberId)) out.push(toHHMM(s));
  }
  return out;
}
