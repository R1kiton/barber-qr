/**
 * Frontera entre la base y el dominio.
 *
 * Aquí se definen las formas de consulta y se traducen las filas de Prisma a
 * los tipos de `@/lib/types`. Ningún tipo de Prisma cruza esta frontera: el
 * resto de la aplicación no sabe que detrás hay un ORM.
 */
import { Prisma } from "@/generated/prisma/client";
import { isWeeklyHours } from "@/lib/hours";
import type { Appointment as AppointmentRecord } from "@/generated/prisma/client";
import type { Appointment, AppointmentStatus, Shop, ShopCard } from "@/lib/types";

// ---------- Formas de consulta ----------

/** La barbería con su catálogo, ordenado por antigüedad. */
export const shopWithCatalog = {
  include: {
    services: { orderBy: { createdAt: "asc" } },
    barbers: { orderBy: { createdAt: "asc" } },
  },
} satisfies Prisma.ShopDefaultArgs;

/**
 * Proyección del directorio público. Columnas explícitas a propósito:
 * `pinHash` no puede salir de la base por esta vía ni por descuido.
 */
export const shopCardSelect = {
  select: {
    slug: true,
    name: true,
    address: true,
    phone: true,
    openTime: true,
    closeTime: true,
    workDays: true,
    weeklyHours: true,
    services: { select: { name: true, price: true }, orderBy: { createdAt: "asc" } },
    _count: { select: { barbers: true } },
  },
} satisfies Prisma.ShopDefaultArgs;

// Los tipos de fila se derivan de la consulta: si cambia el `select`, el
// compilador avisa en el mapeador en vez de fallar en caliente.
type ShopRow = Prisma.ShopGetPayload<typeof shopWithCatalog>;
type ShopCardRow = Prisma.ShopGetPayload<typeof shopCardSelect>;

// ---------- Conversiones de tipos escalares ----------

/** `price` es `Decimal`; `Number()` pasa por su `valueOf`. */
const toNumber = (v: unknown) => Number(v);

/**
 * Las columnas `date` son fechas sin hora, y Prisma las entrega como `Date` a
 * medianoche UTC. Se leen y escriben SIEMPRE en UTC: formatearlas con la hora
 * local correría el día un puesto en cualquier zona al oeste de Greenwich.
 */
export const toDateString = (d: Date) => d.toISOString().slice(0, 10);
export const fromDateString = (s: string) => new Date(`${s}T00:00:00.000Z`);

/**
 * Postgres aborta la consulta si recibe un uuid mal formado, así que los ids
 * que vienen de la URL se filtran antes de llegar a la base.
 */
export const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// ---------- Fila a dominio ----------

export function toShop(row: ShopRow): Shop {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    phone: row.phone,
    pinHash: row.pinHash,
    weeklyHours: isWeeklyHours(row.weeklyHours) ? row.weeklyHours : undefined,
    openTime: row.openTime,
    closeTime: row.closeTime,
    workDays: row.workDays,
    createdAt: row.createdAt.toISOString(),
    services: row.services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      price: toNumber(s.price),
    })),
    barbers: row.barbers.map((b) => ({ id: b.id, name: b.name })),
  };
}

export function toShopCard(row: ShopCardRow): ShopCard {
  const precios = row.services.map((s) => toNumber(s.price));
  return {
    weeklyHours: isWeeklyHours(row.weeklyHours) ? row.weeklyHours : undefined,
    slug: row.slug,
    name: row.name,
    address: row.address,
    phone: row.phone,
    openTime: row.openTime,
    closeTime: row.closeTime,
    workDays: row.workDays,
    barbers: row._count.barbers,
    priceFrom: precios.length ? Math.min(...precios) : null,
    services: row.services.map((s) => s.name),
  };
}

export function toAppointment(row: AppointmentRecord): Appointment {
  return {
    id: row.id,
    code: row.code,
    shopId: row.shopId,
    serviceId: row.serviceId,
    barberId: row.barberId,
    serviceName: row.serviceName,
    price: toNumber(row.price),
    durationMin: row.endMin - row.startMin,
    date: toDateString(row.date),
    time: row.time,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    status: row.status as AppointmentStatus,
    checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
