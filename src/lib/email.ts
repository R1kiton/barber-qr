import "server-only";
import nodemailer from "nodemailer";

export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
}

export async function sendVerificationCode(email: string, code: string) {
  if (!emailConfigured()) throw new Error("EMAIL_NOT_CONFIGURED");
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("INVALID_SMTP_PORT");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Verifica tu correo · BarberQR",
    text: `Tu código de verificación de BarberQR es: ${code}\n\nCaduca en 10 minutos. Tu barbería todavía no se ha creado. Si no solicitaste este registro, ignora este mensaje.`,
  });
}
