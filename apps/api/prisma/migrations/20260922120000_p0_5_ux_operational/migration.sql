ALTER TABLE "users"
  ADD COLUMN "password_reset_token_hash" TEXT,
  ADD COLUMN "password_reset_expires_at" TIMESTAMP(3),
  ADD COLUMN "legal_entity_id" TEXT;

ALTER TABLE "departments" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "locations" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "approval_workflows"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "effective_to" TIMESTAMP(3);

ALTER TABLE "accounting_dimensions" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "payment_runs" ADD COLUMN "source_account_id" TEXT;
ALTER TABLE "bill_lines"
  ADD COLUMN "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
  ADD COLUMN "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE INDEX "users_organization_id_password_reset_token_hash_idx"
  ON "users"("organization_id", "password_reset_token_hash");
