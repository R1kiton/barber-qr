import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma habla Postgres por TCP, no por PostgREST: cada cliente abre su propio
// pool. En desarrollo Next recarga los modulos en caliente, asi que sin
// guardarlo en globalThis cada recarga dejaria un pool huerfano y acabaria
// agotando las conexiones de la base.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let client: PrismaClient | null = globalForPrisma.prisma ?? null;

/** Cliente unico. Perezoso, para que falte DATABASE_URL falle en la consulta y no al importar. */
export function prisma(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Falta DATABASE_URL en .env. Copiala de Supabase → Connect → ORMs → Prisma " +
          "(la del pooler, puerto 6543).",
      );
    }
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  }
  return client;
}
