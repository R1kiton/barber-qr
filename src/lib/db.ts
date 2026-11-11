import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import type { Appointment, AppointmentStatus, PublicShop, Shop, ShopCard } from "./types";
import { hashPin } from "./auth";
import { toMin } from "./time";

// Acceso a Supabase SOLO desde el servidor, con la clave secreta.
// Las tablas tienen RLS sin políticas, así que la clave pública no puede leer nada.

let client: SupabaseClient | null = null;

/** Distingue la clave pública de la secreta, el error más fácil de cometer al copiarlas. */
function keyLooksPublic(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  if (!key.startsWith("eyJ")) return false; // sb_secret_...
  try {
    // Las claves legacy son JWT: la secreta lleva role "service_role"; la anon, "anon".
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    return payload.role !== "service_role";
  } catch {
    return false;
  }
}

function sb() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      const faltan = [!url && "SUPABASE_URL", !key && "SUPABASE_SECRET_KEY"].filter(Boolean).join(" y ");
      throw new Error(
        `Falta ${faltan} en .env.local. La clave secreta está en Supabase → Project Settings → API Keys.`,
      );
    }
    if (keyLooksPublic(key)) {
      throw new Error(
        "SUPABASE_SECRET_KEY contiene una clave pública. Usa la secreta (sb_secret_… o service_role): " +
          "las tablas tienen RLS sin políticas, así que con la pública no se puede leer ni escribir nada.",
      );
    }
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// ---------- Conversión filas ⇄ tipos ----------

type ShopRow = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  pin_hash: string;
  open_time: string;
  close_time: string;
  work_days: number[];
  created_at: string;
  services?: { id: string; name: string; duration_min: number; price: number | string }[];
  barbers?: { id: string; name: string }[];
};

const toShop = (r: ShopRow): Shop => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  address: r.address,
  phone: r.phone,
  pinHash: r.pin_hash,
  openTime: r.open_time,
  closeTime: r.close_time,
  workDays: r.work_days,
  createdAt: r.created_at,
  services: (r.services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    durationMin: s.duration_min,
    price: Number(s.price),
  })),
  barbers: (r.barbers ?? []).map((b) => ({ id: b.id, name: b.name })),
});

type ApptRow = {
  id: string;
  code: string;
  shop_id: string;
  service_id: string | null;
  barber_id: string | null;
  service_name: string;
  price: number | string;
  date: string;
  time: string;
  start_min: number;
  end_min: number;
  customer_name: string;
  customer_phone: string;
  status: AppointmentStatus;
  checked_in_at: string | null;
  created_at: string;
};

const toAppt = (r: ApptRow): Appointment => ({
  id: r.id,
  code: r.code,
  shopId: r.shop_id,
  serviceId: r.service_id,
  barberId: r.barber_id,
  serviceName: r.service_name,
  price: Number(r.price),
  durationMin: r.end_min - r.start_min,
  date: r.date,
  time: r.time,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  status: r.status,
  checkedInAt: r.checked_in_at,
  createdAt: r.created_at,
});

// ---------- Barberías ----------

const DEMO_SLUG = "barberia-demo";

export async function getShop(slug: string): Promise<Shop | undefined> {
  await connection();
  const { data, error } = await sb()
    .from("shops")
    .select("*, services(*), barbers(*)")
    .eq("slug", slug)
    .order("created_at", { referencedTable: "services" })
    .order("created_at", { referencedTable: "barbers" })
    .maybeSingle<ShopRow>();
  if (error) throw error;
  if (data) return toShop(data);
  if (slug === DEMO_SLUG) {
    await createDemo();
    return getShop(slug);
  }
  return undefined;
}

export type NewShop = Omit<Shop, "id" | "createdAt" | "services" | "barbers"> & {
  services: { name: string; durationMin: number; price: number }[];
  barbers: { name: string }[];
};

/** Crea la barbería. Devuelve null si el slug ya existe. */
export async function createShop(input: NewShop): Promise<Shop | null> {
  const { data, error } = await sb()
    .from("shops")
    .insert({
      slug: input.slug,
      name: input.name,
      address: input.address,
      phone: input.phone,
      pin_hash: input.pinHash,
      open_time: input.openTime,
      close_time: input.closeTime,
      work_days: input.workDays,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  const shopId = data.id;
  const [s, b] = await Promise.all([
    sb()
      .from("services")
      .insert(
        input.services.map((x) => ({
          shop_id: shopId,
          name: x.name,
          duration_min: x.durationMin,
          price: x.price,
        })),
      ),
    sb()
      .from("barbers")
      .insert(input.barbers.map((x) => ({ shop_id: shopId, name: x.name }))),
  ]);
  if (s.error) throw s.error;
  if (b.error) throw b.error;
  return (await getShop(input.slug)) ?? null;
}

async function createDemo() {
  await createShop({
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

export async function updateShopHours(
  shopId: string,
  h: { openTime: string; closeTime: string; workDays: number[] },
) {
  const { error } = await sb()
    .from("shops")
    .update({ open_time: h.openTime, close_time: h.closeTime, work_days: h.workDays })
    .eq("id", shopId);
  if (error) throw error;
}

export async function addService(shopId: string, s: { name: string; durationMin: number; price: number }) {
  const { error } = await sb()
    .from("services")
    .insert({ shop_id: shopId, name: s.name, duration_min: s.durationMin, price: s.price });
  if (error) throw error;
}

export async function deleteService(shopId: string, id: string) {
  if (!isUuid(id)) return;
  const { error } = await sb().from("services").delete().eq("id", id).eq("shop_id", shopId);
  if (error) throw error;
}

export async function addBarber(shopId: string, name: string) {
  const { error } = await sb().from("barbers").insert({ shop_id: shopId, name });
  if (error) throw error;
}

export async function deleteBarber(shopId: string, id: string) {
  if (!isUuid(id)) return;
  const { error } = await sb().from("barbers").delete().eq("id", id).eq("shop_id", shopId);
  if (error) throw error;
}

export function toPublic(shop: Shop): PublicShop {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pinHash, ...rest } = shop;
  return rest;
}

/**
 * Directorio publico de barberias para la portada.
 * Selecciona columnas explicitas: `pin_hash` nunca debe salir de aqui.
 */
export async function listShops(): Promise<ShopCard[]> {
  await connection();
  const { data, error } = await sb()
    .from("shops")
    .select("slug, name, address, phone, open_time, close_time, work_days, services(name, price), barbers(id)")
    .order("created_at");
  if (error) throw error;

  type Row = {
    slug: string;
    name: string;
    address: string;
    phone: string;
    open_time: string;
    close_time: string;
    work_days: number[];
    services: { name: string; price: number | string }[];
    barbers: { id: string }[];
  };

  return ((data ?? []) as Row[]).map((r) => {
    const precios = r.services.map((x) => Number(x.price));
    return {
      slug: r.slug,
      name: r.name,
      address: r.address,
      phone: r.phone,
      openTime: r.open_time,
      closeTime: r.close_time,
      workDays: r.work_days,
      barbers: r.barbers.length,
      priceFrom: precios.length ? Math.min(...precios) : null,
      services: r.services.map((x) => x.name),
    };
  });
}

// ---------- Citas ----------

export async function listAppointments(
  shopId: string,
  range: { from: string; to: string },
): Promise<Appointment[]> {
  await connection();
  const { data, error } = await sb()
    .from("appointments")
    .select("*")
    .eq("shop_id", shopId)
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date")
    .order("time");
  if (error) throw error;
  return (data as ApptRow[]).map(toAppt);
}

export async function getAppointment(shopId: string, id: string): Promise<Appointment | undefined> {
  await connection();
  if (!isUuid(id)) return undefined;
  const { data, error } = await sb()
    .from("appointments")
    .select("*")
    .eq("id", id)
    .eq("shop_id", shopId)
    .maybeSingle<ApptRow>();
  if (error) throw error;
  return data ? toAppt(data) : undefined;
}

export async function findAppointmentByCode(shopId: string, code: string) {
  const { data, error } = await sb()
    .from("appointments")
    .select("*")
    .eq("shop_id", shopId)
    .eq("code", code.toUpperCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ApptRow>();
  if (error) throw error;
  return data ? toAppt(data) : undefined;
}

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

/** Inserta la cita. "conflict" si la base de datos detecta que el barbero ya está ocupado. */
export async function insertAppointment(
  a: NewAppointment,
): Promise<{ ok: true; id: string } | { ok: false; conflict: true }> {
  const start = toMin(a.time);
  const { data, error } = await sb()
    .from("appointments")
    .insert({
      shop_id: a.shopId,
      service_id: a.serviceId,
      barber_id: a.barberId,
      service_name: a.serviceName,
      price: a.price,
      date: a.date,
      time: a.time,
      start_min: start,
      end_min: start + a.durationMin,
      customer_name: a.customerName,
      customer_phone: a.customerPhone,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    if (error.code === "23P01") return { ok: false, conflict: true }; // violación de exclusión
    throw error;
  }
  return { ok: true, id: data.id };
}

/** Cambia el estado. Con `onlyFrom` solo lo cambia si está en ese estado. Devuelve false si chocó con otra cita. */
export async function setAppointmentStatus(
  shopId: string,
  id: string,
  status: AppointmentStatus,
  onlyFrom?: AppointmentStatus,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  let q = sb().from("appointments").update({ status }).eq("id", id).eq("shop_id", shopId);
  if (onlyFrom) q = q.eq("status", onlyFrom);
  const { error } = await q;
  if (error) {
    if (error.code === "23P01") return false; // reabrir una cita cuyo hueco ya se ocupó
    throw error;
  }
  return true;
}

export async function markCheckedIn(shopId: string, id: string) {
  if (!isUuid(id)) return;
  const { error } = await sb()
    .from("appointments")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", id)
    .eq("shop_id", shopId)
    .eq("status", "confirmada")
    .is("checked_in_at", null);
  if (error) throw error;
}
