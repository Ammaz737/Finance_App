-- P0-GF2: Vendor 360 fields, bank payment details, bill intake intelligence
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "legal_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "display_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "payment_status" TEXT NOT NULL DEFAULT 'NEEDS_BANK';

UPDATE "vendors"
SET "legal_name" = CASE WHEN "legal_name" = '' THEN "name" ELSE "legal_name" END,
    "display_name" = CASE WHEN "display_name" = '' THEN "name" ELSE "display_name" END;

UPDATE "vendors" v
SET "payment_status" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "vendor_bank_accounts" b
    WHERE b."vendor_id" = v.id AND b."organization_id" = v."organization_id" AND b."is_current" = true AND b."status" = 'VERIFIED'
  ) THEN 'PAYMENT_READY'
  WHEN EXISTS (
    SELECT 1 FROM "vendor_bank_accounts" b
    WHERE b."vendor_id" = v.id AND b."organization_id" = v."organization_id" AND b."is_current" = true
  ) THEN 'BANK_PENDING'
  WHEN v."status" <> 'ACTIVE' THEN 'INACTIVE'
  ELSE 'NEEDS_BANK'
END;

ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "payment_method" TEXT NOT NULL DEFAULT 'ACH';
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "beneficiary_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'US';
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "verified_by" TEXT;
ALTER TABLE "vendor_bank_accounts" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);

ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "invoice_date" TIMESTAMP(3);
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(18,2);
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "department_id" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "business_owner_id" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "payment_method" TEXT NOT NULL DEFAULT 'ACH';
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "vendor_match_status" TEXT NOT NULL DEFAULT 'MATCHED';
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "vendor_match_vendor_id" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "duplicate_status" TEXT NOT NULL DEFAULT 'CLEAR';
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "duplicate_evidence" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "coding_source" TEXT NOT NULL DEFAULT 'MANUAL';

UPDATE "bills" SET "subtotal" = "amount" WHERE "subtotal" IS NULL;
UPDATE "bills" SET "vendor_match_vendor_id" = "vendor_id" WHERE "vendor_match_vendor_id" IS NULL;

ALTER TABLE "bill_lines" ADD COLUMN IF NOT EXISTS "gl_account" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bill_lines" ADD COLUMN IF NOT EXISTS "department" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bill_lines" ADD COLUMN IF NOT EXISTS "location" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bill_lines" ADD COLUMN IF NOT EXISTS "project" TEXT NOT NULL DEFAULT '';

ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "ocr_status" TEXT;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "ocr_payload" JSONB;