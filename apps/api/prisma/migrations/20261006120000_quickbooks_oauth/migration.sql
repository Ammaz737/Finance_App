-- QuickBooks Online OAuth, tenant credentials, and provider entity mappings.

CREATE UNIQUE INDEX IF NOT EXISTS "users_organization_id_id_key"
  ON "users"("organization_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "integration_connections_id_organization_id_key"
  ON "integration_connections"("id", "organization_id");

CREATE TABLE IF NOT EXISTS "quickbooks_connections" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "integration_connection_id" TEXT NOT NULL,
  "realm_id" TEXT NOT NULL,
  "company_name" TEXT NOT NULL DEFAULT '',
  "access_token_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT NOT NULL,
  "access_token_expires_at" TIMESTAMP(3) NOT NULL,
  "refresh_token_expires_at" TIMESTAMP(3),
  "scopes" TEXT NOT NULL DEFAULT 'com.intuit.quickbooks.accounting',
  "environment" TEXT NOT NULL DEFAULT 'sandbox',
  "last_catalog_sync_at" TIMESTAMP(3),
  "disconnected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quickbooks_connections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_connections_integration_connection_id_key" ON "quickbooks_connections"("integration_connection_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_connections_organization_id_realm_id_key" ON "quickbooks_connections"("organization_id", "realm_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_connections_id_organization_id_key" ON "quickbooks_connections"("id", "organization_id");
CREATE INDEX IF NOT EXISTS "quickbooks_connections_organization_id_disconnected_at_idx" ON "quickbooks_connections"("organization_id", "disconnected_at");

CREATE TABLE IF NOT EXISTS "quickbooks_entity_maps" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "quickbooks_connection_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "local_id" TEXT NOT NULL DEFAULT '',
  "external_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL DEFAULT '',
  "sync_token" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quickbooks_entity_maps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_entity_maps_connection_type_external_key" ON "quickbooks_entity_maps"("quickbooks_connection_id", "entity_type", "external_id");
CREATE INDEX IF NOT EXISTS "quickbooks_entity_maps_organization_id_type_local_idx" ON "quickbooks_entity_maps"("organization_id", "entity_type", "local_id");
CREATE INDEX IF NOT EXISTS "quickbooks_entity_maps_organization_id_type_name_idx" ON "quickbooks_entity_maps"("organization_id", "entity_type", "display_name");

CREATE TABLE IF NOT EXISTS "quickbooks_webhook_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "quickbooks_connection_id" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processed_at" TIMESTAMP(3),
  "error" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quickbooks_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_webhook_events_provider_event_id_key" ON "quickbooks_webhook_events"("provider_event_id");
CREATE INDEX IF NOT EXISTS "quickbooks_webhook_events_org_processed_created_idx" ON "quickbooks_webhook_events"("organization_id", "processed_at", "created_at");

CREATE TABLE IF NOT EXISTS "provider_oauth_states" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "state_hash" TEXT NOT NULL,
  "return_path" TEXT NOT NULL DEFAULT '/app/accounting/integrations',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_oauth_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "provider_oauth_states_state_hash_key" ON "provider_oauth_states"("state_hash");
CREATE INDEX IF NOT EXISTS "provider_oauth_states_organization_provider_expires_idx" ON "provider_oauth_states"("organization_id", "provider", "expires_at");

ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_integration_tenant_fkey"
  FOREIGN KEY ("integration_connection_id", "organization_id") REFERENCES "integration_connections"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quickbooks_entity_maps" ADD CONSTRAINT "quickbooks_entity_maps_connection_tenant_fkey"
  FOREIGN KEY ("quickbooks_connection_id", "organization_id") REFERENCES "quickbooks_connections"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quickbooks_webhook_events" ADD CONSTRAINT "quickbooks_webhook_events_connection_tenant_fkey"
  FOREIGN KEY ("quickbooks_connection_id", "organization_id") REFERENCES "quickbooks_connections"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_oauth_states" ADD CONSTRAINT "provider_oauth_states_organization_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_oauth_states" ADD CONSTRAINT "provider_oauth_states_user_tenant_fkey"
  FOREIGN KEY ("organization_id", "user_id") REFERENCES "users"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
