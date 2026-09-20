# Company web verification — 2026-09-17

Scope: company web portal plus supporting API, PostgreSQL, and worker. Mobile, vendor portal, advisor console, and Stack are outside this review. This is a read-only audit; no product data was changed.

## Verdict

The M1–M10 plan has substantial local sandbox implementation, but **the company web product is not fully verified or production ready, and it does not have full Ramp feature parity**. Completion labels in `IMPLEMENTATION_PLAN.md` describe local milestone slices. They do not establish live issuer, rail, ERP, travel, bank, document security, or browser journey readiness.

## Verification performed

| Check | Result |
|---|---|
| API, web, worker TypeScript checks | All passed |
| API Vitest including PostgreSQL suites | 23 files, 60 tests passed |
| PostgreSQL migrations | 13 active migrations finished through M10; two older `init` attempts were rolled back |
| API/web HTTP health | Both returned 200 locally |
| Signed-in browser | Home, Bill Pay list/detail, Accounting overview, and Travel trips rendered |
| Web page inventory | 99 app pages: 22 explicit stubs, 57 generic `ResourcePage` pages, 20 custom pages |
| Primary navigation | 61 links; none point to an explicit stub, but several P1/P2 generic resources remain visible |
| Database foreign keys | 0 in the public schema |
| Current async runtime | Redis refused connection; 29 outbox events pending, 0 published, 0 dead-lettered |

## What aligns with the plan

- Shared tenant/session/RBAC, scoped read paths, audit/outbox, idempotency, money checks, and quarantined document intake exist.
- Spend requests, virtual card sandbox, expenses/receipts, reimbursements, bills/payments, accounting, procurement/PO, travel mock bookings, and reporting have API paths and targeted database tests.
- Bill approval and payment release are distinct. In the browser, the Bill Pay list and detail showed the expected stage and balance language.
- Accounting queue and travel pages rendered in the signed-in portal. Mock holds are labeled as mock, rather than live bookings.

## Gaps and risks, in priority order

1. **Async flows are not operating in the current environment.** Redis is unavailable and no outbox event has been published. The worker dispatches payments, accounting sync, document scanning, and OCR through Redis/BullMQ. Local UI/API availability does not prove those downstream journeys currently work.
2. **Live financial and external integrations are absent.** Card issuing, payment release/settlement, ERP posting, travel booking, payout, OCR, document scan, bank data, HRIS, and other adapters are mock or empty. Production guards block several mock actions. Provider contracts, callbacks, reconciliation, certification, and failure drills remain outside the local milestone tests.
3. **No complete company-web browser acceptance suite.** API/DB tests are valuable, but there is no automated browser journey covering request → approval → card transaction → expense → accounting, or invoice → approval → release → settlement → accounting. The current manual browser check was read-only.
4. **Data integrity remains application enforced.** PostgreSQL has zero foreign keys. Cross-tenant and linked-object checks have tests for selected workflows, but the database itself does not prevent every orphan or cross-tenant reference.
5. **Visible P1/P2 sections overstate readiness.** AI/Sheets, receivables, disputes, tax, rewards, contracts, and developer pages are often generic resource lists, while the V3 priority section places many of these beyond P0. The 22 explicit stub pages also remain in the tree, though not in primary navigation.
6. **Ramp parity is broader than the completed plan.** Official Ramp materials describe physical and virtual cards, automatic receipt capture/matching, configurable payment release, real accounting integrations, booking, and banking. This repository has only virtual mock card issuance, mock travel/rail/ERP flows, and no wired bank-data provider. These are expected constraints for a local sandbox, not evidence of full Ramp equivalence.
7. **Production configuration needs a hard gate.** `apps/api/src/config/env.ts` falls back to a development JWT secret, while `apps/api/src/app/app.ts` enables reflective CORS (`origin: true`). Production startup should reject unsafe defaults and allow only configured origins.
8. **Status documents need reconciliation.** `IMPLEMENTATION_AUDIT.md` is the 2026-09-16 baseline and still describes the initial one-migration/72-model state. `IMPLEMENTATION_PLAN.md` now claims M10 complete, but some intermediate NEXT MILESTONE lines are stale. Use this report and current code/test results for the latest status.

## Recommended release gates

1. Restore Redis/worker and prove outbox payment, document, OCR, and accounting jobs move from pending to completed, including retry and dead-letter recovery.
2. Add a browser acceptance suite for the P0 journeys with role and entity variants, and run it against a disposable database.
3. Add tenant-safe foreign keys or equivalent database constraints after backfill analysis, plus migration tests.
4. Gate production startup on strong secrets, explicit CORS origins, and real provider configuration. Verify signed callbacks/webhooks, reconciliation, and failure modes.
5. Hide or label generic P1/P2 resource pages until their full lifecycles exist; keep the M1–M10 completion labels scoped to local sandbox acceptance.

Official comparison sources: [Ramp products](https://ramp.com/products), [Funds, cards, and Spend Programs](https://support.ramp.com/funds-cards-and-spend-programs/), [Bill Pay payment release](https://support.ramp.com/bill-pay-payment-release), [Automate receipts and expense requirements](https://support.ramp.com/automate-receipts-and-expense-requirements), [Ramp Travel](https://ramp.com/travel), [Ramp accounting overview](https://support.ramp.com/overview-of-ramp-accounting).

## Remediation update — 2026-09-20

- Added a Redis-independent, one-shot recovery command for supported events: `pnpm --filter @finance/worker outbox:drain`. It uses the existing claim, retry, dead-letter, and idempotent processor behavior.
- Drained the three actionable events that existed before this run: one document quarantine and two stale payment release events. Actionable pending count is now 0 and dead-letter count is 0. The document moved to `CLEAN`; the payment records had already been removed, so their idempotent processors made no financial mutation.
- Kept unrelated domain events pending because no consumer is registered for them. They were not falsely marked as delivered.
- Reverified authenticated Home, Bill Pay, Accounting, and Travel pages on `:3002`; the full sidebar remained present. Port `:3000` belonged to a separate local project and was not changed.
- Fixed two CSS compatibility warnings in the company web styles.
- Closed the unsafe production-default gate: production startup now rejects a missing database URL, the development JWT secret (or any secret shorter than 32 characters), and an empty CORS allowlist. Runtime CORS now permits only configured origins; local `:3000`/`:3002` defaults remain available in development.
- Re-ran web/worker/API TypeScript checks and the API regression suite: 24 files and 62 tests passed.

Redis/BullMQ is still required for continuous production-style processing. Docker Desktop started, but the current restricted runner could not access its named pipe, so container-backed continuous processing could not be proven in this run.
