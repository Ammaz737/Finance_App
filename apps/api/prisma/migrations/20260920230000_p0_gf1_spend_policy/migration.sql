-- P0-GF1 spend request policy snapshot + program eligibility
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "frequency" TEXT NOT NULL DEFAULT 'ONE_TIME';
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "reset_rule" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMP(3);
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP(3);
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "eligible_department_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "eligible_location_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "eligible_role_names" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "eligible_user_ids" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '';
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "attachment_id" TEXT;
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "comments" TEXT NOT NULL DEFAULT '';
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "policy_result" TEXT NOT NULL DEFAULT '';
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "policy_reason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "policy_matched_rules" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "policy_required_actions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "policy_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "spend_requests" ADD COLUMN IF NOT EXISTS "policy_evaluated_at" TIMESTAMP(3);
