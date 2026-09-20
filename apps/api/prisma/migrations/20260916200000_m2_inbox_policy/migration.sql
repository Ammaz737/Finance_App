-- M2: policy versioning, approval due/info fields, universal inbox items.

ALTER TABLE "policies"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "effective_to" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "policies_organization_id_object_type_enabled_idx"
  ON "policies"("organization_id", "object_type", "enabled");

ALTER TABLE "approval_workflows"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "approval_workflows_organization_id_object_type_idx"
  ON "approval_workflows"("organization_id", "object_type");

ALTER TABLE "approval_instances"
  ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "info_requested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "info_request_comment" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "approval_instances_organization_id_status_idx"
  ON "approval_instances"("organization_id", "status");

CREATE TABLE IF NOT EXISTS "inbox_items" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "object_type" TEXT NOT NULL,
  "object_id" TEXT NOT NULL,
  "approval_instance_id" TEXT,
  "assignee_id" TEXT,
  "requested_by_id" TEXT,
  "legal_entity_id" TEXT,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "policy_summary" TEXT NOT NULL DEFAULT '',
  "current_step" INTEGER NOT NULL DEFAULT 0,
  "total_steps" INTEGER NOT NULL DEFAULT 1,
  "due_at" TIMESTAMP(3),
  "available_actions" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inbox_items_organization_id_status_type_idx"
  ON "inbox_items"("organization_id", "status", "type");

CREATE INDEX IF NOT EXISTS "inbox_items_organization_id_object_type_object_id_idx"
  ON "inbox_items"("organization_id", "object_type", "object_id");
