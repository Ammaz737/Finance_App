-- Existing workflows were active before P0.5 introduced lifecycle fields.
-- Preserve that behavior while keeping newly-created versions disabled by default.
UPDATE "approval_workflows"
SET "enabled" = true
WHERE "effective_to" IS NULL
  AND "created_at" < "effective_from";
