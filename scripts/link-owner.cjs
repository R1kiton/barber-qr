/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS CLI. */
// One-time, trusted CLI for existing shops. Never exposed as a public endpoint.
// Usage: node scripts/link-owner.cjs <shop-slug> <owner-email>
const { loadEnvConfig } = require("@next/env");
const { Client } = require("pg");
const nodemailer = require("nodemailer");
const { randomInt, randomBytes, scrypt } = require("node:crypto");
const { promisify } = require("node:util");
const readline = require("node:readline/promises");
const { Writable } = require("node:stream");
loadEnvConfig(process.cwd(), true);

async function main() {
  const [slug, rawEmail] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!slug || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Usage: node scripts/link-owner.cjs <shop-slug> <owner-email>");
  for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"])
    if (!process.env[key]) throw new Error(`Missing ${key}`);

  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  await db.connect();
  let rl;
  try {
    const { rows } = await db.query("SELECT id, owner_email FROM shops WHERE slug = $1", [slug]);
    if (!rows[0]) throw new Error("Shop not found");
    if (rows[0].owner_email) throw new Error("Shop already has an owner; this command cannot replace it");
    const code = randomInt(0, 1000000).toString().padStart(6, "0");
    const deadline = Date.now() + 600000;
    const port = Number(process.env.SMTP_PORT);
    await nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
    }).sendMail({
      from: process.env.SMTP_FROM, to: email, subject: "Verifica tu correo · BarberQR",
      text: `Tu código para vincular tu barbería a BarberQR es: ${code}. Caduca en 10 minutos.`,
    });
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let verified = false;
    for (let i = 0; i < 5; i++) {
      const answer = await rl.question("Verification code from email: ");
      if (Date.now() > deadline) throw new Error("Code expired");
      if (answer.trim() === code) { verified = true; break; }
      console.log("Incorrect code");
    }
    if (!verified) throw new Error("Too many attempts");
    rl.close();
    // Do not echo the password or accept it as a command-line argument.
    const silent = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    rl = readline.createInterface({ input: process.stdin, output: silent, terminal: true });
    process.stdout.write("New password (12-128 characters, hidden): ");
    const password = await rl.question("");
    process.stdout.write("\nConfirm password (hidden): ");
    const confirm = await rl.question("");
    process.stdout.write("\n");
    if (password.length < 12 || password.length > 128 || password !== confirm)
      throw new Error("Passwords must match and contain 12-128 characters");
    const salt = randomBytes(16).toString("hex");
    const key = await promisify(scrypt)(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 });
    const hash = `scrypt$${salt}$${key.toString("hex")}`;
    const result = await db.query(
      "UPDATE shops SET owner_email=$1, password_hash=$2, email_verified_at=now() WHERE id=$3 AND owner_email IS NULL",
      [email, hash, rows[0].id],
    );
    if (result.rowCount !== 1) throw new Error("Shop already linked by another operation");
    console.log("Owner linked. Sign in at /login. Existing bookings were preserved.");
  } finally {
    rl?.close();
    await db.end();
  }
}
main().catch(() => {
  console.error("Could not link owner. Check SMTP, shop/email availability and verification/password inputs.");
  process.exitCode = 1;
});
