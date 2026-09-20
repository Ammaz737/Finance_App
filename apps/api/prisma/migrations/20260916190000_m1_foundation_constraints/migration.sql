-- M1 foundation: tenant-safe uniques + outbox claim/retry/dead-letter fields.
-- Demo orphan analysis (2026-09-16) reported no conflicting rows before this migration.

ALTER TABLE "outbox_events"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_error" TEXT,
  ADD COLUMN IF NOT EXISTS "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dead_letter_at" TIMESTAMP(3);

DROP INDEX IF EXISTS "outbox_events_published_at_idx";
CREATE INDEX IF NOT EXISTS "outbox_events_published_at_available_at_dead_letter_at_idx"
  ON "outbox_events"("published_at", "available_at", "dead_letter_at");

-- Fund: one fulfillment fund per spend request within a tenant (NULLs allowed multiple times in Postgres).
CREATE UNIQUE INDEX IF NOT EXISTS "funds_organization_id_spend_request_id_key"
  ON "funds"("organization_id", "spend_request_id");

-- Card authorization idempotency is tenant-scoped.
ALTER TABLE "card_authorizations" DROP CONSTRAINT IF EXISTS "card_authorizations_idempotency_key_key";
DROP INDEX IF EXISTS "card_authorizations_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "card_authorizations_organization_id_idempotency_key_key"
  ON "card_authorizations"("organization_id", "idempotency_key");

-- Accounting source uniqueness is tenant-scoped.
ALTER TABLE "accounting_entries" DROP CONSTRAINT IF EXISTS "accounting_entries_source_type_source_id_key";
DROP INDEX IF EXISTS "accounting_entries_source_type_source_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_entries_organization_id_source_type_source_id_key"
  ON "accounting_entries"("organization_id", "source_type", "source_id");
