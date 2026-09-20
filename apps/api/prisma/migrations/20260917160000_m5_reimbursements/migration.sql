-- M5: reimbursement calc fields, receipt link, payout lifecycle

ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "reimbursement_id" TEXT;
CREATE INDEX IF NOT EXISTS "receipts_organization_id_reimbursement_id_idx"
  ON "receipts"("organization_id", "reimbursement_id");

ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "merchant" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "receipt_id" TEXT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "distance_miles" DECIMAL(18,2);
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "mileage_rate" DECIMAL(18,4);
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "per_diem_nights" INTEGER;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "per_diem_rate" DECIMAL(18,2);
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "calc_breakdown" JSONB;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "policy_result" TEXT NOT NULL DEFAULT 'PASS';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "payout_rail" TEXT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "provider_ref" TEXT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMP(3);
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "reimbursements_organization_id_status_idx"
  ON "reimbursements"("organization_id", "status");
