-- Additive migration: preserve existing shops, bookings and constraints.
ALTER TABLE "shops" ADD COLUMN "owner_email" TEXT;
ALTER TABLE "shops" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "shops" ADD COLUMN "email_verified_at" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX "shops_owner_email_key" ON "shops"("owner_email");
CREATE TABLE "admin_sessions" (
  "token_hash" TEXT PRIMARY KEY,
  "shop_id" UUID NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expires_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "admin_sessions_shop_id_idx" ON "admin_sessions"("shop_id");
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");
CREATE TABLE "pending_registrations" (
  "token_hash" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "pending_registrations_expires_at_idx" ON "pending_registrations"("expires_at");
CREATE TABLE "auth_rate_limits" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "auth_rate_limits_expires_at_idx" ON "auth_rate_limits"("expires_at");
ALTER TABLE "admin_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pending_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_rate_limits" ENABLE ROW LEVEL SECURITY;
