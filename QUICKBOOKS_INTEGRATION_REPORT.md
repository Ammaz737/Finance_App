# QuickBooks Online Integration Report

Date: 2026-10-07

## Implemented scope

- Tenant-scoped Intuit OAuth 2.0 authorization with a random, hashed, single-use state and a ten-minute expiry.
- AES-256-GCM encryption for access and refresh tokens; tokens are never returned by status APIs.
- Automatic access-token refresh with optimistic concurrency protection for token rotation.
- QuickBooks company, chart of accounts, vendors, classes, and departments/locations import.
- Explicit default mappings for expense, card liability, accounts payable, and payment bank accounts.
- Provider entity mapping table for external ids, sync tokens, names, local vendor links, active state, and metadata.
- Signed and deduplicated QuickBooks webhooks routed through the transactional outbox and BullMQ accounting queue.
- Idempotent QuickBooks posting via `requestid` for:
  - card transactions to `Purchase` (`CreditCard` payment type);
  - approved bills to `Bill`;
  - settled bill payments to `BillPayment`;
  - paid reimbursements to employee `Vendor` + `Bill` + `BillPayment`.
- Integration health, last sync, errors, refresh, disconnect, and account mapping controls in the web application.

## Database evidence

- Migration: `20261006120000_quickbooks_oauth`.
- Applied successfully to the local PostgreSQL `finance` database on 2026-10-06.
- Composite tenant foreign keys prevent a provider connection, entity mapping, or OAuth state from referencing another organization.

## Verification evidence

- Prisma schema validation: passed.
- API TypeScript check: passed.
- Worker TypeScript check: passed.
- Web TypeScript check: passed.
- API test suite in deterministic mock-provider mode: 38 files and 144 tests passed.
- QuickBooks core tests: OAuth URL/scope, authenticated encryption, state hashing, and request idempotency passed.
- QuickBooks two-tenant database constraint test: passed.
- Worker event catalog tests: 2 passed.
- Database migrations: 27 found; QuickBooks migration applied successfully.

## External activation required

The repository does not currently contain Intuit credentials. Add the following values to both `apps/api/.env` and `apps/worker/.env` before performing the real Intuit sandbox handshake. Use the same encryption key in both processes:

```dotenv
ENCRYPTION_KEY=replace-with-one-stable-secret-at-least-16-characters
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_REDIRECT_URI=http://localhost:3001/api/v1/integrations/quickbooks/callback
QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN=
```

Configure the same redirect URI in the Intuit developer app. The webhook must be reachable by Intuit over public HTTPS, using a deployed API domain or an HTTPS tunnel to the local API:

```text
https://<your-api-domain>/api/v1/webhooks/quickbooks
```

After configuration, sign in as an accounting administrator and open **Accounting → Integrations → Connect QuickBooks**.
