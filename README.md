# BarberQR

Reserva de citas para barberías (Next.js 16 + Tailwind). Al reservar, el cliente recibe un código
QR con su cita; al llegar, la barbería lo escanea y confirma la llegada.

## Arrancar

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

- Inicio: http://localhost:3000
- Demo de reservas: http://localhost:3000/b/barberia-demo
- Acceso de propietarios: http://localhost:3000/login
- Configuración SMTP y vinculación de barberías existentes: [Acceso de propietarios](docs/owner-login.md)

## Rutas

| Ruta | Qué es |
| --- | --- |
| `/registro` | Datos de barbería, correo del propietario y contraseña |
| `/registro/verificar` | Verifica el correo antes de crear la barbería |
| `/login` | Correo y contraseña; redirige al panel de la barbería propietaria |
| `/b/[slug]` | Reserva: servicio → barbero → fecha/hora → datos |
| `/b/[slug]/cita/[id]` | Comprobante con el QR de la cita y código de 6 caracteres; el cliente puede cancelar |
| `/admin/[slug]` | Agenda, buscar cita por código, configuración |
| `/admin/[slug]/checkin/[id]` | Valida la cita y confirma la llegada; requiere sesión del propietario |
| `/api/slots` | Horarios libres (sin solapamientos por barbero) |

## Probar el QR con el celular

El QR de la cita usa la URL con la que se hizo la reserva. Si reservas en `http://localhost:3000`,
el celular que escanee no podrá entrar. Usa la IP de tu PC en la red (p. ej. `http://192.168.1.50:3000`)
o define:

```
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
```

## Datos (Supabase)

Los datos viven en Supabase (Postgres) y se consultan exclusivamente desde el servidor con Prisma. Supabase Auth no interviene.

1. Configura `DATABASE_URL` y `DIRECT_URL` en `.env` con las conexiones PostgreSQL de tu proyecto. Codifica los caracteres especiales de la contraseña dentro de la URL.
2. Aplica las migraciones con `npm run db:migrate` y genera el cliente con `npm run db:generate`. En una base ya existente creada con el SQL original, establece primero el baseline de `0_init`; no uses `db push` ni `migrate reset`.
3. Completa las variables SMTP indicadas en [la guía de acceso](docs/owner-login.md).
4. `npm run dev`. La barbería demo se crea sola al visitarla, pero no tiene acceso público al panel.

Seguridad: las tablas tienen RLS activado sin políticas, así que la clave pública no puede leer
nada. La app se conecta a PostgreSQL desde el servidor (`src/lib/prisma.ts`).
La propia base de datos impide dos citas solapadas con el mismo barbero (restricción `exclude`).
