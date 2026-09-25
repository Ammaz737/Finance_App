-- P0-GF3: Procurement hardening — policy, issuance, receiving qty, match exceptions, change orders

ALTER TABLE "procurement_programs" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "procurement_programs" ADD COLUMN IF NOT EXISTS "match_tolerance_pct" DECIMAL(8,4) NOT NULL DEFAULT 0.01;
ALTER TABLE "procurement_programs" ADD COLUMN IF NOT EXISTS "require_receiving" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "procurement_programs" ADD COLUMN IF NOT EXISTS "budget_id" TEXT;
ALTER TABLE "procurement_programs" ADD COLUMN IF NOT EXISTS "legal_entity_id" TEXT;

ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "department_id" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "proposed_vendor_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '';
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "frequency" TEXT NOT NULL DEFAULT 'ONE_TIME';
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "desired_date" TIMESTAMP(3);
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "attachment_id" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "contract_id" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "policy_result" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "policy_reason" TEXT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "policy_matched_rules" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "policy_required_actions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "policy_version" INT;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "policy_evaluated_at" TIMESTAMP(3);

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "owner_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "expected_delivery" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "payment_terms" TEXT NOT NULL DEFAULT '';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "version" INT NOT NULL DEFAULT 1;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "ordered_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- Migrate OPEN POs to ISSUED semantics for receiving eligibility
UPDATE "purchase_orders" SET "status" = 'ISSUED', "issued_at" = COALESCE("issued_at", "created_at")
WHERE "status" = 'OPEN';

ALTER TABLE "purchase_order_lines" ADD COLUMN IF NOT EXISTS "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_order_lines" ADD COLUMN IF NOT EXISTS "department" TEXT NOT NULL DEFAULT '';
ALTER TABLE "purchase_order_lines" ADD COLUMN IF NOT EXISTS "location" TEXT NOT NULL DEFAULT '';
ALTER TABLE "purchase_order_lines" ADD COLUMN IF NOT EXISTS "project" TEXT NOT NULL DEFAULT '';

ALTER TABLE "receiving_records" ADD COLUMN IF NOT EXISTS "purchase_order_line_id" TEXT;
ALTER TABLE "receiving_records" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(18,4);
ALTER TABLE "receiving_records" ADD COLUMN IF NOT EXISTS "receipt_type" TEXT NOT NULL DEFAULT 'AMOUNT';
ALTER TABLE "receiving_records" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "receiving_records_org_idempotency_key"
  ON "receiving_records"("organization_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "reason_code" TEXT NOT NULL DEFAULT '';
ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "exception_status" TEXT NOT NULL DEFAULT '';
ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "expected_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "actual_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "tolerance" DECIMAL(18,4) NOT NULL DEFAULT 0.01;
ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "assigned_to" TEXT;
ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "resolution" TEXT NOT NULL DEFAULT '';
ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "resolved_by" TEXT;
ALTER TABLE "match_records" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);

UPDATE "match_records" SET "exception_status" = 'OPEN' WHERE "status" = 'EXCEPTION' AND ("exception_status" = '' OR "exception_status" IS NULL);

CREATE TABLE IF NOT EXISTS "po_change_orders" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "version" INT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "previous_value" JSONB NOT NULL DEFAULT '{}',
  "new_value" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requested_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_at" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "po_change_orders_org_po_idx" ON "po_change_orders"("organization_id", "purchase_order_id");
