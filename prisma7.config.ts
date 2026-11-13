import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // El CLI migra por conexion DIRECTA (puerto 5432). El pooler en modo
    // transaccion no admite DDL ni los advisory locks que usa migrate.
    // La aplicacion, en cambio, usa DATABASE_URL (el pooler) desde src/lib/prisma.ts.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
