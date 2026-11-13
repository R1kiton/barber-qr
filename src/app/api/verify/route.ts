// TEMPORAL: ejercita la capa de servicios contra la base real.
// Crea una barbería de prueba, la usa y la borra. Eliminar tras verificar.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/auth";
import * as shops from "@/services/shop.service";
import * as appointments from "@/services/appointment.service";

const SLUG = `zz-verify-${Date.now().toString(36)}`;

export async function GET() {
  const out: Record<string, unknown> = {};
  let shopId: string | null = null;

  try {
    // --- Lecturas sobre datos que ya existen ---
    const cards = await shops.listCards();
    out["1_listCards"] = { barberias: cards.length, primera: cards[0]?.name ?? null };

    const demo = await shops.getBySlug("barberia-demo");
    out["2_getBySlug_demo"] = demo
      ? { nombre: demo.name, servicios: demo.services.length, barberos: demo.barbers.length }
      : "NO ENCONTRADA";

    // --- Alta ---
    const creada = await shops.create({
      slug: SLUG,
      name: "Verificación",
      address: "Calle 1",
      phone: "555",
      pinHash: hashPin("1234"),
      openTime: "09:00",
      closeTime: "19:00",
      workDays: [0, 1, 2, 3, 4, 5, 6],
      services: [{ name: "Corte", durationMin: 30, price: 150.5 }],
      barbers: [{ name: "A" }, { name: "B" }],
    });
    if (!creada) throw new Error("create devolvió null en una barbería nueva");
    shopId = creada.id;
    out["3_create"] = {
      servicios: creada.services.length,
      barberos: creada.barbers.length,
      precio: creada.services[0].price,
      precioEsNumero: typeof creada.services[0].price === "number",
    };

    // Slug repetido: debe devolver null, no lanzar (camino P2002).
    const repetida = await shops.create({ ...creada, services: [], barbers: [] });
    out["4_slug_duplicado"] = repetida === null ? "null (correcto)" : "NO detectó el duplicado";

    const [barberoA, barberoB] = creada.barbers;
    const servicio = creada.services[0];
    const fecha = "2026-12-15";

    // --- Reserva ---
    const primera = await appointments.book({
      shopId: creada.id,
      serviceId: servicio.id,
      barberId: barberoA.id,
      serviceName: servicio.name,
      price: servicio.price,
      durationMin: 30,
      date: fecha,
      time: "10:00",
      customerName: "Ana",
      customerPhone: "555",
    });
    out["5_book"] = primera;
    if (!primera.ok) throw new Error("la primera reserva no debería fallar");

    const leida = await appointments.getById(creada.id, primera.id);
    out["6_getById"] = {
      code: leida?.code,
      codeLargo6: leida?.code.length === 6,
      fechaGuardada: leida?.date,
      fechaIntacta: leida?.date === fecha, // si falla, hay corrimiento de zona horaria
      duracionMin: leida?.durationMin,
      precio: leida?.price,
    };

    // --- El solape, que es lo que importa ---
    const solapada = await appointments.book({
      shopId: creada.id,
      serviceId: servicio.id,
      barberId: barberoA.id, // mismo barbero, horario encabalgado
      serviceName: servicio.name,
      price: servicio.price,
      durationMin: 30,
      date: fecha,
      time: "10:15",
      customerName: "Luis",
      customerPhone: "555",
    });
    out["7_solape_mismo_barbero"] =
      !solapada.ok && solapada.conflict
        ? "rechazada (correcto)"
        : `FALLO: se aceptó -> ${JSON.stringify(solapada)}`;

    const otroBarbero = await appointments.book({
      shopId: creada.id,
      serviceId: servicio.id,
      barberId: barberoB.id, // misma hora, otro barbero: debe entrar
      serviceName: servicio.name,
      price: servicio.price,
      durationMin: 30,
      date: fecha,
      time: "10:15",
      customerName: "Luis",
      customerPhone: "555",
    });
    out["8_misma_hora_otro_barbero"] = otroBarbero.ok ? "aceptada (correcto)" : "FALLO: la rechazó";

    // --- Búsqueda por código y cambios de estado ---
    const porCodigo = await appointments.findByCode(creada.id, leida!.code.toLowerCase());
    out["9_findByCode"] = porCodigo?.id === primera.id ? "encontrada (correcto)" : "FALLO";

    await appointments.markCheckedIn(creada.id, primera.id);
    const trasCheckIn = await appointments.getById(creada.id, primera.id);
    out["10_markCheckedIn"] = trasCheckIn?.checkedInAt ? "marcada (correcto)" : "FALLO";

    const cambio = await appointments.setStatus(creada.id, primera.id, "completada", "confirmada");
    const trasEstado = await appointments.getById(creada.id, primera.id);
    out["11_setStatus"] = { devolvio: cambio, estado: trasEstado?.status };

    // --- Listado por rango ---
    const delDia = await appointments.listByDateRange(creada.id, { from: fecha, to: fecha });
    out["12_listByDateRange"] = { citas: delDia.length, fechas: delDia.map((a) => a.date) };

    // --- Catálogo ---
    await shops.addBarber(creada.id, "C");
    await shops.addService(creada.id, { name: "Barba", durationMin: 20, price: 80 });
    const tras = await shops.getBySlug(SLUG);
    out["13_catalogo"] = { servicios: tras?.services.length, barberos: tras?.barbers.length };

    out["resultado"] = Object.entries(out).some(([, v]) => JSON.stringify(v).includes("FALLO"))
      ? "HAY FALLOS"
      : "TODO CORRECTO";
    return NextResponse.json(out);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ ...out, excepcion: err.message, stack: err.stack?.slice(0, 600) }, { status: 500 });
  } finally {
    // Limpieza: borra solo la barbería creada aquí; el cascade se lleva lo demás.
    if (shopId) await prisma().shop.delete({ where: { id: shopId } }).catch(() => {});
  }
}
