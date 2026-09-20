-- M8: procurement form answers, PO lines, match records, outcome ids

ALTER TABLE "procurement_programs" ADD COLUMN IF NOT EXISTS "default_outcome_type" TEXT NOT NULL DEFAULT 'PURCHASE_ORDER';
ALTER TABLE "procurement_programs" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "procurement_programs_organization_id_status_idx"
  ON "procurement_programs"("organization_id", "status");

ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "vendor_id" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "outcome_id" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "form_answers" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "memo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "purchase_requests_organization_id_status_idx"
  ON "purchase_requests"("organization_id", "status");

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "commitment_amount" DECIMAL(18,2);
UPDATE "purchase_orders" SET "commitment_amount" = "amount" WHERE "commitment_amount" IS NULL;
ALTER TABLE "purchase_orders" ALTER COLUMN "commitment_amount" SET NOT NULL;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "matched_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "match_status" TEXT NOT NULL DEFAULT 'UNMATCHED';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DELETE FROM "purchase_orders" a USING "purchase_orders" b
  WHERE a.ctid < b.ctid AND a.organization_id = b.organization_id AND a.request_id = b.request_id;
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_organization_id_request_id_key"
  ON "purchase_orders"("organization_id", "request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_organization_id_number_key"
  ON "purchase_orders"("organization_id", "number");
CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_status_idx"
  ON "purchase_orders"("organization_id", "status");

CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
  "unit_amount" DECIMAL(18,2) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "purchase_order_lines_organization_id_purchase_order_id_idx"
  ON "purchase_order_lines"("organization_id", "purchase_order_id");

ALTER TABLE "receiving_records" ADD COLUMN IF NOT EXISTS "memo" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "receiving_records_organization_id_purchase_order_id_idx"
  ON "receiving_records"("organization_id", "purchase_order_id");

CREATE TABLE IF NOT EXISTS "match_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "bill_id" TEXT,
  "receiving_record_id" TEXT,
  "match_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'MATCHED',
  "po_amount" DECIMAL(18,2) NOT NULL,
  "received_amount" DECIMAL(18,2) NOT NULL,
  "billed_amount" DECIMAL(18,2) NOT NULL,
  "variance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "explanation" TEXT NOT NULL DEFAULT '',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "match_records_organization_id_purchase_order_id_idx"
  ON "match_records"("organization_id", "purchase_order_id");
CREATE INDEX IF NOT EXISTS "match_records_organization_id_bill_id_idx"
  ON "match_records"("organization_id", "bill_id");
