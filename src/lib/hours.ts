import type { DayHours, WeeklyHours } from "./types";
import { DAY_SHORT, formatWorkDays, isValidTime, toMin } from "./time";

type Schedule = {
  openTime: string;
  closeTime: string;
  workDays: number[];
  weeklyHours?: WeeklyHours;
};

export function isWeeklyHours(value: unknown): value is WeeklyHours {
  return Array.isArray(value) && value.length === 7 && value.every((day) =>
    day === null || (typeof day === "object" && day !== null &&
      typeof day.openTime === "string" && typeof day.closeTime === "string" &&
      isValidTime(day.openTime) && isValidTime(day.closeTime) &&
      toMin(day.openTime) < toMin(day.closeTime)),
  );
}

export function hoursForDay(shop: Schedule, day: number): DayHours | null {
  if (shop.weeklyHours) return shop.weeklyHours[day] ?? null;
  return shop.workDays.includes(day) ? { openTime: shop.openTime, closeTime: shop.closeTime } : null;
}

export function weeklyHoursFor(shop: Schedule): WeeklyHours {
  return Array.from({ length: 7 }, (_, day) => hoursForDay(shop, day));
}

/** Group days sharing a time range, so public listings never imply one universal schedule. */
export function formatSchedule(shop: Schedule): string {
  const groups = new Map<string, number[]>();
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const hours = hoursForDay(shop, day);
    if (!hours) continue;
    const range = `${hours.openTime}–${hours.closeTime}`;
    groups.set(range, [...(groups.get(range) ?? []), day]);
  }
  if (!groups.size) return "Cerrado toda la semana";
  return [...groups].map(([range, days]) =>
    `${days.length === 1 ? DAY_SHORT[days[0]] : formatWorkDays(days)} · ${range}`,
  ).join(" / ");
}
