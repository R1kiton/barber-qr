# BarberQR

Reserva de citas para barberías (Next.js 16 + Tailwind). Al reservar, el cliente recibe un código
QR con su cita; al llegar, la barbería lo escanea y confirma la llegada.

## Arrancar

```bash
npm install
npm run dev
```

- Inicio: http://localhost:3000
- Demo de reservas: http://localhost:3000/b/barberia-demo
- Panel de la demo: http://localhost:3000/admin/barberia-demo (PIN `1234`)

## Rutas

| Ruta | Qué es |
| --- | --- |
| `/registro` | Alta de una barbería (servicios, barberos, horario, PIN) |
| `/b/[slug]` | Reserva: servicio → barbero → fecha/hora → datos |
| `/b/[slug]/cita/[id]` | Comprobante con el QR de la cita y código de 6 caracteres; el cliente puede cancelar |
| `/admin/[slug]` | Agenda, buscar cita por código, configuración |
| `/admin/[slug]/checkin/[id]` | Lo que abre el QR del cliente: valida la cita y confirma la llegada (pide PIN) |
| `/api/slots` | Horarios libres (sin solapamientos por barbero) |

## Probar el QR con el celular

El QR de la cita usa la URL con la que se hizo la reserva. Si reservas en `http://localhost:3000`,
el celular que escanee no podrá entrar. Usa la IP de tu PC en la red (p. ej. `http://192.168.1.50:3000`)
o define:

```
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
ADMIN_SECRET=una-cadena-larga-y-secreta
```

## Datos

Se guardan en `data/db.json` (se crea solo con la barbería demo). Sirve para empezar o para un
servidor propio; en Vercel u otro hosting sin disco persistente hay que cambiar `src/lib/db.ts`
por una base de datos real (Postgres, Supabase, Turso…).
