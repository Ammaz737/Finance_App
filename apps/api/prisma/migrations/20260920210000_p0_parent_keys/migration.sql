-- Parent keys required by tenant-safe composite foreign keys.
CREATE UNIQUE INDEX IF NOT EXISTS "users_id_organization_id_key" ON "users"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "legal_entities_id_organization_id_key" ON "legal_entities"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "departments_id_organization_id_key" ON "departments"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "locations_id_organization_id_key" ON "locations"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "roles_id_organization_id_key" ON "roles"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_instances_id_organization_id_key" ON "approval_instances"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "attachments_id_organization_id_key" ON "attachments"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_id_organization_id_key" ON "budgets"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "spend_programs_id_organization_id_key" ON "spend_programs"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "spend_requests_id_organization_id_key" ON "spend_requests"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "funds_id_organization_id_key" ON "funds"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "cards_id_organization_id_key" ON "cards"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "card_authorizations_id_organization_id_key" ON "card_authorizations"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_id_organization_id_key" ON "transactions"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_id_organization_id_key" ON "receipts"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "expenses_id_organization_id_key" ON "expenses"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "reimbursements_id_organization_id_key" ON "reimbursements"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_entries_id_organization_id_key" ON "accounting_entries"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sync_jobs_id_organization_id_key" ON "sync_jobs"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_id_organization_id_key" ON "vendors"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bills_id_organization_id_key" ON "bills"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_id_organization_id_key" ON "payments"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_runs_id_organization_id_key" ON "payment_runs"("id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_transactions_id_organization_id_key" ON "ledger_transactions"("id", "organization_id");

