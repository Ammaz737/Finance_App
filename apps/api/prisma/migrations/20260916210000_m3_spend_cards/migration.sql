-- M3: spend request fields, program outcome defaults, budget commitment, card uniqueness/provider refs

ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "committed_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "default_fulfillment_type" TEXT NOT NULL DEFAULT 'VIRTUAL_CARD';
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "merchant_lock_default" TEXT;
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "default_valid_days" INTEGER;

ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT '';
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "vendor_id" TEXT;
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "recurrence" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "provider_ref" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "network" TEXT NOT NULL DEFAULT 'MOCK';

ALTER TABLE "card_authorizations" ADD COLUMN IF NOT EXISTS "provider_event_id" TEXT;

-- Keep one card per fund before unique index (demo-safe: keep earliest)
DELETE FROM "cards" a
USING "cards" b
WHERE a.organization_id = b.organization_id
  AND a.fund_id = b.fund_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS "cards_organization_id_fund_id_key" ON "cards"("organization_id", "fund_id");
