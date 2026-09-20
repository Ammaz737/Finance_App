-- Refuse to install constraints if existing data contains an orphan or a cross-tenant reference.
DO $$
DECLARE problem text;
BEGIN
  SELECT check_name INTO problem FROM (VALUES
    ('users.organization', EXISTS (SELECT 1 FROM users c LEFT JOIN organizations p ON p.id=c.organization_id WHERE p.id IS NULL)),
    ('users.manager', EXISTS (SELECT 1 FROM users c LEFT JOIN users p ON (p.id,p.organization_id)=(c.manager_id,c.organization_id) WHERE c.manager_id IS NOT NULL AND p.id IS NULL)),
    ('spend_requests.program', EXISTS (SELECT 1 FROM spend_requests c LEFT JOIN spend_programs p ON (p.id,p.organization_id)=(c.program_id,c.organization_id) WHERE p.id IS NULL)),
    ('funds.request', EXISTS (SELECT 1 FROM funds c LEFT JOIN spend_requests p ON (p.id,p.organization_id)=(c.spend_request_id,c.organization_id) WHERE c.spend_request_id IS NOT NULL AND p.id IS NULL)),
    ('cards.fund', EXISTS (SELECT 1 FROM cards c LEFT JOIN funds p ON (p.id,p.organization_id)=(c.fund_id,c.organization_id) WHERE p.id IS NULL)),
    ('transactions.card', EXISTS (SELECT 1 FROM transactions c LEFT JOIN cards p ON (p.id,p.organization_id)=(c.card_id,c.organization_id) WHERE c.card_id IS NOT NULL AND p.id IS NULL)),
    ('expenses.transaction', EXISTS (SELECT 1 FROM expenses c LEFT JOIN transactions p ON (p.id,p.organization_id)=(c.transaction_id,c.organization_id) WHERE c.transaction_id IS NOT NULL AND p.id IS NULL)),
    ('bills.vendor', EXISTS (SELECT 1 FROM bills c LEFT JOIN vendors p ON (p.id,p.organization_id)=(c.vendor_id,c.organization_id) WHERE p.id IS NULL)),
    ('payments.bill', EXISTS (SELECT 1 FROM payments c LEFT JOIN bills p ON (p.id,p.organization_id)=(c.bill_id,c.organization_id) WHERE p.id IS NULL)),
    ('sync_attempts.entry', EXISTS (SELECT 1 FROM sync_attempts c LEFT JOIN accounting_entries p ON (p.id,p.organization_id)=(c.entry_id,c.organization_id) WHERE p.id IS NULL))
  ) AS checks(check_name, failed) WHERE failed LIMIT 1;
  IF problem IS NOT NULL THEN RAISE EXCEPTION 'P0 referential-integrity precheck failed: %', problem; END IF;
END $$;

ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "users" ADD CONSTRAINT "users_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "users" ADD CONSTRAINT "users_manager_tenant_fk" FOREIGN KEY ("manager_id","organization_id") REFERENCES "users"("id","organization_id") ON DELETE SET NULL ("manager_id") NOT VALID;
ALTER TABLE "users" ADD CONSTRAINT "users_department_tenant_fk" FOREIGN KEY ("department_id","organization_id") REFERENCES "departments"("id","organization_id") ON DELETE SET NULL ("department_id") NOT VALID;
ALTER TABLE "users" ADD CONSTRAINT "users_location_tenant_fk" FOREIGN KEY ("location_id","organization_id") REFERENCES "locations"("id","organization_id") ON DELETE SET NULL ("location_id") NOT VALID;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_tenant_fk" FOREIGN KEY ("user_id","organization_id") REFERENCES "users"("id","organization_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_tenant_fk" FOREIGN KEY ("user_id","organization_id") REFERENCES "users"("id","organization_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_tenant_fk" FOREIGN KEY ("role_id","organization_id") REFERENCES "roles"("id","organization_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "spend_programs" ADD CONSTRAINT "spend_programs_entity_tenant_fk" FOREIGN KEY ("legal_entity_id","organization_id") REFERENCES "legal_entities"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "spend_programs" ADD CONSTRAINT "spend_programs_budget_tenant_fk" FOREIGN KEY ("budget_id","organization_id") REFERENCES "budgets"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_entity_tenant_fk" FOREIGN KEY ("legal_entity_id","organization_id") REFERENCES "legal_entities"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_program_tenant_fk" FOREIGN KEY ("program_id","organization_id") REFERENCES "spend_programs"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_requester_tenant_fk" FOREIGN KEY ("requester_id","organization_id") REFERENCES "users"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "funds" ADD CONSTRAINT "funds_entity_tenant_fk" FOREIGN KEY ("legal_entity_id","organization_id") REFERENCES "legal_entities"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "funds" ADD CONSTRAINT "funds_owner_tenant_fk" FOREIGN KEY ("owner_id","organization_id") REFERENCES "users"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "funds" ADD CONSTRAINT "funds_request_tenant_fk" FOREIGN KEY ("spend_request_id","organization_id") REFERENCES "spend_requests"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "cards" ADD CONSTRAINT "cards_fund_tenant_fk" FOREIGN KEY ("fund_id","organization_id") REFERENCES "funds"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "cards" ADD CONSTRAINT "cards_holder_tenant_fk" FOREIGN KEY ("holder_id","organization_id") REFERENCES "users"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "card_authorizations" ADD CONSTRAINT "card_auth_card_tenant_fk" FOREIGN KEY ("card_id","organization_id") REFERENCES "cards"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "card_authorizations" ADD CONSTRAINT "card_auth_fund_tenant_fk" FOREIGN KEY ("fund_id","organization_id") REFERENCES "funds"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_tenant_fk" FOREIGN KEY ("card_id","organization_id") REFERENCES "cards"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fund_tenant_fk" FOREIGN KEY ("fund_id","organization_id") REFERENCES "funds"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_auth_tenant_fk" FOREIGN KEY ("authorization_id","organization_id") REFERENCES "card_authorizations"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_transaction_tenant_fk" FOREIGN KEY ("transaction_id","organization_id") REFERENCES "transactions"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_tenant_fk" FOREIGN KEY ("user_id","organization_id") REFERENCES "users"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expense_tenant_fk" FOREIGN KEY ("expense_id","organization_id") REFERENCES "expenses"("id","organization_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_user_tenant_fk" FOREIGN KEY ("user_id","organization_id") REFERENCES "users"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_entity_tenant_fk" FOREIGN KEY ("legal_entity_id","organization_id") REFERENCES "legal_entities"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "sync_attempts" ADD CONSTRAINT "sync_attempts_job_tenant_fk" FOREIGN KEY ("sync_job_id","organization_id") REFERENCES "sync_jobs"("id","organization_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "sync_attempts" ADD CONSTRAINT "sync_attempts_entry_tenant_fk" FOREIGN KEY ("entry_id","organization_id") REFERENCES "accounting_entries"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_entity_tenant_fk" FOREIGN KEY ("legal_entity_id","organization_id") REFERENCES "legal_entities"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "vendor_bank_accounts" ADD CONSTRAINT "vendor_bank_vendor_tenant_fk" FOREIGN KEY ("vendor_id","organization_id") REFERENCES "vendors"("id","organization_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_tenant_fk" FOREIGN KEY ("vendor_id","organization_id") REFERENCES "vendors"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "bills" ADD CONSTRAINT "bills_entity_tenant_fk" FOREIGN KEY ("legal_entity_id","organization_id") REFERENCES "legal_entities"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_tenant_fk" FOREIGN KEY ("bill_id","organization_id") REFERENCES "bills"("id","organization_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_tenant_fk" FOREIGN KEY ("bill_id","organization_id") REFERENCES "bills"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_run_tenant_fk" FOREIGN KEY ("payment_run_id","organization_id") REFERENCES "payment_runs"("id","organization_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_tx_tenant_fk" FOREIGN KEY ("ledger_tx_id","organization_id") REFERENCES "ledger_transactions"("id","organization_id") ON DELETE CASCADE NOT VALID;

