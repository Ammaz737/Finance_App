-- M4: receipt OCR fields, expense uniqueness, split tenancy, attachment quarantine default

ALTER TABLE "attachments" ALTER COLUMN "malware_status" SET DEFAULT 'QUARANTINED';

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "provider_clear_event_id" TEXT;

ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "ocr_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "ocr_payload" JSONB;

-- Deduplicate expenses that share the same transaction before unique index
DELETE FROM "expenses" a
USING "expenses" b
WHERE a.organization_id = b.organization_id
  AND a.transaction_id IS NOT NULL
  AND a.transaction_id = b.transaction_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS "expenses_organization_id_transaction_id_key"
  ON "expenses"("organization_id", "transaction_id");

CREATE UNIQUE INDEX IF NOT EXISTS "receipts_organization_id_attachment_id_key"
  ON "receipts"("organization_id", "attachment_id");

CREATE INDEX IF NOT EXISTS "receipts_organization_id_expense_id_idx"
  ON "receipts"("organization_id", "expense_id");

CREATE INDEX IF NOT EXISTS "receipts_organization_id_transaction_id_idx"
  ON "receipts"("organization_id", "transaction_id");

CREATE INDEX IF NOT EXISTS "expenses_organization_id_status_idx"
  ON "expenses"("organization_id", "status");

ALTER TABLE "expense_splits" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

UPDATE "expense_splits" es
SET "organization_id" = e."organization_id"
FROM "expenses" e
WHERE es."expense_id" = e."id"
  AND (es."organization_id" IS NULL OR es."organization_id" = '');

DELETE FROM "expense_splits" WHERE "organization_id" IS NULL;

ALTER TABLE "expense_splits" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "expense_splits_organization_id_expense_id_idx"
  ON "expense_splits"("organization_id", "expense_id");
