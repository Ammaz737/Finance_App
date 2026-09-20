-- Declined processor attempts deliberately retain unknown card/fund identifiers for
-- fraud/audit analysis. Those two columns are logical references only.
ALTER TABLE "card_authorizations" DROP CONSTRAINT IF EXISTS "card_auth_card_tenant_fk";
ALTER TABLE "card_authorizations" DROP CONSTRAINT IF EXISTS "card_auth_fund_tenant_fk";

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conrelid::regclass AS table_name, conname FROM pg_constraint WHERE contype='f' AND convalidated=false
  LOOP EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', r.table_name, r.conname); END LOOP;
END $$;
