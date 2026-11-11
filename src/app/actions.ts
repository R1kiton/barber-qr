"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as db from "@/lib/db";
import { clearAdminSession, hashPin, isAdmin, setAdminSession } from "@/lib/auth";
import { availableSlots, freeBarbers } from "@/lib/slots";
import { isValidDate, isValidTime, toMin } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";

export type FormState = { error?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

const parseDays = (fd: FormData) =>
  [...new Set(fd.getAll("workDays").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();

// ---------- Registro de barbería ----------

export async function registerShop(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const slug = slugify(str(fd, "slug") || name);
  const pin = str(fd, "pin");
  const openTime = str(fd, "openTime");
  const closeTime = str(fd, "closeTime");
  const workDays = parseDays(fd);

  if (name.length < 2) return { error: "Escribe el nombre de la barbería." };
  if (slug.length < 3) return { error: "El enlace debe tener al menos 3 caracteres." };
  if (!/^\d{4,8}$/.test(pin)) return { error: "El PIN debe tener entre 4 y 8 dígitos." };
  if (!isValidTime(openTime) || !isValidTime(closeTime) || toMin(openTime) >= toMin(closeTime))
    return { error: "Revisa el horario: la apertura debe ser antes del cierre." };
  if (workDays.length === 0) return { error: "Elige al menos un día de trabajo." };

  const services = str(fd, "services")
    .split("\n")
    .map((l) => l.split("|").map((p) => p.trim()))
    .filter((p) => p[0])
    .map(([n, d, p]) => ({
      name: n.slice(0, 60),
      durationMin: Math.min(240, Math.max(15, Number(d) || 30)),
      price: Math.max(0, Number(p) || 0),
    }));
  const barbers = str(fd, "barbers")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((n) => ({ name: n.slice(0, 40) }));

  if (services.length === 0) return { error: "Agrega al menos un servicio." };
  if (barbers.length === 0) return { error: "Agrega al menos un barbero." };

  const created = await db.createShop({
    slug,
    name: name.slice(0, 80),
    address: str(fd, "address").slice(0, 120),
    phone: str(fd, "phone").slice(0, 30),
    pinHash: hashPin(pin),
    openTime,
    closeTime,
    workDays,
    services,
    barbers,
  });
  if (!created) return { error: `El enlace “${slug}” ya está en uso. Prueba otro.` };

  await setAdminSession(created);
  redirect(`/admin/${slug}`);
}

// ---------- Reservas (clientes) ----------

export type BookingInput = {
  slug: string;
  serviceId: string;
  barberId: string; // o "any"
  date: string;
  time: string;
  name: string;
  phone: string;
};

export type BookingResult = { ok: true; id: string } | { ok: false; error: string };

const TAKEN = "Ese horario se acaba de ocupar. Elige otro, por favor.";

export async function bookAppointment(input: BookingInput): Promise<BookingResult> {
  const name = String(input.name ?? "").trim().slice(0, 60);
  const phone = String(input.phone ?? "").trim().slice(0, 25);
  if (name.length < 2) return { ok: false, error: "Escribe tu nombre." };
  if (phone.replace(/\D/g, "").length < 7) return { ok: false, error: "Escribe un teléfono válido." };
  if (!isValidDate(input.date) || !isValidTime(input.time))
    return { ok: false, error: "Fecha u hora no válida." };

  const shop = await db.getShop(input.slug);
  if (!shop) return { ok: false, error: "Barbería no encontrada." };
  const service = shop.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "Servicio no encontrado." };

  const appts = await db.listAppointments(shop.id, { from: input.date, to: input.date });
  const slots = availableSlots(shop, appts, input.date, service.id, input.barberId, new Date());
  if (!slots.includes(input.time)) return { ok: false, error: TAKEN };

  // Barberos a intentar: el elegido, o los libres ordenados por menos citas ese día.
  let candidates = [input.barberId];
  if (input.barberId === "any") {
    const load = (id: string) => appts.filter((a) => a.barberId === id && a.status !== "cancelada").length;
    candidates = freeBarbers(shop, appts, input.date, toMin(input.time), service.durationMin).sort(
      (a, b) => load(a) - load(b),
    );
  }

  // La base de datos rechaza solapamientos; si otro cliente ganó el hueco, probamos el siguiente barbero.
  for (const barberId of candidates) {
    const res = await db.insertAppointment({
      shopId: shop.id,
      serviceId: service.id,
      barberId,
      serviceName: service.name,
      price: service.price,
      durationMin: service.durationMin,
      date: input.date,
      time: input.time,
      customerName: name,
      customerPhone: phone,
    });
    if (res.ok) {
      revalidatePath(`/admin/${input.slug}`);
      return { ok: true, id: res.id };
    }
  }
  return { ok: false, error: TAKEN };
}

export async function cancelByCustomer(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  const shop = await db.getShop(slug);
  if (!shop) return;
  await db.setAppointmentStatus(shop.id, id, "cancelada", "confirmada");
  revalidatePath(`/b/${slug}/cita/${id}`);
  revalidatePath(`/admin/${slug}`);
}

// ---------- Panel de administración ----------

export async function adminLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const shop = await db.getShop(slug);
  if (!shop || shop.pinHash !== hashPin(str(fd, "pin"))) return { error: "PIN incorrecto." };
  await setAdminSession(shop);
  // Si venía de escanear un QR, vuelve a esa cita.
  const next = str(fd, "next");
  redirect(next.startsWith(`/admin/${slug}/`) ? next : `/admin/${slug}`);
}

export async function adminLogout(fd: FormData) {
  const slug = str(fd, "slug");
  await clearAdminSession(slug);
  redirect(`/admin/${slug}`);
}

async function requireAdmin(slug: string) {
  const shop = await db.getShop(slug);
  if (!shop || !(await isAdmin(shop))) throw new Error("No autorizado");
  return shop;
}

export async function setAppointmentStatus(fd: FormData) {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const status = str(fd, "status") as AppointmentStatus;
  if (!["confirmada", "completada", "cancelada"].includes(status)) return;
  await db.setAppointmentStatus(shop.id, str(fd, "id"), status);
  revalidatePath(`/admin/${slug}`);
}

/** Marca que el cliente llegó (al escanear su QR en la barbería). */
export async function checkInAppointment(fd: FormData) {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const id = str(fd, "id");
  await db.markCheckedIn(shop.id, id);
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/b/${slug}/cita/${id}`);
}

/** Busca una cita por el código corto que aparece bajo el QR. */
export async function findByCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const code = str(fd, "code").replace(/[^a-z0-9]/gi, "");
  if (code.length !== 6) return { error: "El código tiene 6 caracteres." };
  const a = await db.findAppointmentByCode(shop.id, code);
  if (!a) return { error: "No hay ninguna cita con ese código." };
  redirect(`/admin/${slug}/checkin/${a.id}`);
}

async function adminEdit(fd: FormData, fn: (shopId: string, shop: Awaited<ReturnType<typeof requireAdmin>>) => Promise<void>) {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  await fn(shop.id, shop);
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/b/${slug}`);
}

export async function addService(fd: FormData) {
  const name = str(fd, "name").slice(0, 60);
  if (!name) return;
  await adminEdit(fd, (shopId) =>
    db.addService(shopId, {
      name,
      durationMin: Math.min(240, Math.max(15, Number(str(fd, "durationMin")) || 30)),
      price: Math.max(0, Number(str(fd, "price")) || 0),
    }),
  );
}

export async function removeService(fd: FormData) {
  await adminEdit(fd, async (shopId, shop) => {
    if (shop.services.length > 1) await db.deleteService(shopId, str(fd, "id"));
  });
}

export async function addBarber(fd: FormData) {
  const name = str(fd, "name").slice(0, 40);
  if (!name) return;
  await adminEdit(fd, (shopId) => db.addBarber(shopId, name));
}

export async function removeBarber(fd: FormData) {
  await adminEdit(fd, async (shopId, shop) => {
    if (shop.barbers.length > 1) await db.deleteBarber(shopId, str(fd, "id"));
  });
}

export async function updateHours(fd: FormData) {
  const openTime = str(fd, "openTime");
  const closeTime = str(fd, "closeTime");
  const workDays = parseDays(fd);
  if (!isValidTime(openTime) || !isValidTime(closeTime) || toMin(openTime) >= toMin(closeTime)) return;
  if (workDays.length === 0) return;
  await adminEdit(fd, (shopId) => db.updateShopHours(shopId, { openTime, closeTime, workDays }));
}
