/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader hooks exercise TS modules without adding a test framework. */
// Real PostgreSQL/Prisma integration tests. Only request cookies and email delivery are mocked.
// Run: node --test tests/auth.integration.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd(), true);

const jar = new Map();
const cookieJar = {
  get: (key) => jar.has(key) ? { value: jar.get(key) } : undefined,
  set: (key, value) => jar.set(key, value),
  delete: (key) => jar.delete(key),
};
let sentCode;
let deliveryFails = false;
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === "server-only") return {};
  if (name === "next/headers") return { cookies: async () => cookieJar };
  if (name === "next/server") return { connection: async () => {} };
  if (name === "next/cache") return { revalidatePath: () => {} };
  if (name === "next/navigation") return { redirect: (url) => { throw Object.assign(new Error("REDIRECT"), { url }); } };
  if (name === "nodemailer") return {
    createTransport: () => ({ sendMail: async (mail) => {
      if (deliveryFails) throw new Error("SMTP test failure");
      sentCode = mail.text.match(/\b\d{6}\b/)[0];
      return { accepted: [mail.to] };
    } }),
  };
  if (name.startsWith("@/")) name = path.join(process.cwd(), "src", name.slice(2));
  return originalLoad.call(this, name, parent, main);
};
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8").replaceAll("import.meta.url", JSON.stringify(require("node:url").pathToFileURL(filename).href));
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(outputText, filename);
};

const auth = require("../src/lib/auth.ts");
const registration = require("../src/services/registration.service.ts");
const { prisma } = require("../src/lib/prisma.ts");
const { adminLogin, registerShop } = require("../src/app/actions.ts");
const prefix = `zz-auth-test-${Date.now()}`;
const password = "test phrase with spaces 123";
const emails = [];
const shopData = (suffix) => ({
  slug: `${prefix}-${suffix}`, name: "Auth integration fixture", address: "", phone: "",
  openTime: "09:00", closeTime: "19:00", workDays: [1, 2, 3, 4, 5],
  services: [{ name: "Corte", durationMin: 30, price: 150 }], barbers: [{ name: "Test" }],
});
const emailFor = (suffix) => { const email = `${prefix}-${suffix}@example.com`; emails.push(email); return email; };
const fd = (entries) => { const data = new FormData(); for (const [key, value] of Object.entries(entries)) data.set(key, value); return data; };

test("owner authentication and verification, against Prisma", async (t) => {
  process.env.SMTP_HOST = "mock.invalid";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "mock";
  process.env.SMTP_PASSWORD = "mock";
  process.env.SMTP_FROM = "test@example.com";
  try {
    await t.test("password hashes have random salts and reject incorrect passwords", async () => {
      const one = await auth.hashPassword(password);
      const two = await auth.hashPassword(password);
      assert.notEqual(one, two);
      assert.equal(await auth.verifyPassword(password, one), true);
      assert.equal(await auth.verifyPassword("wrong password", one), false);
      assert.equal(await auth.verifyPassword(password, null), false);
    });

    const email = emailFor("owner");
    const data = shopData("owner");
    let owner;
    await t.test("registration sends code but creates no shop until verification", async () => {
      assert.equal(await registration.beginRegistration(email, password, data), null);
      assert.match(sentCode, /^\d{6}$/);
      assert.equal(await prisma().shop.findUnique({ where: { slug: data.slug } }), null);
      const pending = await registration.pendingRegistration();
      assert.ok(pending);
      assert.notEqual(pending.pending.codeHash, sentCode);
      assert.ok(!JSON.stringify(pending.pending.payload).includes(password));
      const wrong = sentCode === "000000" ? "111111" : "000000";
      assert.ok((await registration.completeRegistration(wrong)).error);
      const result = await registration.completeRegistration(sentCode);
      assert.ok(result.shop);
      owner = result.shop;
      assert.ok((await registration.completeRegistration(sentCode)).error, "codes cannot be replayed");
      const stored = await prisma().shop.findUniqueOrThrow({ where: { id: owner.id } });
      assert.equal(stored.ownerEmail, email);
      assert.ok(stored.emailVerifiedAt);
      assert.equal(await auth.verifyPassword(password, stored.passwordHash), true);
    });

    await t.test("login redirects to owned shop and ignores foreign or external next destinations", async () => {
      assert.ok((await adminLogin(undefined, fd({ email, password: "incorrect" }))).error);
      for (const next of ["https://example.com", "/admin/someone-else/checkin/123"]) {
        await assert.rejects(adminLogin(undefined, fd({ email: email.toUpperCase(), password, next })), (e) => e.url === `/admin/${owner.slug}`);
      }
      assert.equal(await auth.isAdmin(owner), true);
      assert.equal(await auth.isAdmin({ id: "00000000-0000-0000-0000-000000000000" }), false);
      const checkin = `/admin/${owner.slug}/checkin/00000000-0000-0000-0000-000000000001`;
      await assert.rejects(adminLogin(undefined, fd({ email, password, next: checkin })), (e) => e.url === checkin);
    });

    await t.test("session expiration, forgery and logout revoke access", async () => {
      const token = jar.get(auth.SESSION_COOKIE);
      await prisma().adminSession.update({ where: { tokenHash: auth.digest(token) }, data: { expiresAt: new Date(0) } });
      assert.equal(await auth.isAdmin(owner), false);
      jar.set(auth.SESSION_COOKIE, "a".repeat(64));
      assert.equal(await auth.isAdmin(owner), false);
      await auth.setAdminSession(owner);
      const issued = jar.get(auth.SESSION_COOKIE);
      await auth.clearAdminSession();
      jar.set(auth.SESSION_COOKIE, issued);
      assert.equal(await auth.isAdmin(owner), false);
      jar.clear();
    });

    await t.test("expired codes and more than five guesses cannot create shops", async () => {
      for (const suffix of ["expired", "locked"]) {
        const email = emailFor(suffix);
        assert.equal(await registration.beginRegistration(email, password, shopData(suffix)), null);
        const code = sentCode;
        const current = await registration.pendingRegistration();
        if (suffix === "expired") {
          await prisma().pendingRegistration.update({ where: { tokenHash: current.pending.tokenHash }, data: { expiresAt: new Date(0) } });
        } else {
          const wrong = code === "000000" ? "111111" : "000000";
          await Promise.all(Array.from({ length: 6 }, () => registration.completeRegistration(wrong)));
        }
        assert.ok((await registration.completeRegistration(code)).error);
        assert.equal(await prisma().shop.findUnique({ where: { slug: shopData(suffix).slug } }), null);
      }
    });

    await t.test("resend invalidates old codes and keeps attempt limit", async () => {
      assert.equal(await registration.beginRegistration(emailFor("resend"), password, shopData("resend")), null);
      const old = sentCode;
      assert.equal(await registration.resendRegistrationCode(), null);
      const fresh = sentCode;
      if (old !== fresh) assert.ok((await registration.completeRegistration(old)).error);
      assert.ok(await registration.resendRegistrationCode(), "resend cooldown enforced");
      assert.ok((await registration.completeRegistration(fresh)).shop);
    });

    await t.test("SMTP failure leaves no shop, and server validation rejects weak passwords", async () => {
      deliveryFails = true;
      const email = emailFor("smtp-failure");
      assert.ok(await registration.beginRegistration(email, password, shopData("smtp-failure")));
      assert.equal(await prisma().pendingRegistration.count({ where: { email } }), 0);
      deliveryFails = false;
      assert.ok((await registerShop(undefined, fd({ name: "Test", email, password: "1234", confirmPassword: "1234" }))).error);
    });

    await t.test("database rate limiter enforces limit atomically", async () => {
      const value = emailFor("limit");
      const results = await Promise.all(Array.from({ length: 10 }, () => auth.allowAuthAttempt("test", value, 3, 900)));
      assert.equal(results.filter(Boolean).length, 3);
    });
  } finally {
    await prisma().shop.deleteMany({ where: { slug: { startsWith: prefix } } });
    await prisma().pendingRegistration.deleteMany({ where: { email: { in: emails } } });
    const scopes = ["register", "resend", "verification-mail", "login", "test"];
    await prisma().authRateLimit.deleteMany({ where: { key: { in: scopes.flatMap((scope) => emails.map((email) => auth.digest(`${scope}:${email}`))) } } });
    await prisma().$disconnect();
  }
});
