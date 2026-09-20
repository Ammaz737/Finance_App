-- M3: card controls (MCC/velocity/per-txn) + capture/void/reverse lifecycle fields

ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "allowed_mccs_default" TEXT;
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "per_transaction_limit_default" DECIMAL(18,2);
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "velocity_max_amount_default" DECIMAL(18,2);
ALTER TABLE "spend_programs" ADD COLUMN IF NOT EXISTS "velocity_max_count_default" INTEGER;

ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "allowed_mccs" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "per_transaction_limit" DECIMAL(18,2);
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "velocity_max_amount" DECIMAL(18,2);
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "velocity_max_count" INTEGER;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "velocity_window_hours" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "captured_amount" DECIMAL(18,2);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "transactions_organization_id_card_id_authorized_at_idx"
  ON "transactions"("organization_id", "card_id", "authorized_at");
