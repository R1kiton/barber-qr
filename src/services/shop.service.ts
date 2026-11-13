/**
 * Barberías y su catálogo (servicios y barberos).
 *
 * Servicios y barberos no tienen servicio propio: no existen fuera de una
 * barbería y siempre se consultan con su `shopId`, así que viven aquí como
 * operaciones sobre el catálogo de la barbería.
 */
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PublicShop, Shop, ShopCard } from "@/lib/types";
import { hashPin } from "@/lib/auth";
import { isWeeklyHours } from "@/lib/hours";
import type { WeeklyHours } from "@/lib/types";
import { isUniqueViolation } from "./db-errors";
import { isUuid, shopCardSelect, shopWithCatalog, toShop, toShopCard } from "./mappers";

const DEMO_SLUG = "barberia-demo";

export type NewShop = Omit<Shop, "id" | "createdAt" | "services" | "barbers"> & {
  services: { name: string; durationMin: number; price: number }[];
  barbers: { name: string }[];
};

// ---------- Lectura ----------

export async function getBySlug(slug: string): Promise<Shop | undefined> {
  await connection();
  const row = await prisma().shop.findUnique({ where: { slug }, ...shopWithCatalog });
  if (row) return toShop(row);

  // La barbería de demostración se crea sola la primera vez que alguien la visita.
  if (slug === DEMO_SLUG) {
    await createDemo();
    const retry = await prisma().shop.findUnique({ where: { slug }, ...shopWithCatalog });
    return retry ? toShop(retry) : undefined;
  }
  return undefined;
}

/** Directorio público: solo lo que se enseña en una tarjeta, sin datos sensibles. */
export async function listCards(): Promise<ShopCard[]> {
  await connection();
  const rows = await prisma().shop.findMany({ orderBy: { createdAt: "asc" }, ...shopCardSelect });
  return rows.map(toShopCard);
}

/** Quita el hash del PIN antes de que la barbería viaje al navegador. */
export function toPublic(shop: Shop): PublicShop {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pinHash, ...rest } = shop;
  return rest;
}

// ---------- Escritura ----------

/** Crea la barbería con su catálogo. Devuelve `null` si el enlace ya está ocupado. */
export async function create(input: NewShop): Promise<Shop | null> {
  try {
    // Creación anidada a propósito: o entra todo o no entra nada. Con inserts
    // sueltos, un fallo a mitad dejaba una barbería sin servicios ni barberos.
    await prisma().shop.create({
      data: {
        slug: input.slug,
        name: input.name,
        address: input.address,
        phone: input.phone,
        pinHash: input.pinHash,
        openTime: input.openTime,
        closeTime: input.closeTime,
        workDays: input.workDays,
        services: {
          create: input.services.map((s) => ({
            name: s.name,
            durationMin: s.durationMin,
            price: s.price,
          })),
        },
        barbers: { create: input.barbers.map((b) => ({ name: b.name })) },
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return null;
    throw e;
  }
  return (await getBySlug(input.slug)) ?? null;
}

export async function updateHours(
  shopId: string,
  weeklyHours: WeeklyHours,
): Promise<void> {
  if (!isWeeklyHours(weeklyHours)) throw new Error("Horario no válido");
  const workDays = weeklyHours.flatMap((hours, day) => hours ? [day] : []);
  const firstOpen = weeklyHours.find((hours) => hours !== null);
  await prisma().shop.update({
    where: { id: shopId },
    data: {
      weeklyHours,
      workDays,
      ...(firstOpen ? { openTime: firstOpen.openTime, closeTime: firstOpen.closeTime } : {}),
    },
  });
}

// ---------- Catálogo ----------

export async function addService(
  shopId: string,
  service: { name: string; durationMin: number; price: number },
): Promise<void> {
  await prisma().service.create({
    data: {
      shopId,
      name: service.name,
      durationMin: service.durationMin,
      price: service.price,
    },
  });
}

export async function removeService(shopId: string, id: string): Promise<void> {
  if (!isUuid(id)) return;
  // `deleteMany` con el shopId: nadie puede borrar el servicio de otra barbería.
  await prisma().service.deleteMany({ where: { id, shopId } });
}

export async function addBarber(shopId: string, name: string): Promise<void> {
  await prisma().barber.create({ data: { shopId, name } });
}

export async function removeBarber(shopId: string, id: string): Promise<void> {
  if (!isUuid(id)) return;
  await prisma().barber.deleteMany({ where: { id, shopId } });
}

// ---------- Demo ----------

async function createDemo(): Promise<void> {
  await create({
    slug: DEMO_SLUG,
    name: "Barbería Demo",
    address: "Av. Principal 123",
    phone: "555 123 4567",
    pinHash: hashPin("1234"),
    openTime: "09:00",
    closeTime: "19:00",
    workDays: [1, 2, 3, 4, 5, 6],
    services: [
      { name: "Corte clásico", durationMin: 30, price: 150 },
      { name: "Fade / degradado", durationMin: 45, price: 180 },
      { name: "Arreglo de barba", durationMin: 30, price: 120 },
      { name: "Corte + barba", durationMin: 60, price: 250 },
    ],
    barbers: [{ name: "Carlos" }, { name: "Miguel" }],
  });
}
