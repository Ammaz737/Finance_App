-- Credential activation fields for draft people.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_must_change" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "activation_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "activation_expires_at" TIMESTAMP(3);
