-- Stripe Issuing mappings + webhook idempotency
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_cardholder_id" TEXT;
CREATE INDEX IF NOT EXISTS "users_organization_id_stripe_cardholder_id_idx" ON "users"("organization_id", "stripe_cardholder_id");

ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "stripe_card_id" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "brand" TEXT NOT NULL DEFAULT 'visa';
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "shipping_status" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "shipping_name" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "shipping_line1" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "shipping_city" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "shipping_state" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "shipping_postal" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "shipping_country" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "blocked_mccs" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "allowed_countries" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "blocked_countries" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "daily_limit" DECIMAL(18,2);
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "weekly_limit" DECIMAL(18,2);
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "monthly_limit" DECIMAL(18,2);
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "replaced_by_card_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "cards_organization_id_stripe_card_id_key" ON "cards"("organization_id", "stripe_card_id");
CREATE INDEX IF NOT EXISTS "cards_organization_id_provider_ref_idx" ON "cards"("organization_id", "provider_ref");

ALTER TABLE "card_authorizations" ADD COLUMN IF NOT EXISTS "merchant_country" TEXT;
ALTER TABLE "card_authorizations" ADD COLUMN IF NOT EXISTS "stripe_authorization_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "card_authorizations_organization_id_stripe_authorization_id_key" ON "card_authorizations"("organization_id", "stripe_authorization_id");

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "stripe_transaction_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_organization_id_stripe_transaction_id_key" ON "transactions"("organization_id", "stripe_transaction_id");

CREATE TABLE IF NOT EXISTS "card_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "stripe_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processed_at" TIMESTAMP(3),
  "error" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "card_events_stripe_event_id_key" ON "card_events"("stripe_event_id");
CREATE INDEX IF NOT EXISTS "card_events_event_type_created_at_idx" ON "card_events"("event_type", "created_at");
