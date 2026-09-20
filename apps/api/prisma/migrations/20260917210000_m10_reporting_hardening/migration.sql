-- M10: reporting freshness, notifications deep links, integration health, saved views

ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "freshness" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "budgets_organization_id_legal_entity_id_idx"
  ON "budgets"("organization_id", "legal_entity_id");

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "href" TEXT NOT NULL DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "object_type" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "object_id" TEXT;
CREATE INDEX IF NOT EXISTS "notifications_organization_id_user_id_created_at_idx"
  ON "notifications"("organization_id", "user_id", "created_at");

ALTER TABLE "integration_connections" ADD COLUMN IF NOT EXISTS "health" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "integration_connections" ADD COLUMN IF NOT EXISTS "last_error" TEXT NOT NULL DEFAULT '';
ALTER TABLE "integration_connections" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "integration_connections_organization_id_family_idx"
  ON "integration_connections"("organization_id", "family");

CREATE TABLE IF NOT EXISTS "saved_views" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL DEFAULT '{}',
  "columns" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "saved_views_organization_id_user_id_resource_idx"
  ON "saved_views"("organization_id", "user_id", "resource");
