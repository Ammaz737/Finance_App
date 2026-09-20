-- M6: vendor bank history, bill lines/docs, payment settlement refs, payment run indexes

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "tax_id" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "risk_level" TEXT NOT NULL DEFAULT 'LOW';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DELETE FROM "vendors" a USING "vendors" b
  WHERE a.ctid < b.ctid AND a.organization_id = b.organization_id AND a.name = b.name;
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_organization_id_name_key" ON "vendors"("organization_id", "name");
CREATE INDEX IF NOT EXISTS "vendors_organization_id_status_idx" ON "vendors"("organization_id", "status");

ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
UPDATE "vendor_bank_accounts" vba
  SET "organization_id" = v."organization_id"
  FROM "vendors" v
  WHERE vba."vendor_id" = v.id AND (vba."organization_id" IS NULL OR vba."organization_id" = '');
ALTER TABLE "vendor_bank_accounts" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "change_reason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "is_current" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "superseded_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "vendor_bank_accounts_organization_id_vendor_id_idx"
  ON "vendor_bank_accounts"("organization_id", "vendor_id");

ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "memo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "attachment_id" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "purchase_order_id" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DELETE FROM "bills" a USING "bills" b
  WHERE a.ctid < b.ctid
    AND a.organization_id = b.organization_id
    AND a.vendor_id = b.vendor_id
    AND a.invoice_number = b.invoice_number;
CREATE UNIQUE INDEX IF NOT EXISTS "bills_organization_id_vendor_id_invoice_number_key"
  ON "bills"("organization_id", "vendor_id", "invoice_number");
CREATE INDEX IF NOT EXISTS "bills_organization_id_status_idx" ON "bills"("organization_id", "status");

ALTER TABLE "bill_lines" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
UPDATE "bill_lines" bl
  SET "organization_id" = b."organization_id"
  FROM "bills" b
  WHERE bl."bill_id" = b.id AND (bl."organization_id" IS NULL OR bl."organization_id" = '');
-- Drop orphan lines that cannot be linked
DELETE FROM "bill_lines" WHERE "organization_id" IS NULL OR "organization_id" = '';
ALTER TABLE "bill_lines" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "bill_lines" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "bill_lines_organization_id_bill_id_idx" ON "bill_lines"("organization_id", "bill_id");

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider_ref" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "settlement_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "failure_reason" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "payments_organization_id_status_idx" ON "payments"("organization_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_organization_id_settlement_id_key"
  ON "payments"("organization_id", "settlement_id");

ALTER TABLE "payment_runs" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "payment_runs_organization_id_status_idx" ON "payment_runs"("organization_id", "status");
