"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as shops from "@/services/shop.service";
import * as appointments from "@/services/appointment.service";
import { clearAdminSession, isAdmin, setAdminSession, verifyPassword, allowAuthAttempt } from "@/lib/auth";
import { beginRegistration } from "@/services/registration.service";
import { prisma } from "@/lib/prisma";
import { availableSlots, freeBarbers } from "@/lib/slots";
import { isValidDate, isValidTime, toMin } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";
import type { WeeklyHours } from "@/lib/types";
import { DAY_LONG } from "@/lib/time";

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
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return { error: "Escribe un correo válido." };
  if (password.length < 12 || password.length > 128)
    return { error: "La contraseña debe tener entre 12 y 128 caracteres." };
  if (password !== String(fd.get("confirmPassword") ?? ""))
    return { error: "Las contraseñas no coinciden." };
  const openTime = str(fd, "openTime");
  const closeTime = str(fd, "closeTime");
  const workDays = parseDays(fd);

  if (name.length < 2) return { error: "Escribe el nombre de la barbería." };
  if (slug.length < 3) return { error: "El enlace debe tener al menos 3 caracteres." };
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

  const error = await beginRegistration(email, password, {
    slug,
    name: name.slice(0, 80),
    address: str(fd, "address").slice(0, 120),
    phone: str(fd, "phone").slice(0, 30),
    openTime,
    closeTime,
    workDays,
    services,
    barbers,
  });
  if (error) return { error };
  redirect("/registro/verificar");
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

  const shop = await shops.getBySlug(input.slug);
  if (!shop) return { ok: false, error: "Barbería no encontrada." };
  const service = shop.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "Servicio no encontrado." };

  const appts = await appointments.listByDateRange(shop.id, { from: input.date, to: input.date });
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
    const res = await appointments.book({
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
  const shop = await shops.getBySlug(slug);
  if (!shop) return;
  await appointments.setStatus(shop.id, id, "cancelada", "confirmada");
  revalidatePath(`/b/${slug}/cita/${id}`);
  revalidatePath(`/admin/${slug}`);
}

// ---------- Panel de administración ----------

export async function adminLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (email.length > 254 || password.length > 128 || !email || !password)
    return { error: "Correo o contraseña incorrectos." };
  if (!(await allowAuthAttempt("login", email, 8, 900)))
    return { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." };
  const shop = await prisma().shop.findUnique({ where: { ownerEmail: email } });
  const valid = await verifyPassword(password, shop?.passwordHash ?? null);
  if (!valid || !shop?.emailVerifiedAt) return { error: "Correo o contraseña incorrectos." };
  await setAdminSession(shop);
  const next = str(fd, "next");
  const safeNext = new RegExp(`^/admin/${shop.slug}/checkin/[a-f0-9-]{36}$`, "i").test(next);
  redirect(safeNext ? next : `/admin/${shop.slug}`);
}

export async function adminLogout() {
  await clearAdminSession();
  redirect("/login");
}

async function requireAdmin(slug: string) {
  const shop = await shops.getBySlug(slug);
  if (!shop || !(await isAdmin(shop))) throw new Error("No autorizado");
  return shop;
}

export async function setAppointmentStatus(fd: FormData) {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const status = str(fd, "status") as AppointmentStatus;
  if (!["confirmada", "completada", "cancelada"].includes(status)) return;
  await appointments.setStatus(shop.id, str(fd, "id"), status);
  revalidatePath(`/admin/${slug}`);
}

/** Marca que el cliente llegó (al escanear su QR en la barbería). */
export async function checkInAppointment(fd: FormData) {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const id = str(fd, "id");
  await appointments.markCheckedIn(shop.id, id);
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/b/${slug}/cita/${id}`);
}

/** Busca una cita por el código corto que aparece bajo el QR. */
export async function findByCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const code = str(fd, "code").replace(/[^a-z0-9]/gi, "");
  if (code.length !== 6) return { error: "El código tiene 6 caracteres." };
  const a = await appointments.findByCode(shop.id, code);
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
    shops.addService(shopId, {
      name,
      durationMin: Math.min(240, Math.max(15, Number(str(fd, "durationMin")) || 30)),
      price: Math.max(0, Number(str(fd, "price")) || 0),
    }),
  );
}

export async function removeService(fd: FormData) {
  await adminEdit(fd, async (shopId, shop) => {
    if (shop.services.length > 1) await shops.removeService(shopId, str(fd, "id"));
  });
}

export async function addBarber(fd: FormData) {
  const name = str(fd, "name").slice(0, 40);
  if (!name) return;
  await adminEdit(fd, (shopId) => shops.addBarber(shopId, name));
}

export async function removeBarber(fd: FormData) {
  await adminEdit(fd, async (shopId, shop) => {
    if (shop.barbers.length > 1) await shops.removeBarber(shopId, str(fd, "id"));
  });
}

export async function updateHours(_prev: { error?: string; success?: boolean }, fd: FormData): Promise<{ error?: string; success?: boolean }> {
  const shop = await requireAdmin(str(fd, "slug"));
  const weeklyHours: WeeklyHours = [];
  for (let day = 0; day < 7; day++) {
    if (fd.get(`enabled-${day}`) !== "on") {
      weeklyHours.push(null);
      continue;
    }
    const openTime = str(fd, `open-${day}`);
    const closeTime = str(fd, `close-${day}`);
    if (!isValidTime(openTime) || !isValidTime(closeTime) || toMin(openTime) >= toMin(closeTime))
      return { error: `${DAY_LONG[day]}: la apertura debe ser antes del cierre.` };
    weeklyHours.push({ openTime, closeTime });
  }
  await shops.updateHours(shop.id, weeklyHours);
  for (const path of [`/admin/${shop.slug}`, `/b/${shop.slug}`, "/barberias", "/"])
    revalidatePath(path);
  return { success: true };
}
