# Acceso de propietarios

La aplicación autentica mediante Prisma y PostgreSQL. No utiliza Supabase Auth.

## Correo con Nodemailer

Configura estas variables en `.env.local` y en tu alojamiento:

```dotenv
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=tu-usuario-smtp
SMTP_PASSWORD=tu-contrasena-smtp
SMTP_FROM="BarberQR <cuentas@tu-dominio.com>"
```

Usa los valores de tu proveedor. El puerto 465 usa TLS desde el inicio; otros puertos requieren STARTTLS. No se desactiva la validación del certificado. Si una contraseña SMTP contiene `$`, escríbelo como `\$` en el archivo de entorno para evitar la expansión de variables de Next.js. No uses `%24` para SMTP: esa codificación corresponde únicamente a contraseñas dentro de URLs.

Reinicia `npm run dev` después de configurar las variables. Sin SMTP configurado, el registro muestra un error y no crea una barbería.

## Flujo

1. `/registro` recibe los datos de la barbería, correo y contraseña de 12 a 128 caracteres.
2. Se guarda un registro pendiente con la contraseña hasheada (scrypt con sal aleatoria), nunca en texto plano. No aparece en el directorio.
3. Se envía un código aleatorio de seis dígitos. El navegador recibe una cookie HttpOnly aleatoria que vincula ese registro; la base almacena hashes del token y del código.
4. `/registro/verificar` permite cinco intentos durante diez minutos. Reenviar invalida el código anterior, conserva el vencimiento y no reinicia el límite de intentos.
5. Al verificar, una transacción crea la barbería con sus servicios y barberos, marca el correo verificado y consume el registro pendiente. Se abre su panel.
6. `/login` acepta correo y contraseña y redirige al panel de la barbería asociada. Un correo corresponde a una barbería.
7. Las sesiones aleatorias duran siete días, se almacenan hasheadas en la base y se revocan al salir. Cada acción del panel verifica la propiedad, incluidos los enlaces de check-in.

Se limitan los intentos de login y envíos por correo mediante contadores atómicos en PostgreSQL. Los registros pendientes caducados se eliminan al iniciar otro registro. Para una instalación pública con alto tráfico, añade también límites por IP en el proxy/alojamiento.

## Migración

```powershell
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
```

La migración `20261113_owner_login` es aditiva; conserva citas, restricciones SQL y datos anteriores. `pin_hash` se mantiene como columna heredada por compatibilidad, pero no permite iniciar sesión. Las cookies antiguas del PIN tampoco dan acceso.

Las barberías anteriores no tienen correo ni contraseña: un operador con acceso al servidor debe vincularlas una sola vez, después de confirmar quién es el propietario:

```powershell
node scripts/link-owner.cjs el-slug-de-la-barberia propietario@ejemplo.com
```

El comando envía un código al correo, exige verificarlo y pide la nueva contraseña sin mostrarla. No acepta contraseñas por argumentos ni puede reemplazar un propietario existente. No existe un endpoint público para reclamar barberías antiguas. Este comando no modifica citas.

## Pruebas

```powershell
node --test tests/auth.integration.cjs
npx tsc --noEmit
npm run build
```

Las pruebas de integración usan Prisma contra la base configurada, crean únicamente fixtures con prefijo `zz-auth-test-` y las eliminan al terminar. Simulan el transporte de correo y las cookies HTTP. Cubren hashes, registro sin crear barbería, verificación, códigos caducados/reutilizados, reenvío, límite de intentos, login, redirecciones, propiedad, expiración y revocación de sesiones, y fallos SMTP. La entrega real necesita credenciales SMTP y una prueba con el proveedor.

Documentación del transporte: https://nodemailer.com/smtp
