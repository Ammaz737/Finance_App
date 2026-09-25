-- P0-GF4: Reimbursement hardening — draft/submit, policy snapshot, duplicates, failure/returned

ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "expense_date" TIMESTAMP(3);
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "destination" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMP(3);
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP(3);
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "eligible_days" INT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "rate_source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "rate_version" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "department" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "project" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "payment_destination" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "approval_progress" TEXT NOT NULL DEFAULT '';

ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "policy_reason" TEXT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "policy_matched_rules" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "policy_required_actions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "policy_version" INT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "policy_evaluated_at" TIMESTAMP(3);

ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "duplicate_status" TEXT NOT NULL DEFAULT 'CLEAR';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "duplicate_of_id" TEXT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "receipt_fingerprint" TEXT NOT NULL DEFAULT '';

ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "payout_status" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "failure_reason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "settlement_ref" TEXT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "released_by" TEXT;
ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "returned_at" TIMESTAMP(3);

-- Existing rows that were created as immediate submit stay IN_REVIEW; drafts use DRAFT
UPDATE "reimbursements" SET "payout_status" = 'SETTLED' WHERE "status" = 'PAID' AND ("payout_status" = '' OR "payout_status" IS NULL);
UPDATE "reimbursements" SET "payout_status" = 'SCHEDULED' WHERE "status" = 'SCHEDULED' AND ("payout_status" = '' OR "payout_status" IS NULL);
UPDATE "reimbursements" SET "payout_status" = 'AWAITING_RELEASE' WHERE "status" = 'APPROVED' AND ("payout_status" = '' OR "payout_status" IS NULL);
