# Application flow testing report

Date: 6 October 2026 · Timezone: Asia/Karachi

**Verdict: Critical financial/provider correctness and compilation issues require fixes before release confidence.**

API: 119 passed / 119 total. Worker catalog: 2 passed. Golden browser journeys: 17 passed, 8 failed, 25 total. Static admin routes: 92 checked, 0 flagged. Extra API input/access probes: 16 matched expectations, 4 differed.

## Scope and method

Company web portal + API + PostgreSQL workflows, current Stripe test account, Duffel search account and worker event catalog. Five seeded roles were exercised. Mock lifecycle tests cover spend, approvals, bills, partial payments, procurement/PO receiving and match exceptions, standard/mileage/per-diem reimbursements, travel, expense requirements, accounting coding/sync retry, tenancy, RBAC, reporting, budgets, documents and outbox. Existing golden journeys combine browser assertions with API data entry; supplemental tests include actual card and bill form inputs. Static route scans are rendering checks, not a claim that every action on every page was exercised.

Live money was not used. Stripe tests were restricted to sk_test_ and created three $1 test captures total, including the intentional replay; the newly issued QA card was cancelled. Signed Stripe webhook tests used real retrieved Stripe transaction data with a locally generated test signature against the application handler; actual Stripe CLI delivery and public HTTP webhook delivery were not verified. Existing configured demo database received QA records during the interrupted initial browser run because startup .env overrides defeated isolation; no existing data was reset or deleted. Isolated QA database and artifacts were retained. Full load/concurrency, accessibility, mobile/other browsers, mobile app, advisor/vendor portals, live ERP and real provider booking fulfillment were not exhaustively tested. Accounting and reimbursement payout adapters are mock; a successful local status is not an external ERP posting or actual payout. Past-dated trips also returned HTTP 201: flag this as a requirements question, since historical/import travel may intentionally be allowed.

## Priority findings

| ID | Priority | Finding | Flow break |
|---|---|---|---|
| QA-01 | P1 | Stripe authorization replay deducts funds twice | Stripe → authorization → fund balance |
| QA-02 | P1 | Stripe refund is recorded as new positive spend | Stripe refund → transaction → expense → accounting |
| QA-03 | P1 | Stripe payment settlement accepts a fabricated reference | Bill payment → confirm settlement |
| QA-04 | P1 | Stripe rail retries can create a second debit | Bill payment → release → provider retry |
| QA-05 | P1 | Travel trusts client supplied quote price and policy | Travel search → select quote → approval |
| QA-06 | P1 | Duffel confirmation/refund are simulated, not provider bookings | Travel quote → hold → confirm → cancel/refund |
| QA-07 | P1 | Hotel search blocked by Duffel account capability | Travel → HOTEL search |
| QA-08 | P1 | Car search blocked by Duffel account capability | Travel → CAR search |
| QA-09 | P1 | API typecheck fails on Stripe API version | Build/release → API compilation |
| QA-10 | P1 | Web typecheck fails across navigation permission checks | Build/release → web compilation |
| QA-11 | P2 | Blank travel trip name accepted | Travel → create trip |
| QA-12 | P2 | Application startup overrides externally supplied QA configuration | Startup → provider/database selection → tests |
| QA-13 | P2 | Golden tests contain stale selectors and lifecycle assumptions | Test suite → spend/accounting/travel end-to-end verification |
| QA-14 | P1 | Travel card controls block a later approved software purchase | Travel → shared employee card → software spend request → authorization |

## Reproducible issue details

### QA-01 — Stripe authorization replay deducts funds twice (P1)

- Flow: Stripe → authorization → fund balance
- Reproduce: Create a $100 fund and process the same $10 authorization object twice.
- Expected / actual and impact: Expected $90 after replay; actual $90 after first call and $80 after replay. Authorization row deduplication does not guard the fund decrement. Reproduced directly against the authorization handler; same-event webhook deduplication separately passes.
- Evidence: [stripe-regressions.json](stripe-regressions.json)
- Source: [apps/api/src/modules/cards/application/stripe-issuing-webhook.ts](../../apps/api/src/modules/cards/application/stripe-issuing-webhook.ts)
- Recommended fix: Make reservation, authorization persistence and provider decision transactional/idempotent; test handler replay, different event IDs for one authorization, partial failure and concurrent delivery.

### QA-02 — Stripe refund is recorded as new positive spend (P1)

- Flow: Stripe refund → transaction → expense → accounting
- Reproduce: Process an issuing_transaction.created object with type refund and amount -1000 USD minor units.
- Expected / actual and impact: Expected a $10 credit/reversal. Actual transaction, expense and accounting all contain positive $10. Math.abs discards the sign and the handler ignores transaction type. This inflates spend and does not restore the corresponding balance.
- Evidence: [stripe-regressions.json](stripe-regressions.json)
- Source: [apps/api/src/modules/cards/application/stripe-issuing-webhook.ts](../../apps/api/src/modules/cards/application/stripe-issuing-webhook.ts)
- Recommended fix: Branch on provider transaction type; preserve debit/credit meaning, link original transaction and reverse fund/budget/accounting effects exactly once.

### QA-03 — Stripe payment settlement accepts a fabricated reference (P1)

- Flow: Bill payment → confirm settlement
- Reproduce: Call StripePaymentRailAdapter.settle with nonexistent_qa_reference.
- Expected / actual and impact: Expected failure or provider verification. Actual COMPLETED with stripe_settle_nonexistent_qa_reference, without any Stripe lookup. Non-ipi references and mock references are accepted by the Stripe rail.
- Evidence: [stripe-regressions.json](stripe-regressions.json)
- Source: [apps/api/src/integrations/payment-rail/stripe.payment-rail.adapter.ts](../../apps/api/src/integrations/payment-rail/stripe.payment-rail.adapter.ts)
- Recommended fix: Require a verified transaction tied to this payment, tenant, card, amount and currency; reject unknown and mock references in the Stripe rail.

### QA-04 — Stripe rail retries can create a second debit (P1)

- Flow: Bill payment → release → provider retry
- Reproduce: Call the real Stripe test adapter twice using the same paymentId, $1 USD and identical description.
- Expected / actual and impact: Both accepted and returned different ipi transaction IDs. Two separate $1 sandbox debits were created. The adapter does not pass a provider idempotency key. This proves the adapter risk; a full network-failure/retry through the payment service was not simulated.
- Evidence: [stripe-sandbox.json](stripe-sandbox.json)
- Source: [apps/api/src/integrations/payment-rail/stripe.payment-rail.adapter.ts](../../apps/api/src/integrations/payment-rail/stripe.payment-rail.adapter.ts)
- Recommended fix: Pass a deterministic provider idempotency key derived from payment ID; persist/reconcile provider results before allowing a retry.

### QA-05 — Travel trusts client supplied quote price and policy (P1)

- Flow: Travel search → select quote → approval
- Reproduce: Search a flight, change its amount to 0.01, outOfPolicy to false and policyResult to PASS; also submit a fabricated quote ID.
- Expected / actual and impact: Both select-quote requests returned HTTP 200 and persisted a booking. Expected authoritative quote validation and policy recalculation. The server trusts price, policy result and provider identity supplied in the request. Approval is still required by the current workflow, but reviewers receive tampered data.
- Evidence: [input-probes.json](input-probes.json)
- Source: [apps/api/src/application/actions.ts](../../apps/api/src/application/actions.ts)
- Recommended fix: Persist or retrieve provider offers server-side, validate expiry/type/currency/price/ownership, and derive policy flags/results exclusively on the server.

### QA-06 — Duffel confirmation/refund are simulated, not provider bookings (P1)

- Flow: Travel quote → hold → confirm → cancel/refund
- Reproduce: Run Duffel adapter confirm/refund with fabricated duffel_hold_/duffel_conf_ references.
- Expected / actual and impact: Adapter returns CONFIRMED/REFUNDED and invents a confirmation number without a provider call. Hold and reprice are also local simulations. Search is real, but no flight ticket, hotel reservation, vehicle booking or provider refund is proved by these statuses.
- Evidence: [duffel-search.json](duffel-search.json)
- Source: [apps/api/src/integrations/travel/duffel.travel.adapter.ts](../../apps/api/src/integrations/travel/duffel.travel.adapter.ts)
- Recommended fix: Keep simulation clearly labeled throughout the UI, or implement provider order creation/payment, authoritative repricing, cancellation/refund requests and webhook reconciliation before claiming real booking completion.

### QA-07 — Hotel search blocked by Duffel account capability (P1)

- Flow: Travel → HOTEL search
- Reproduce: Search Chicago, 10–12 November 2026 with the configured provider account.
- Expected / actual and impact: Provider returns DUFFEL_ERROR: feature is not enabled for your account. Flight search returned 12 quotes, but hotel search cannot continue. Account/provider capability blocker; not a proven local calculation bug.
- Evidence: [duffel-search.json](duffel-search.json)
- Source: [apps/api/src/integrations/travel/duffel.travel.adapter.ts](../../apps/api/src/integrations/travel/duffel.travel.adapter.ts)
- Recommended fix: Enable the provider feature or disable the unavailable search choice with a clear capability message.

### QA-08 — Car search blocked by Duffel account capability (P1)

- Flow: Travel → CAR search
- Reproduce: Run the same search with CAR.
- Expected / actual and impact: Provider returns feature is not enabled for your account. Car quote selection and booking cannot proceed using this configuration.
- Evidence: [duffel-search.json](duffel-search.json)
- Source: [apps/api/src/integrations/travel/duffel.travel.adapter.ts](../../apps/api/src/integrations/travel/duffel.travel.adapter.ts)
- Recommended fix: Confirm endpoint/account support and enable it, or route car rental to a supported provider and expose capabilities in the UI.

### QA-09 — API typecheck fails on Stripe API version (P1)

- Flow: Build/release → API compilation
- Reproduce: Run node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit from apps/api.
- Expected / actual and impact: TS2322 at stripe.payment-rail.adapter.ts:27: configured 2024-11-20.acacia is incompatible with the installed SDK type 2025-02-24.acacia. Runtime tests passing do not remove this compilation failure.
- Evidence: [api-typecheck.log](api-typecheck.log)
- Source: [apps/api/src/integrations/payment-rail/stripe.payment-rail.adapter.ts](../../apps/api/src/integrations/payment-rail/stripe.payment-rail.adapter.ts)
- Recommended fix: Align SDK and configured API version deliberately and rerun typecheck/provider regression tests.

### QA-10 — Web typecheck fails across navigation permission checks (P1)

- Flow: Build/release → web compilation
- Reproduce: Run node ../../node_modules/typescript/bin/tsc --noEmit from apps/web.
- Expected / actual and impact: 115 TypeScript error diagnostics were observed. Callers pass href/permission objects without required label to a NavigationItem parameter. Affected accounting, vendor, bill-pay, dashboard and other pages. Dev rendering succeeded but production build readiness is not verified.
- Evidence: [web-typecheck.log](web-typecheck.log)
- Source: [apps/web/src/config/navigation.ts](../../apps/web/src/config/navigation.ts)
- Recommended fix: Use the correct minimal permission-check input type or provide complete NavigationItem objects consistently; resolve all diagnostics before release.

### QA-11 — Blank travel trip name accepted (P2)

- Flow: Travel → create trip
- Reproduce: POST a valid travel trip with name set to an empty string.
- Expected / actual and impact: HTTP 201 creates an unnamed record. Expected a required trimmed name or server generated descriptive name.
- Evidence: [input-probes.json](input-probes.json)
- Source: [apps/api/src/application/actions.ts](../../apps/api/src/application/actions.ts)
- Recommended fix: Validate trimmed required fields centrally before writing records.

### QA-12 — Application startup overrides externally supplied QA configuration (P2)

- Flow: Startup → provider/database selection → tests
- Reproduce: Start apps/api/src/app/server.ts with explicit mock providers and an isolated DATABASE_URL while apps/api/.env contains provider settings.
- Expected / actual and impact: server.ts loads apps/api/.env with override:true. Initial browser run used configured provider/database settings rather than the requested isolation. It was interrupted; its failures were excluded from final golden counts. A direct QA bootstrap subsequently enforced the isolated database.
- Evidence: [api-server.log](api-server.log)
- Source: [apps/api/src/app/server.ts](../../apps/api/src/app/server.ts)
- Recommended fix: Define documented environment precedence and allow explicit process variables/QA env files to win. Add startup assertions for effective database and providers in the QA harness.

### QA-13 — Golden tests contain stale selectors and lifecycle assumptions (P2)

- Flow: Test suite → spend/accounting/travel end-to-end verification
- Reproduce: Run the checked-in golden suite against current mock app.
- Expected / actual and impact: Known failures assert old SANDBOX / MOCK CARD text, uppercase BILL/PAYMENT display labels, or expect in-policy travel to skip approval. Current UI uses Sandbox / mock issuer and human-readable source labels, while current travel requires approvals. Supplemental current-flow tests successfully completed booking/capture/expense/accounting/cancel/refund. See individual golden results for all failures.
- Evidence: [e2e-results.json](e2e-results.json)
- Source: [apps/web/e2e/golden-flows.spec.ts](../../apps/web/e2e/golden-flows.spec.ts)
- Recommended fix: Update test assertions to current requirements; correlate expenses/accounting with the created transaction rather than selecting any pre-existing incomplete expense; keep mock and Stripe suites separate.

### QA-14 — Travel card controls block a later approved software purchase (P1)

- Flow: Travel → shared employee card → software spend request → authorization
- Reproduce: After confirming a travel trip, create a $60 software virtual-card spend request for the same employee; obtain manager and admin approval; authorize $1 at OpenAI with merchantCategory software.
- Expected / actual and impact: The software request is FULFILLED and card ACTIVE, but the reused card retains travel-only allowed MCCs. Authorization is DECLINED with MCC_BLOCKED. Reproduced sequentially after the golden suite finished, without concurrent travel mutations. This explains the integrated coexistence journey failure: individually approved workflows interfere through shared card state.
- Evidence: [coexistence-probe.json](coexistence-probe.json)
- Source: [apps/api/src/application/actions.ts](../../apps/api/src/application/actions.ts)
- Recommended fix: Model program/fund/card controls explicitly. Either keep a dedicated travel card or reconcile effective controls when switching/adding approved spend authority; verify simultaneous trips and software spend without losing original fund ownership.

## Provider verification

Stripe read-only balance, configured financial account (open, livemode false), configured bill-pay card (active, USD), and Duffel authentication all passed. Stripe sandbox cardholder creation, card issuing, freeze, unfreeze, force-capture, verified settlement lookup, signed transaction import, same-event deduplication, invalid-signature rejection and transaction-to-expense/accounting propagation passed. Payment-release replay failed idempotency. [Stripe evidence](stripe-sandbox.json), [read-only checks](provider-probes.json).

Duffel FLIGHT returned 12 real provider quotes. HOTEL and CAR failed account feature access. Duffel booking/refund adapter behavior is simulated. [Duffel evidence](duffel-search.json).

## Supplemental complete journey

Travel draft → flight search → select → PENDING_APPROVAL → manager approval → admin approval → mock hold → CONFIRMED → virtual card → UI $25 authorization/capture → matched expense memo/submit/manager approval → matched accounting code/ready/sync → booking cancellation/refund. This completed under current required approvals; ERP is mock. [Step evidence](supplemental-flow.json), [capture screenshot](supplemental-capture.png).

Bill form: entered invoice/due dates, two lines, quantity/unit price/tax and GL coding; checked server total. [Form evidence](form-inputs.json), [screenshot](bill-form.png).

## Golden browser test results

| Journey | Result |
|---|---|
| A: spend request to accounting golden journey | FAIL |
| A2: declined authorization + tenant isolation negatives | PASS |
| B: bill approval, release, settlement, and accounting golden journey | FAIL |
| B2: partial payment then settle remaining | PASS |
| B3: AP negatives — duplicate, creator SoD, tenant isolation | PASS |
| C: procurement request → PO → receiving → bill match → GF2 settle | PASS |
| C2: 3-way match exception when invoice exceeds received qty | PASS |
| C3: procurement negatives — self-approve, over-receive, duplicate PO | PASS |
| D: STANDARD reimbursement → approval → payout → accounting | PASS |
| D2: mileage server calc ignores forged amount | PASS |
| D3: per diem server calc and payout | PASS |
| D4: reimbursement negatives — SoD, duplicate, fail payout, forge blocked | PASS |
| E: travel request → book → fund/card → expense → accounting | FAIL |
| E2: out-of-policy travel requires approval before booking | PASS |
| E3: reprice above tolerance blocks automatic booking | PASS |
| E4: cancel and refund travel booking | FAIL |
| E5: travel security negatives — SoD, tenant isolation, MCC, idempotency | PASS |
| F: integrated finance coexistence journey | FAIL |
| G1 — Invite → Activate → Login | FAIL |
| G2 — Forgot Password → Reset → Login | FAIL |
| G3 — approved bill payment → run → release → settlement | FAIL |
| G4 — Vendor payment details → Bill → Payment permission path | PASS |
| G5 — Procurement match exception → Resolve | PASS |
| G6 — Admin policy + approval workflow configuration | PASS |
| G7 — Spend request form loads entity and program options | PASS |

**A: spend request to accounting golden journey**

```text
Error: expect(locator).toBeVisible() failed

Locator: getByText(/SANDBOX \/ MOCK CARD/)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/SANDBOX \/ MOCK CARD/) with timeout 5000ms
  - waiting for getByText(/SANDBOX \/ MOCK CARD/)

```

**B: bill approval, release, settlement, and accounting golden journey**

```text
Error: expect(locator).toBeVisible() failed

Locator: getByText(/BILL|PAYMENT/).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/BILL|PAYMENT/).first() with timeout 5000ms
  - waiting for getByText(/BILL|PAYMENT/).first()

```

**E: travel request → book → fund/card → expense → accounting**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

**E4: cancel and refund travel booking**

```text
Error: POST /travel-bookings/54aba01e-0873-4557-84c6-718a9ee38755/book-mock: 409 {"error":{"code":"APPROVAL_REQUIRED","message":"Trip must be ready to book before mock booking","details":{},"requestId":"b49c196b-ceea-46fb-8c28-ee35d2e74df6"}}

expect(received).toBeTruthy()

Received: false
```

**F: integrated finance coexistence journey**

```text
Error: expect(received).toBe(expected) // Object.is equality

Expected: "APPROVED"
Received: "DECLINED"
```

**G1 — Invite → Activate → Login**

```text
Error: expect(locator).toBeVisible() failed

Locator: getByText('Your account is active.')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Your account is active.') with timeout 5000ms
  - waiting for getByText('Your account is active.')

```

**G2 — Forgot Password → Reset → Login**

```text
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/app\/home/
Received string:  "http://localhost:3122/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html lang="en">…</html>
       - unexpected value "http://localhost:3122/login"

```

**G3 — approved bill payment → run → release → settlement**

```text
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('status')
Expected substring: "Payment added"
Received string:    "Payments added to run."
Timeout: 5000ms

Call log:
  - Expect "toContainText" getByRole('status') with timeout 5000ms
  - waiting for getByRole('status')
    8 × locator resolved to <p role="status" class="notice">Payments added to run.</p>
      - unexpected value "Payments added to run."

```

## Input, validation and access results

| Case | HTTP | Result |
|---|---|---|
| employee entity scope | 200 | PASS |
| travel negative amount | 400 | PASS |
| travel zero amount | 400 | PASS |
| travel invalid money | 400 | PASS |
| travel excess precision | 400 | PASS |
| travel bad currency | 400 | PASS |
| travel reverse dates | 400 | PASS |
| travel invalid date | 400 | PASS |
| travel blank destination | 400 | PASS |
| travel blank name | 201 | FAIL |
| travel past trip | 201 | FAIL |
| travel valid trip | 201 | PASS |
| travel flight search | 200 | PASS |
| travel quote tamper amount and policy | 200 | FAIL |
| travel fabricated quote | 200 | FAIL |
| travel submit | 200 | PASS |
| travel self approval blocked | 403 | PASS |
| employee accounting denied | 403 | PASS |
| employee payment creation denied | 403 | PASS |
| unauthenticated people denied | 401 | PASS |

Past-trip acceptance is not classified as a confirmed defect without a booking-versus-historical-entry requirement. The other failed probes reproduce the quote/name findings above.

## Route rendering inventory

Each route was loaded as Owner in Chrome. Dynamic detail routes are covered selectively by golden journeys; public authentication flows are covered by G1/G2. A successful page load alone does not establish lifecycle correctness.

| Route | HTTP | Page errors | Failed API calls |
|---|---|---|---|
| /app/accounting/banking | 200 | 0 | None |
| /app/accounting/bill-pay | 200 | 0 | None |
| /app/accounting/card | 200 | 0 | None |
| /app/accounting/errors | 200 | 0 | None |
| /app/accounting/integrations | 200 | 0 | None |
| /app/accounting/overview | 200 | 0 | None |
| /app/accounting/ready-to-sync | 200 | 0 | None |
| /app/accounting/reimbursements | 200 | 0 | None |
| /app/accounting/review | 200 | 0 | None |
| /app/accounting/rules | 200 | 0 | None |
| /app/accounting/synced | 200 | 0 | None |
| /app/ai/activity | 200 | 0 | None |
| /app/ai/agents | 200 | 0 | None |
| /app/ai/ask | 200 | 0 | None |
| /app/ai/router | 200 | 0 | None |
| /app/ai/sheets | 200 | 0 | None |
| /app/ai/token-spend | 200 | 0 | None |
| /app/banking/accounts | 200 | 0 | None |
| /app/banking/automations | 200 | 0 | None |
| /app/banking/forecast | 200 | 0 | None |
| /app/banking/statements | 200 | 0 | None |
| /app/banking/transactions | 200 | 0 | None |
| /app/banking/transfers | 200 | 0 | None |
| /app/bill-pay/bills/new | 200 | 0 | None |
| /app/bill-pay/bills | 200 | 0 | None |
| /app/bill-pay/payment-runs | 200 | 0 | None |
| /app/bill-pay/payments | 200 | 0 | None |
| /app/bill-pay/recurring | 200 | 0 | None |
| /app/bill-pay/settings | 200 | 0 | None |
| /app/cards | 200 | 0 | None |
| /app/company/accounting-dimensions | 200 | 0 | None |
| /app/company/approvals | 200 | 0 | None |
| /app/company/audit | 200 | 0 | None |
| /app/company/billing | 200 | 0 | None |
| /app/company/departments | 200 | 0 | None |
| /app/company/entities | 200 | 0 | None |
| /app/company/integrations | 200 | 0 | None |
| /app/company/locations | 200 | 0 | None |
| /app/company/people | 200 | 0 | None |
| /app/company/policy | 200 | 0 | None |
| /app/company/rewards | 200 | 0 | None |
| /app/company/roles | 200 | 0 | None |
| /app/company/security | 200 | 0 | None |
| /app/company/settings | 200 | 0 | None |
| /app/developer | 200 | 0 | None |
| /app/disputes | 200 | 0 | None |
| /app/expenses/receipts | 200 | 0 | None |
| /app/expenses/reimbursements | 200 | 0 | None |
| /app/expenses/transactions | 200 | 0 | None |
| /app/expenses/travel | 200 | 0 | None |
| /app/home | 200 | 0 | None |
| /app/inbox | 200 | 0 | None |
| /app/insights/budgets | 200 | 0 | None |
| /app/insights/dashboard | 200 | 0 | None |
| /app/insights/license-intelligence | 200 | 0 | None |
| /app/insights/price-intelligence | 200 | 0 | None |
| /app/insights/reports | 200 | 0 | None |
| /app/insights/savings | 200 | 0 | None |
| /app/me/cards | 200 | 0 | None |
| /app/me/expenses | 200 | 0 | None |
| /app/me/reimbursements | 200 | 0 | None |
| /app/me/requests | 200 | 0 | None |
| /app/me/travel | 200 | 0 | None |
| /app/notifications | 200 | 0 | None |
| /app | 200 | 0 | None |
| /app/procurement/contracts | 200 | 0 | None |
| /app/procurement/match-exceptions | 200 | 0 | None |
| /app/procurement/programs | 200 | 0 | None |
| /app/procurement/purchase-orders | 200 | 0 | None |
| /app/procurement/receiving | 200 | 0 | None |
| /app/procurement/renewals | 200 | 0 | None |
| /app/procurement/requests | 200 | 0 | None |
| /app/procurement/sourcing | 200 | 0 | None |
| /app/receivables/cash-application | 200 | 0 | None |
| /app/receivables/collections | 200 | 0 | None |
| /app/receivables/customers | 200 | 0 | None |
| /app/receivables/invoices | 200 | 0 | None |
| /app/receivables/payments | 200 | 0 | None |
| /app/search | 200 | 0 | None |
| /app/spend/cards | 200 | 0 | None |
| /app/spend/funds | 200 | 0 | None |
| /app/spend/programs | 200 | 0 | None |
| /app/spend/requests | 200 | 0 | None |
| /app/spend/transactions | 200 | 0 | None |
| /app/tax | 200 | 0 | None |
| /app/travel/policy | 200 | 0 | None |
| /app/travel/reports | 200 | 0 | None |
| /app/travel/requests | 200 | 0 | None |
| /app/travel/search | 200 | 0 | None |
| /app/travel/travelers | 200 | 0 | None |
| /app/travel/trips | 200 | 0 | None |
| /app/vendors | 200 | 0 | None |

## Fix and retest order

1. Correct Stripe refunds, authorization replay, release idempotency and authoritative settlement. Retest partial capture, reversal, different-event replay and provider timeout recovery.
2. Enforce server-authoritative travel quotes and make provider booking status truthful. Enable hotel/car capabilities or remove unavailable options.
3. Resolve API/web type errors and run production build.
4. Correct environment precedence and stale golden assertions, then rerun current happy paths plus the new regression probes.
5. Verify actual webhook HTTP delivery, real provider order/payment/refund and live ERP/payout integrations in their proper sandbox before marking those integrations complete.

## Evidence and reproducibility

All JSON, logs, scripts and screenshots are retained in this folder. Do not rerun run.mjs without addressing the documented startup env precedence; use api-isolated.mjs/rerun.mjs for the explicit isolated bootstrap. Provider scripts require the configured test credentials and network access; they never print secret keys. The database name is recorded in environment.json. Failed golden screenshots/traces are copied under browser-evidence when available.

## Focused authentication and form retests

Invitation activation and login, forgot-password reset, and login with the new password passed in a focused Chrome retest (HTTP 200). Workspace/email were explicitly filled in the activation form; the first focused attempt relying on automatic prefill did not submit because required fields remained blank. Golden G1/G2 failures therefore remain evidence of prefill/timing-sensitive UI verification, not a confirmed backend authentication failure. [Authentication retest](auth-retest.json).

Bill UI form successfully created a draft for Acme US LLC with two lines: 2 × 12.50 plus 2 tax, and 1 × 3.00. Expected and server amount were both USD 30. HTTP 201. Initial form probes used incomplete/wrong select labels; the corrected probe passed. [Bill form results](form-inputs.json).

Sequential coexistence retest confirmed a product defect: a newly approved software request reused the travel card and inherited travel-only MCCs, causing MCC_BLOCKED for OpenAI. [Coexistence evidence](coexistence-probe.json).
