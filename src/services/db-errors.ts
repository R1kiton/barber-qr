/**
 * Traducción de errores de la base a decisiones de negocio.
 *
 * Los códigos de Prisma y de Postgres se conocen aquí y en ningún otro sitio:
 * los servicios devuelven resultados, no errores crudos, y las capas de arriba
 * nunca ven un `P2002` ni un `23P01`.
 */

/** La única restricción `exclude` del esquema: impide dos citas solapadas por barbero. */
const OVERLAP_CONSTRAINT = "appointments_no_overlap";

const codeOf = (e: unknown) => (e as { code?: string } | null)?.code;
const metaOf = (e: unknown) => (e as { meta?: { code?: string; constraint?: string } } | null)?.meta;
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `P2002` de Prisma, el `23505` de Postgres: valor duplicado en una columna única. */
export function isUniqueViolation(e: unknown): boolean {
  return codeOf(e) === "P2002";
}

/**
 * `23P01`: una restricción `exclude` rechazó la fila.
 *
 * Prisma no tiene código propio para esto, así que hay que mirar el error crudo
 * del driver. Se comprueba por tres vías porque la forma exacta depende de cómo
 * el adaptador envuelva el error de Postgres.
 */
export function isExclusionViolation(e: unknown): boolean {
  const meta = metaOf(e);
  if (meta?.code === "23P01" || meta?.constraint === OVERLAP_CONSTRAINT) return true;
  const message = messageOf(e);
  return message.includes("23P01") || message.includes(OVERLAP_CONSTRAINT);
}
