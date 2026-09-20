-- M7: accounting queue enrichment, ERP external ids, sync attempts

ALTER TABLE "accounting_dimensions" ADD COLUMN IF NOT EXISTS "provider_synced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "accounting_dimensions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(18,2);
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "external_id" TEXT;
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMP(3);
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "sync_attempt_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_entries_organization_id_external_id_key"
  ON "accounting_entries"("organization_id", "external_id");
CREATE INDEX IF NOT EXISTS "accounting_entries_organization_id_source_type_idx"
  ON "accounting_entries"("organization_id", "source_type");

ALTER TABLE "accounting_rules" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "accounting_rules" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "accounting_rules_organization_id_enabled_idx"
  ON "accounting_rules"("organization_id", "enabled");

ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "success_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "failure_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "entry_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "sync_jobs_organization_id_status_idx"
  ON "sync_jobs"("organization_id", "status");

CREATE TABLE IF NOT EXISTS "sync_attempts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "sync_job_id" TEXT NOT NULL,
  "entry_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "external_id" TEXT,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sync_attempts_organization_id_entry_id_idx"
  ON "sync_attempts"("organization_id", "entry_id");
CREATE INDEX IF NOT EXISTS "sync_attempts_organization_id_sync_job_id_idx"
  ON "sync_attempts"("organization_id", "sync_job_id");
