import type { NextRequest } from "next/server";
import * as shops from "@/services/shop.service";
import * as appointments from "@/services/appointment.service";
import { availableSlots } from "@/lib/slots";
import { isValidDate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slug = p.get("slug") ?? "";
  const date = p.get("date") ?? "";
  const serviceId = p.get("serviceId") ?? "";
  const barberId = p.get("barberId") ?? "any";

  if (!isValidDate(date)) return Response.json({ slots: [] }, { status: 400 });
  const shop = await shops.getBySlug(slug);
  if (!shop) return Response.json({ slots: [] }, { status: 404 });

  const appts = await appointments.listByDateRange(shop.id, { from: date, to: date });
  const slots = availableSlots(shop, appts, date, serviceId, barberId, new Date());
  return Response.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
