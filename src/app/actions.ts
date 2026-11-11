"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { mutate, newId, readDb } from "@/lib/db";
import { clearAdminSession, hashPin, isAdmin, setAdminSession } from "@/lib/auth";
import { availableSlots, freeBarbers } from "@/lib/slots";
import { isValidDate, isValidTime, toMin } from "@/lib/time";
import type { AppointmentStatus, Shop } from "@/lib/types";

export type FormState = { error?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// ---------- Registro de barbería ----------

export async function registerShop(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const slug = slugify(str(fd, "slug") || name);
  const address = str(fd, "address");
  const phone = str(fd, "phone");
  const pin = str(fd, "pin");
  const openTime = str(fd, "openTime");
  const closeTime = str(fd, "closeTime");
  const workDays = fd.getAll("workDays").map(Number).filter((n) => n >= 0 && n <= 6);

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
      id: newId(),
      name: n.slice(0, 60),
      durationMin: Math.min(240, Math.max(15, Number(d) || 30)),
      price: Math.max(0, Number(p) || 0),
    }));
  const barbers = str(fd, "barbers")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((n) => ({ id: newId(), name: n.slice(0, 40) }));

  if (services.length === 0) return { error: "Agrega al menos un servicio." };
  if (barbers.length === 0) return { error: "Agrega al menos un barbero." };

  const created = await mutate((db) => {
    if (db.shops.some((s) => s.slug === slug)) return null;
    const shop: Shop = {
      id: newId(),
      slug,
      name: name.slice(0, 80),
      address: address.slice(0, 120),
      phone: phone.slice(0, 30),
      pinHash: hashPin(pin),
      openTime,
      closeTime,
      workDays: [...new Set(workDays)].sort(),
      services,
      barbers,
      createdAt: new Date().toISOString(),
    };
    db.shops.push(shop);
    return shop;
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

export async function bookAppointment(input: BookingInput): Promise<BookingResult> {
  const name = String(input.name ?? "").trim().slice(0, 60);
  const phone = String(input.phone ?? "").trim().slice(0, 25);
  if (name.length < 2) return { ok: false, error: "Escribe tu nombre." };
  if (phone.replace(/\D/g, "").length < 7) return { ok: false, error: "Escribe un teléfono válido." };
  if (!isValidDate(input.date) || !isValidTime(input.time))
    return { ok: false, error: "Fecha u hora no válida." };

  const result = await mutate<BookingResult>((db) => {
    const shop = db.shops.find((s) => s.slug === input.slug);
    if (!shop) return { ok: false, error: "Barbería no encontrada." };
    const service = shop.services.find((s) => s.id === input.serviceId);
    if (!service) return { ok: false, error: "Servicio no encontrado." };

    const slots = availableSlots(shop, db.appointments, input.date, service.id, input.barberId, new Date());
    if (!slots.includes(input.time))
      return { ok: false, error: "Ese horario se acaba de ocupar. Elige otro, por favor." };

    let barberId = input.barberId;
    if (barberId === "any") {
      const free = freeBarbers(shop, db.appointments, input.date, toMin(input.time), service.durationMin);
      // Asigna al barbero con menos citas ese día.
      const load = (id: string) =>
        db.appointments.filter((a) => a.barberId === id && a.date === input.date && a.status !== "cancelada")
          .length;
      barberId = free.sort((a, b) => load(a) - load(b))[0];
    }

    const id = newId();
    db.appointments.push({
      id,
      shopId: shop.id,
      serviceId: service.id,
      barberId,
      date: input.date,
      time: input.time,
      customerName: name,
      customerPhone: phone,
      status: "confirmada",
      createdAt: new Date().toISOString(),
    });
    return { ok: true, id };
  });

  if (result.ok) revalidatePath(`/admin/${input.slug}`);
  return result;
}

export async function cancelByCustomer(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await mutate((db) => {
    const shop = db.shops.find((s) => s.slug === slug);
    const a = db.appointments.find((x) => x.id === id && x.shopId === shop?.id);
    if (a && a.status === "confirmada") a.status = "cancelada";
  });
  revalidatePath(`/b/${slug}/cita/${id}`);
  revalidatePath(`/admin/${slug}`);
}

// ---------- Panel de administración ----------

export async function adminLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const db = await readDb();
  const shop = db.shops.find((s) => s.slug === slug);
  if (!shop || shop.pinHash !== hashPin(str(fd, "pin"))) return { error: "PIN incorrecto." };
  await setAdminSession(shop);
  // Si venía de escanear un QR, vuelve a esa cita.
  const next = str(fd, "next");
  redirect(next.startsWith(`/admin/${slug}/`) ? next : `/admin/${slug}`);
}

/** Marca que el cliente llegó (al escanear su QR en la barbería). */
export async function checkInAppointment(fd: FormData) {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const id = str(fd, "id");
  await mutate((db) => {
    const a = db.appointments.find((x) => x.id === id && x.shopId === shop.id);
    if (a && a.status === "confirmada" && !a.checkedInAt) a.checkedInAt = new Date().toISOString();
  });
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/b/${slug}/cita/${id}`);
}

/** Busca una cita por el código corto que aparece bajo el QR. */
export async function findByCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const code = str(fd, "code").replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (code.length < 6) return { error: "El código tiene 6 caracteres." };
  const db = await readDb();
  const a = db.appointments.find(
    (x) => x.shopId === shop.id && x.id.replace(/-/g, "").startsWith(code),
  );
  if (!a) return { error: "No hay ninguna cita con ese código." };
  redirect(`/admin/${slug}/checkin/${a.id}`);
}

export async function adminLogout(fd: FormData) {
  const slug = str(fd, "slug");
  await clearAdminSession(slug);
  redirect(`/admin/${slug}`);
}

async function requireAdmin(slug: string) {
  const db = await readDb();
  const shop = db.shops.find((s) => s.slug === slug);
  if (!shop || !(await isAdmin(shop))) throw new Error("No autorizado");
  return shop;
}

export async function setAppointmentStatus(fd: FormData) {
  const slug = str(fd, "slug");
  const shop = await requireAdmin(slug);
  const status = str(fd, "status") as AppointmentStatus;
  if (!["confirmada", "completada", "cancelada"].includes(status)) return;
  const id = str(fd, "id");
  await mutate((db) => {
    const a = db.appointments.find((x) => x.id === id && x.shopId === shop.id);
    if (a) a.status = status;
  });
  revalidatePath(`/admin/${slug}`);
}

async function editShop(fd: FormData, fn: (shop: Shop) => void) {
  const slug = str(fd, "slug");
  const { id } = await requireAdmin(slug);
  await mutate((db) => {
    const shop = db.shops.find((s) => s.id === id);
    if (shop) fn(shop);
  });
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/b/${slug}`);
}

export async function addService(fd: FormData) {
  const name = str(fd, "name").slice(0, 60);
  if (!name) return;
  await editShop(fd, (shop) => {
    shop.services.push({
      id: newId(),
      name,
      durationMin: Math.min(240, Math.max(15, Number(str(fd, "durationMin")) || 30)),
      price: Math.max(0, Number(str(fd, "price")) || 0),
    });
  });
}

export async function removeService(fd: FormData) {
  const id = str(fd, "id");
  await editShop(fd, (shop) => {
    if (shop.services.length > 1) shop.services = shop.services.filter((s) => s.id !== id);
  });
}

export async function addBarber(fd: FormData) {
  const name = str(fd, "name").slice(0, 40);
  if (!name) return;
  await editShop(fd, (shop) => {
    shop.barbers.push({ id: newId(), name });
  });
}

export async function removeBarber(fd: FormData) {
  const id = str(fd, "id");
  await editShop(fd, (shop) => {
    if (shop.barbers.length > 1) shop.barbers = shop.barbers.filter((b) => b.id !== id);
  });
}

export async function updateHours(fd: FormData) {
  const openTime = str(fd, "openTime");
  const closeTime = str(fd, "closeTime");
  const workDays = fd.getAll("workDays").map(Number).filter((n) => n >= 0 && n <= 6);
  if (!isValidTime(openTime) || !isValidTime(closeTime) || toMin(openTime) >= toMin(closeTime)) return;
  if (workDays.length === 0) return;
  await editShop(fd, (shop) => {
    shop.openTime = openTime;
    shop.closeTime = closeTime;
    shop.workDays = [...new Set(workDays)].sort();
  });
}
