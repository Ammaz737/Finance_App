-- M9: core travel trip request, itinerary bookings, mock vs confirmed

ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "destination" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMP(3);
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP(3);
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "estimated_amount" DECIMAL(18,2);
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "policy_explanation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "fund_id" TEXT;
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "expense_id" TEXT;
ALTER TABLE "travel_trips" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "travel_trips_organization_id_status_idx" ON "travel_trips"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "travel_trips_organization_id_traveler_id_idx" ON "travel_trips"("organization_id", "traveler_id");

ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
UPDATE "travel_bookings" b
  SET "organization_id" = t."organization_id"
  FROM "travel_trips" t
  WHERE b."trip_id" = t.id AND (b."organization_id" IS NULL OR b."organization_id" = '');
DELETE FROM "travel_bookings" WHERE "organization_id" IS NULL OR "organization_id" = '';
ALTER TABLE "travel_bookings" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "out_of_policy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "provider_ref" TEXT;
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "provider_status" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "itinerary" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "starts_at" TIMESTAMP(3);
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "ends_at" TIMESTAMP(3);
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "travel_bookings" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Legacy seed rows used BOOKED; treat as mock holds, never live confirmation.
UPDATE "travel_bookings" SET "status" = 'BOOKED_MOCK', "provider_status" = 'MOCK_HOLD'
  WHERE "status" = 'BOOKED';
CREATE INDEX IF NOT EXISTS "travel_bookings_organization_id_trip_id_idx"
  ON "travel_bookings"("organization_id", "trip_id");
