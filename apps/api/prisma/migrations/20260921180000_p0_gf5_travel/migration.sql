-- P0-GF5: Travel hardening — offer snapshot, reprice, cancel/refund, traveler profile, fund/card

ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "department" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "international" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "card_id" TEXT;
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "policy_matched_rules" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "policy_required_actions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "policy_version" INT;
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "policy_evaluated_at" TIMESTAMP(3);
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "reprice_tolerance" DECIMAL(18,2) NOT NULL DEFAULT 25.00;

ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "provider_offer_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "quoted_amount" DECIMAL(18,2);
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "approved_amount" DECIMAL(18,2);
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "offer_expiry" TIMESTAMP(3);
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "offer_snapshot" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "confirmation_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "cancellation_terms" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "refundable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3);
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "travel_bookings_org_idempotency_key"
  ON "travel_bookings"("organization_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "traveler_profiles" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "legal_name" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "seat_preference" TEXT NOT NULL DEFAULT '',
  "hotel_preference" TEXT NOT NULL DEFAULT '',
  "loyalty" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "traveler_profiles_org_user_uidx"
  ON "traveler_profiles"("organization_id", "user_id");

UPDATE "travel_trips" SET "status" = 'READY_TO_BOOK' WHERE "status" = 'APPROVED';
