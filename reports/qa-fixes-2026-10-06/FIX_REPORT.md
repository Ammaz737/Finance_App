# Application fixes and verification

6 October 2026 · Finance workspace

The financial replay, settlement verification, refund accounting, quote validation, card separation and compilation defects have been corrected. Unsupported Duffel booking/refund operations now fail explicitly instead of fabricating success. Live Duffel fulfillment and hotel/car account capabilities remain unfinished; this report does not mark them as working integrations.

## Step-by-step changes

| Step | Findings | Change | Status |
|---|---|---|---|
| 1 | QA-01 | Serialize fund reservations and save each authorization decision in the same transaction. Repeated/concurrent deliveries reuse the saved decision. | Fixed |
| 2 | QA-02 | Preserve issuer debit/credit direction. Capture, fund change, budget actuals, expense, accounting and outbox commit atomically. Refunds credit the fund and accounting; no new refund expense is created. | Fixed |
| 3 | QA-03 | Retrieve the Stripe transaction and verify payment metadata, dedicated bill-pay card, debit type/sign, amount and currency before settlement. Reject invented and mock references. | Fixed |
| 4 | QA-04 | Use stable Stripe idempotency keys per application payment for capture and metadata tagging. | Fixed; actual Stripe sandbox replay passed |
| 5 | QA-05 | Persist server-returned search offers and validate selection against those offers. Reject unknown, expired and altered quotes. Derive policy and booking details on the server. | Fixed |
| 6 | QA-06 | Stop simulated Duffel holds, confirmation, cancellation and refunds. Reprice flight offers using Duffel's offer endpoint. Expose capabilities and hide unavailable fulfillment actions in the UI. | False-success defect guarded; real fulfillment still requires implementation |
| 7 | QA-07, QA-08 | Gate hotel/car searches behind explicit provider capability flags, disabled by default, and disable unsupported options in the UI. | Guarded; provider account access remains required |
| 8 | QA-09, QA-10 | Align Stripe initialization with the installed SDK and correct the navigation permission helper's accepted type. | API and web type checks pass |
| 9 | QA-11 | Reject whitespace-only trip names. | Fixed |
| 10 | QA-12 | Respect explicit process environment values; load app-local defaults before workspace defaults without overriding them. | Fixed; isolated test server used mock providers and a separate database |
| 11 | QA-13 | Update issuer/accounting labels, required travel approvals, payment-run notice and activation/reset synchronization. Allow full journeys enough time for cold Next development compilation. | Browser verification recorded below |
| 12 | QA-14 | Keep ordinary spend wallets separate from travel instruments. Each trip retains its own card/fund and controls; travel cards cannot be selected for ordinary wallet consolidation. | Dedicated-card regression and integrated browser journey pass |

## Validation results

- **API:** 138/138 tests passed across 36 files, including the new financial and travel regressions. See [api-results.json](api-results.json) and [api-tests.log](api-tests.log).
- **Worker:** 2/2 tests passed. See [worker-tests.log](worker-tests.log).
- **Compilation:** API and web TypeScript checks passed. All runner statuses are zero in [check-status.json](check-status.json).
- **Browser:** all 25 scenarios passed across the main run and a targeted retry. The first run passed 24/25; the spend journey hit the old 60-second limit during cold compilation. After raising the full-journey limit to 120 seconds, that journey passed in about 90 seconds. See [e2e-results.json](e2e-results.json), [e2e-retry-results.json](e2e-retry-results.json) and their logs. This is a combined result, not a claim that the first run was clean.
- **Repository whitespace:** `git diff --check` passed.

Actual Stripe test-mode evidence is in [stripe-live-test.json](stripe-live-test.json). Two $1 release requests returned the same `ipi_` transaction, representing one sandbox debit. The matching settlement completed. A different payment ID and an invented reference were rejected. No live payment was made.

Financial regression coverage includes concurrent authorization replay, concurrent transaction replay, authorized capture without a second fund debit, signed refund credit with no refund expense, force capture, and rollback followed by retry. Travel regressions cover tampered price/policy flags, invented offers, blank names, and separate cards for ordinary spend and two trips.

Browser coverage includes spend-to-accounting, bill approval/payment/settlement, partial payments, procurement/receiving/matching, standard/mileage/per-diem reimbursement, travel approval/booking/expense/accounting, cancel/refund, tenant boundaries, separation of duties, integrated coexistence, invitation/activation, password reset, payment runs and configuration.

## Remaining work and practical limits

1. **Real Duffel fulfillment is not connected.** The application still needs passenger data collection, real order creation/payment, provider confirmation and real cancellation/refund integration. The mock provider remains a simulation. The Duffel provider now reports this limitation and rejects unsupported fulfillment actions.
2. **Duffel hotel/car access:** provider account capability must be enabled and verified before setting `DUFFEL_ENABLE_STAYS=true` or `DUFFEL_ENABLE_CARS=true`. Flags are deployment configuration, not proof that the account supports a service.
3. **Historical records:** these fixes prevent new incorrect effects. They do not automatically repair previously duplicated debits, inflated accounting amounts, simulated confirmations or cards affected by the old shared-card behavior. Those records require reconciliation using provider evidence before correction.
4. **Refund evidence correction:** the earlier report's handcrafted negative refund sample did not represent an ordinary Stripe issuer credit. The new regression uses a provider-positive refund amount, stores a negative application spend amount, restores the fund, and queues a negative accounting amount. Actual capture settlement verification also checked the provider's debit sign.
5. Tests use a dedicated Postgres database and mock providers unless explicitly identified as the Stripe sandbox check. Passing mock booking/accounting flows does not verify real ticket issuance or external ERP posting. Test coverage is substantial, not exhaustive.

## Reproducing checks

From the repository root, use the supplied isolated validation runner:

```powershell
node reports/qa-fixes-2026-10-06/validate.mjs
node reports/qa-fixes-2026-10-06/validate.mjs --browser
```

The runner reads local configuration without printing credentials, uses the dedicated database recorded in `environment.json`, and forces mock providers for the main suites. `--setup` creates/migrates/seeds a new environment when one is not already recorded. API/web logs and JSON results are saved beside this report. The Stripe sandbox script performs a $1 test-mode operation and is separate from these commands.
