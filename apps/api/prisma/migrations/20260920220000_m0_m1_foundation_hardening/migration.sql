-- M0/M1 foundation hardening: approval engine fields + payment settlement rename
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "workflow_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "assignee_user_id" TEXT;
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "escalated_at" TIMESTAMP(3);
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "parallel_approvals" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "resolved_steps" JSONB NOT NULL DEFAULT '[]';

-- Prefer SETTLED as terminal success; keep COMPLETED readable as settled
UPDATE "payments" SET "status" = 'SETTLED' WHERE "status" = 'COMPLETED' AND "settlement_id" IS NOT NULL;
UPDATE "bank_transfers" SET "status" = 'SETTLED' WHERE "status" = 'COMPLETED';
