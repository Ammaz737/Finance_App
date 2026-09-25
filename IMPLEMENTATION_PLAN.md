# Implementation Plan — Company Web Portal

**Updated:** 2026-09-22 (P0.5 UX & Operational Completion)  
**Authoritative refs:** `RAMP_VERIFIED_PRODUCT_DESIGN_V3_OPTIMIZED.md`, `ON_PREMISES_MODULAR_ARCHITECTURE_GUIDE.md`  
**Baseline:** `IMPLEMENTATION_AUDIT.md` + `CURRENT_FOUNDATION_AUDIT.md` + GF1–GF5 audits + P0 closure docs  
**Delivery target:** Company web portal + API/DB/worker needed for real workflows. Mobile and specialist portals are excluded from this execution scope except minimal GF5 scaffold.

A rendered page is never a completion gate.

---

## P0.5 — UX & Operational Completion (2026-09-22)

**DONE:**

- Complete browser authentication lifecycle: invite/copy-link activation, activate, login, forgot/reset/change password, one-time token/session revocation, and explicit session-expiry messaging.
- Payment-run composition UI and APIs: source account, eligible payment selection, remove-before-release, totals/count/validation, release through existing GF2 settlement path.
- Protected vendor payment details, match-exception resolution, card controls/unfreeze, spend-program edit/deactivate, exact work/notification deep links.
- Bill create/DRAFT correction with line quantities, prices, tax, controlled accounting coding, invoice upload, server-authoritative totals, and cancel semantics.
- Domain correction actions for vendors, organizational units, budgets, bills, payments, POs, and spend programs; no generic hard-delete was introduced.
- Receipt candidate picker, reimbursement submit/calculation context, travel cancellation/refund, people/role administration, policy versioning/simulation, approval-workflow versioning/preview, and accounting-dimension administration.
- Migrations: `20260922120000_p0_5_ux_operational`, `20260922130000_p0_5_entity_status`, and `20260922140000_preserve_existing_workflows`.
- Verification: API/Web/Worker TypeScript green; API Vitest **104/104**; P0.5 Playwright G1–G6 **6/6**; preserved golden A–F suite **18/18**; combined browser run **24/24**.

**EVIDENCE:** `P0_5_UX_OPERATIONAL_AUDIT.md`, `P0_5_TEST_REPORT.md`.

**REMAINING / external only:** Production email delivery and certified issuer, payment rail, payout, ERP, OCR/scanner, and travel-provider adapters remain intentionally mocked or unconfigured. Advanced custom-role authoring remains documented outside P0.5; existing roles, scopes, restrictions, and assignments are operable.

**STOP:** P0.5 is the terminal milestone for this execution. Do not begin P1 or P2.

---

## P0 Closure — Portal hardening + evidence pack (2026-09-21)

**DONE:**

- GF1–GF5 product verticals closed as P0 (see sections below); gates: Vitest **104/104**, Playwright **18/18** (A–E5 + **F**), tsc API/Web/Worker green.
- Nav unfinished-route blocking for P1/P2 scaffolds unless `NEXT_PUBLIC_ENABLE_P1_ROUTES` / `NEXT_PUBLIC_ENABLE_P2_ROUTES`.
- Detail deep-links no longer inherit list-nav permission 403 (API RBAC/ownership remains the boundary).
- Travel search + reports nav; ResourcePage system-info drawer + clearer errors; global search expanded (reimbursements/payments/cards).
- Authz matrix documented from `resource-access.ts`; travel-bookings child `scopedWhere` fix retained from GF5.
- Evidence pack: `P0_CLOSURE_AUDIT.md`, `P0_AUTHORIZATION_MATRIX.md`, `P0_PERFORMANCE_REPORT.md`, `P0_ACCESSIBILITY_REPORT.md`, `P0_SECURITY_REVIEW.md`, `BACKUP_RESTORE_RUNBOOK.md`, `P0_CLOSURE_TEST_REPORT.md`.
- Money invariants: budget capture/reverse no longer spill to all entity budgets; travel refund restores fund availability capped at `limitAmount`; travel type KPIs are CONFIRMED bookings only.
- Authz: `policies`/`approvals` → `roles.assign`; people invite no longer double-gated with `roles.assign`.

**OPERATIONAL NOTE:** Redis requires Docker Desktop running; worker was reconnecting when Docker was down. Re-seed after Vitest if demo users drift.

**DEFERRED:** Live card/rail/ERP/travel/OCR/payout providers (mocks remain).

**STOP — do not start P1/P2** until this closure is accepted and phase flags are explicitly enabled for intentional scaffold work.

---

## P0-GF5 — Travel Request → Policy → Approval → Booking → Trip → Fund/Card → Expense → Accounting (2026-09-21)

**DONE:**

- Audit: `P0_GF5_TRAVEL_AUDIT.md`; report: `P0_GF5_TEST_REPORT.md`.
- TravelTrip as request aggregate; lifecycle includes `READY_TO_BOOK`, `BLOCKED`, booking cancel/refund.
- Shared policy snapshot + OOP/max-amount; approval SoD; inbox `TRAVEL_REQUEST`.
- MockTravelProvider: search FLIGHT/HOTEL/CAR, reprice, hold≠confirm, cancel, refund.
- Offer snapshot on select; reprice tolerance gate before book; booking idempotency key.
- Confirm provisions GF1 Travel Fund + sandbox virtual card (travel MCCs).
- Card capture auto-links expense to trip/booking; accounting via existing GF1 path.
- Reporting travel KPIs; trip detail UX (search/book/reprice/cancel/fund/card/activity).
- Migration `20260921180000_p0_gf5_travel` (+ TravelerProfile).
- Playwright E–E5; GF1–GF4 regression retained.
- Mobile: trip list/detail stubs only (native booking deferred).

**REMAINING / deferred:** Duffel/Expedia/TravelPerk adapters; email booking ingest; native search/book; guest booking; negotiated rates.

**NEXT:** Stop — do not start P1/P2.

---

## P0-GF4 — Reimbursement → Policy → Approval → Payout → Settlement → Accounting (2026-09-21)

**DONE:**

- Audit: `P0_GF4_REIMBURSEMENT_AUDIT.md`; report: `P0_GF4_TEST_REPORT.md`.
- STANDARD / MILEAGE / PER_DIEM; server calc ignores forged amounts/rates.
- DRAFT → submit with requirements + policy snapshot + duplicate check.
- Shared approval; payout permission separate; mock schedule → settle; FAILED/RETURNED.
- Accounting only after PAID; ERP code→ready→sync idempotent.
- Reporting KPIs; detail UX; inbox `REIMBURSEMENT_APPROVAL`.
- Migration `20260921160000_p0_gf4_reimbursements`.
- Vitest suite; Playwright A–D4; typecheck green; Redis PONG.
- Mobile: minimal create scaffold only (full native deferred).

**REMAINING / deferred:** native mobile capture; live payout rail; deep bank-return ledger; map mileage.

---

## P0-GF3 — Procurement → PO → Receiving → Match → GF2 AP (2026-09-21)

**DONE:**

- Audit: `P0_GF3_PROCUREMENT_AUDIT.md`; report: `P0_GF3_TEST_REPORT.md`.
- Program intake + Purchase Request lifecycle; shared policy snapshot on submit; manager→finance approval; SoD.
- Inbox `PROCUREMENT_REQUEST` + `PROCUREMENT_MATCH_EXCEPTION`.
- Idempotent PO create on final approval (`ISSUED`); lines; partial/qty/service receiving; over-receive blocked.
- 2/3-way match with % tolerance; first-class exceptions + resolve; GF2 Bill `purchaseOrderId`.
- Budget commitment on issue / release on matched bill; basic PO change orders.
- Reporting KPIs; request/PO/match-exception UX.
- Migration `20260921140000_p0_gf3_procurement`.
- Vitest suite green; Playwright C/C2/C3 (+ GF1/GF2); typecheck green. **Regression under GF4: 12/12 including C suite.**

**REMAINING / deferred:** sourcing/RFP; advanced contracts; external PO delivery; live rail/ERP certification.

---

## P0-GF2 — Vendor → Bill → Approval → Payment → Settlement → Accounting (2026-09-21)

**DONE:**

- Audit: `P0_GF2_AP_AUDIT.md`; report: `P0_GF2_TEST_REPORT.md`.
- Vendor legal/display name + paymentStatus; bank verify with changer SoD; Vendor 360 timeline/POs.
- Bill intake: vendor match + duplicate tiers + draft/NEEDS_REVIEW/submit; coding update; detail approval progress + timeline.
- Invoice sandbox OCR (`INVOICE` → `invoice.ocr_requested` → mock extraction → `createFromDocument`).
- Inbox `BILL_APPROVAL`; bill.approve ≠ payment.release preserved.
- Payment detail + AP reporting KPIs (overdue/partial/paid/failures/upcoming).
- Migration `20260921120000_p0_gf2_ap_hardening`.
- Vitest suite; Playwright B/B2/B3 (+ GF1 A/A2). **Regression under GF3/GF4 green.**

**REMAINING / deferred:** live rail/ERP certification; RETURNED full model; shared settle package extract; email intake.

---

## P0-GF1 — Spend → Card/Fund → Expense → Accounting (2026-09-20)

**DONE:**

- Audit: `P0_GF1_SPEND_AUDIT.md`; report: `P0_GF1_TEST_REPORT.md`.
- Spend submit persists policy snapshot; program eligibility; BLOCKED path.
- Approval → fund/card fulfillment ends in `FULFILLED` (idempotent replay).
- Card unfreeze/terminate; CARD_FROZEN decline; SANDBOX label on card UI.
- Request detail / expense requirements / dashboard KPIs.
- Migration `20260920230000_p0_gf1_spend_policy`.
- Playwright golden A + A2 negatives green (regression under GF2–GF4).

**REMAINING / deferred:** FUND_ONLY spend UI; DRAFT-only save; full eligibility admin UI; certified issuer/OCR/scanner.

---

## Execution rules

1. Preserve Node/Express/TypeScript, Next.js/React, PostgreSQL/Prisma, Redis/BullMQ modular monolith and local/NAS storage. Refactor `registry.ts` / `actions.ts` **incrementally** into existing module folders; do not replace the stack.
2. One vertical slice at a time: inspect → contract/schema → domain invariants → scoped API → transactional audit/outbox → worker/provider → web → tests → local journey → downstream verification.
3. Every financial command validates tenant, entity, linked objects, amount/currency, permission/scope, state, idempotency, and separation of duties. Business mutation, audit, and outbox commit together. Provider processing and settlement remain distinct states.
4. Authoritative money totals are server-side by currency and period. AI and mock adapters cannot execute live financial actions or claim live provider results.
5. At each milestone close, update **DONE / REMAINING / BLOCKERS / TEST RESULTS / NEXT MILESTONE**. Do not advance on page count or typecheck alone.

---

## Ordered milestones

| Milestone | Work / primary modules | Migration need | Acceptance / dependencies |
|---|---|---|---|
| **M1 — Shared control foundation** | Identity, org structure, roles/scopes, money/currency, policy/workflow **contracts**, audit/outbox/idempotency, attachment safety. Platform: `auth`, `resource-access`, `resource-router`, `database`, `events`, `idempotency`, `storage`. Engines: `policy`, `workflow`, `documents`. Packages: `money`, `contracts`, `permissions`. Company people/settings web. | Tenant-safe uniques/FKs only after orphan analysis + backfill plan. Durable command fields as needed. **No demo data wipe.** | Two-tenant/entity API tests; cross-tenant links fail; role/scope matrix; self-approval fails; state+audit+outbox atomic on money commands; idempotent replay; uploads quarantined until scan; worker dispatch/replay. **All later milestones depend on M1.** |
| **M2 — Approvals, policy, Universal Inbox** | One transactional workflow service + task projection; versioned policy definitions reused by evaluator; Inbox covers spend, expense, reimbursement, procurement/PO, bills, payment release, accounting exceptions; review drawer with policy, timeline, due date, actions, auto-next. | Versioned workflow/policy; InboxItem/assignment/comment/priority. | No self-approval; dynamic assignee; final approval + fulfillment atomic or resumable; request-info; policy simulation = execution. Depends on M1. |
| **M3 — Spend authority and cards** | Full request fields/lifecycle; budget/fund reservation; card controls; CardProcessor abstraction; auth/capture/reversal sandbox. | Fulfillment uniqueness; purpose/vendor/recurrence/expiry; provider refs. | Request → approval → one configured outcome; no duplicate fulfillment; no concurrent overspend. Depends on M1–M2. |
| **M4 — Transactions, receipts, expenses** | Clear only via provider/sandbox event; receipt quarantine/scan/link/OCR abstraction; expense requirements → policy → approval → accounting; hide generic Clear in prod UX. | Receipt links, evidence, dimensions, event refs. | Cleared txn → exactly one expense + accounting source; requirements enforced. Depends on M1–M3. |
| **M5 — Reimbursements** | STANDARD/MILEAGE/PER_DIEM; server calc; receipt; schedule + payout abstraction (approved ≠ paid). | Distance/rate/merchant/receipt; payout refs. | Independent reviewer; payout confirmation creates accounting once. Depends on M1–M2 + document/payment contracts. |
| **M6 — Vendor 360, AP, payments** | Shared vendor identity; intake/duplicate/PO/risk; bill approval ≠ payment release; partial payments; payment runs. | Vendor bank change history; invoice docs/lines; payment settlement IDs; run items. | Distinct `payment.release`; settlement only reduces remaining; no double settle. Depends on M1–M2; coordinate with M7. |
| **M7 — Accounting queue + ERP export** | Expand CARD/REIMBURSEMENT/BILL/PAYMENT sources; coding/rules/bulk/undo-ready/sync/retry; provider dimensions. | Tenant-safe source unique; sync attempts/errors. | One source row; sync reflects provider ack; retry never duplicates. Depends on M1 + source contracts. |
| **M8 — Procurement and POs** | Program → request → shared approval → outcome; PO lines; receiving; 2/3-way match; commitments. | Form answers, outcome IDs, PO lines, match records. | No PO before final approval; totals reconcile. Depends on M1–M2, M6–M7. |
| **M9 — Core travel** | Provider-independent trip request, dates, destination, cost, policy, approval, fund/itinerary/expense links. | Trip request + itinerary fields. | Out-of-policy requires approval; mock ≠ confirmed booking. Depends on M1–M4. |
| **M10 — Reporting, budgets, integrations, web hardening** | Budget actual/commitment read models; dashboards; search; integration health; notifications; saved views; a11y. | Read-model freshness; sync cursors. | Currency totals reconcile; no double count; P0 journeys pass in browser. Depends on M1–M9. |

P1/P2 V3 routes stay out of primary nav until genuine workflows exist. Real issuer/rail/ERP/travel certification is outside mock/local acceptance.

---

## Milestone 1 — task order

1. Lock baseline audit (DONE — `IMPLEMENTATION_AUDIT.md`).
2. Close disclosure/write holes: scoped search, secret-safe presenters, upload quarantine, linked-object checks + regression tests.
3. Organization-scoped identity; ambiguous cross-tenant login; people publish/terminate transactional effects.
4. **`auditedCommand` migration** for remaining high-risk money commands; keep public API stable.
5. Harden idempotency + outbox claim/retry/dead-letter; mock-only provider semantics.
6. Shared money/currency validation; entity/country capability checks; orphan analysis before FK migration.
7. Two-tenant fixtures, auth matrix, worker failure tests; browser session/role smoke.

### M1 tracking

**DONE:**

- Repository/schema/migration/route/UI/test/sample-data audit written and re-verified (demo DB counts captured).
- Scoped generic reads/actions; secret-safe people/integrations/audit/search presenters.
- Upload purpose permission, size, magic-byte validation; store as `QUARANTINED`.
- Login workspace slug + ambiguous email refusal; randomized JWT session IDs.
- Auth loads JWT + session + user + role assignment + entity downgrade for org grants on entity-scoped assignments.
- People publish/terminate via `auditedCommand` (sessions revoked, cards frozen, last-owner guard).
- Payment schedule uses `withIdempotency` + serializable txn with audit/outbox.
- Sandbox card auth idempotency with payload conflict 409.
- Worker publishes only events with processors.
- `@finance/money` parse/validate/compare + positive amount + currency match helpers and unit tests.
- Spend request create/approve: one transaction for domain + approval + fund/card fulfillment (resumable) + audit/outbox; money + entity checks.
- Expense approve, bill approve, card freeze: transactional status + audit/outbox; freeze is tenant-scoped.
- Workflow `startApproval` / `actOnApproval` accept an optional transaction client.
- Orphan analysis script → `docs/M1_ORPHAN_ANALYSIS.json` (demo clean; unsafe uniques documented).
- Malware scanner contract (`QuarantineOnlyScanner`) wired into `ingestDocument` — never marks CLEAN without a real engine.
- Remaining `mutate()` money paths removed; procurement/reimbursement/treasury transactional.
- Migration `20260916190000_m1_foundation_constraints` applied (tenant-safe uniques + outbox claim/DLQ columns).
- Outbox claim / retry / dead-letter / replay in API + worker.
- **People activation:** invite creates DRAFT + one-time activation token (no client-supplied temp password); `POST /identity/activate`; `reset-credentials` revokes sessions and re-issues token; web People form updated.
- **Document worker path:** `document.quarantined` → documents queue; quarantine-only scan keeps `QUARANTINED`.
- **Postgres tenancy matrix** (`tenancy.db.test.ts`): shared-email workspace login, cross-tenant bill denial, self-approval SoD, activation flow, concurrent fund auth, idempotency conflict.
- **2026-09-20 foundation hardening (M0/M1 gate):**
  - `CURRENT_FOUNDATION_AUDIT.md` — every gap-analysis claim classified CONFIRMED / ALREADY FIXED / PARTIAL / NOT APPLICABLE against live code.
  - DEPARTMENT scope in `scopedWhere`; Owner/Finance Admin/Manager/Employee auth matrix tests; route matrix module.
  - Approval engine: eligible resolvers, parallel steps, amount/dept/entity routing, reassignment, escalation, workflow version pin, distinct-control SoD.
  - Policy evaluation returns `result` / `reason` / `matchedRules` / `evidence` / `requiredActions`; card auth loads DB rules; active cardholder check.
  - Settlement: payments/transfers terminal success is `SETTLED` (not schedule/release); treasury `SENT` → sandbox `confirm-settlement`.
  - Idempotency on payment.release, bill.create (optional key), reimbursement.schedule (optional key).
  - Worker diagnostics: queueDepth, oldestJobAgeMs, retryCount, deadLetterCount, consumerLag.
  - Migration `20260920220000_m0_m1_foundation_hardening`.
  - Vitest: **27 files / 87 tests pass**; API/web/worker typecheck green. See `FOUNDATION_TEST_REPORT.md`.

**REMAINING:**

- None for M0/M1 foundation acceptance gates. Optional later: audit DB append-only triggers; unmount P1/P2 list stubs; Owner-only outbox replay HTTP API; browser Playwright (not blocking).

**BLOCKERS:**

- No external issuer, payment rail, ERP, travel, email, or malware scanner configured — blocks live production claims, not local M1 completion.
- Prisma `generate` may fail with Windows `EPERM` while API/worker holds the query engine DLL; restart those processes if client regeneration is needed.

**TEST RESULTS:**

- Vitest: 27 files, **87 tests pass** (unit + live Postgres).
- API/web/worker typecheck green.
- Migrations applied through `20260920220000_m0_m1_foundation_hardening`.

**NEXT MILESTONE:** Product verticals only after foundation gate — do not expand P1/P2 from this pass. Prior plan pointed at M2 Inbox polish; follow product priority separately.

---

## Milestone 2 — Approvals, policy, Universal Inbox

### M2 tracking

**DONE:**

- Schema + migration `20260916200000_m2_inbox_policy`: Policy version/priority/effective dates; ApprovalInstance `dueAt`/`priority`/`infoRequested*`; `InboxItem` projection table.
- Policy engine loads tenant DB rules (`receipt_required`, `memo_required`, `high_value`, `category_amount`, `manager_approval`) with defaults; `matchedRules` + evidence; shared by expense submit and `POST /policies/simulate`.
- Workflow `startApproval` writes InboxItem via `engines/inbox/sync.ts` (circular-import safe); due dates + priority; `request_info` path in inbox decide + workflow status `INFO_REQUESTED`.
- Universal Inbox API (`/inbox`, detail, decide): approvals (spend/expense/reimbursement/bill/procurement), payment release, accounting exceptions; next-task id after decide.
- Web Inbox: type filters, drawer with policy/timeline/due/actions, auto-next; Policy page simulate UI; CSS chips/panel/timeline.
- All money approval starts (spend, expense, bill, procurement, reimbursement) pass title/amount/currency/entity into Inbox projection.

**REMAINING:**

- Optional: read Inbox primarily from `InboxItem` table (today list is live-eligible projection + dual-write); browser Playwright smoke for request-info → reply → approve.
- Policy versioning UI (CRUD of rule JSON) beyond simulate — list still uses ResourcePage.

**BLOCKERS:**

- Same as M1: no live issuer/rail/ERP. Prisma `generate` may EPERM on Windows while API holds the query engine DLL (restart processes if regenerating).

**TEST RESULTS:**

- Vitest: 10 files, **25 tests pass** (policy suite updated for `matchedRules` + DB-style rules).
- API + web typecheck green after M2 migration deploy.
- Migration `20260916200000_m2_inbox_policy` applied.

**NEXT MILESTONE:** **M5 — Reimbursements.** M4 company-web acceptance is complete.

---

## Milestone 3 — Spend authority and cards

### M3 tracking

**DONE:**

- Migration `20260916210000_m3_spend_cards`: program `defaultFulfillmentType` / merchant lock / validity days; request purpose/vendor/recurrence/expiresAt; budget `committedAmount`; card `providerRef`/`network` + unique per fund; auth `providerEventId`.
- Migration `20260917120000_m3_card_controls_lifecycle`: card MCC allow-list, per-txn limit, velocity window/count/amount; program control defaults; txn `capturedAmount` / `voidedAt` / `reversedAt`.
- `createRequest` inherits program fulfillment/expiry; optional purpose/vendor/fulfillment override.
- `approveRequest`: budget capacity check + commit; `VIRTUAL_CARD` vs `FUND_ONLY`; `MockCardIssuerAdapter.issueVirtual()`; resume-safe unique fund/card; serializable txn; copies program MCC/velocity/per-txn defaults onto issued cards.
- `authorize`: fund ACTIVE/window, merchant lock, **BusinessLimit**, **MCC allow-list**, **per-txn limit**, **velocity**, issuer capacity, policy BLOCK; provider event id on approve path.
- Sandbox hold lifecycle: `capture` (full/partial + unused-hold release), `void` (PENDING → VOIDED + restore fund), `reverse` (CLEARED → REVERSED + restore fund/budget + cancel expense); `clear` aliases full capture.
- CardIssuerProvider extended with capture/void/reverse; mock adapter implements all.
- Web: programs in nav; program/request form fields for fulfillment, purpose, and control defaults; **card detail** (`/app/spend/cards/[id]`) and **fund detail** (`/app/spend/funds/[id]`) with balances, controls, auth/txn tables, sandbox authorize + capture/void/reverse; transactions list actions for capture/void/reverse/clear.
- DB tests: single card fulfillment, FUND_ONLY no card, merchant-lock decline, **request→approve→auth→partial capture E2E**, void restore, reverse+expense cancel, MCC/per-txn/velocity declines (`spend-fulfillment.db.test.ts`).

**REMAINING:**

- None for company-web M3 acceptance. Optional later: certified issuer adapter; Playwright browser smoke for detail screens.

**BLOCKERS:**

- No certified card issuer — sandbox/mock only (intentional for local M3).
- Prisma `generate` may EPERM on Windows while API holds the query engine DLL; restart `dev:api` if regenerating.

**TEST RESULTS:**

- Vitest spend-fulfillment: **7 tests pass** (M3 lifecycle + controls + E2E).
- API typecheck green after M3 controls migration.
- Migration `20260917120000_m3_card_controls_lifecycle` applied.

**NEXT MILESTONE:** **M4 — Transactions, receipts, expenses** (in progress). Finish migration apply + DB suite, then **M5 — Reimbursements.**

---

## Milestone 4 — Transactions, receipts, expenses

### M4 tracking

**DONE:**

- Migration authored: `20260917140000_m4_receipts_expenses` (expense unique per txn, receipt OCR fields + attachment unique, split `organizationId`, attachment default `QUARANTINED`, txn `providerClearEventId`).
- Capture creates expense for **card holder** with P2002-safe uniqueness; accounting upsert remains one `CARD_TRANSACTION` source; `providerClearEventId` recorded.
- `receipt_required` policy defaults to **BLOCK**; expense submit refuses missing receipt/memo requirements.
- Receipts: `createFromAttachment` (sandbox clean ack + mock OCR), `link`; expenses: `updateMemo`, transactional `split` + audit/outbox, enriched `getDetail`.
- Worker: sandbox document scan → CLEAN → `receipt.ocr_requested`; OCR processor fills merchant/amount guesses.
- Web: expense detail (`/app/expenses/[id]`) with memo, receipt upload/link, submit/approve, splits; receipts list in nav; Clear/capture still sandbox-only.
- Unit: policy receipt BLOCK updated.

**REMAINING:**

- Optional: Playwright smoke for expense completion UX; restart API + `prisma generate` if Windows EPERM persists.

**BLOCKERS:**

- No certified malware/OCR engines — sandbox scanners only.
- Prisma `generate` may EPERM while `dev:api` holds the query engine DLL.

**TEST RESULTS:**

- Vitest: **receipts-expenses.db.test.ts 3/3**, **spend-fulfillment 7/7**, policy 4/4.
- Migration `20260917140000_m4_receipts_expenses` applied.
- API + web typecheck green.

**NEXT MILESTONE:** **M5 — Reimbursements** (complete — see M5 tracking below).

---

## Milestone 5 — Reimbursements

### M5 tracking

**DONE:**

- Migration `20260917160000_m5_reimbursements`: reimbursement calc/payout fields; `receipts.reimbursement_id`.
- Server calc for STANDARD / MILEAGE (0.67/mi) / PER_DIEM (75/night); client amount ignored for mileage/per-diem.
- Create submits into `IN_REVIEW` with policy receipt/memo gates; receipt attach + match.
- Approve does **not** create accounting (approved ≠ paid); independent reviewer via workflow SOD.
- Schedule via `MockPayoutAdapter` (ACH/WIRE/CHECK) → `SCHEDULED` + providerRef; sandbox `confirmPayout` → `PAID` + single `REIMBURSEMENT` accounting upsert.
- Permissions `reimbursement.create|approve|pay`; registry routes; resource-access scopes.
- Web: list/create (type, amount, miles, nights), detail with approve/schedule/confirm-payout; Me + Expenses nav; accounting reimbursements tab.
- Unit + DB tests: calc, mileage→approve (no accounting)→schedule→confirm (one accounting), receipt gate, self-approval reject.

**REMAINING:**

- None for company-web M5 acceptance. Optional later: certified payout adapter; Playwright smoke.

**BLOCKERS:**

- No live payout rail — sandbox/mock only (intentional).
- Prisma `generate` may EPERM on Windows while API holds the query engine DLL.

**TEST RESULTS:**

- Vitest: `reimbursement-calc.test.ts` 3/3, `reimbursements.db.test.ts` 3/3.
- Migration `20260917160000_m5_reimbursements` applied.
- API + web typecheck green.

**NEXT MILESTONE:** **M6 — Vendor 360, AP, payments** (complete — see M6 tracking below).

---

## Milestone 6 — Vendor 360, AP, payments

### M6 tracking

**DONE:**

- Migration `20260917170000_m6_vendor_ap_payments`: vendor risk/tax/notes + unique name; bank account history (`is_current` / superseded); bill memo/attachment/PO + unique invoice; bill lines with org; payment `provider_ref` / `settlement_id` / settledAt; payment-run indexes.
- Vendor intake with duplicate-name block; `setBankAccount` keeps prior rows; Vendor 360 `getDetail` (bills/payments/bank history).
- Bills: line totals, optional attachment/PO, create→approve SoD; detail with payments.
- Payments: schedule against remaining (partial + over-commit blocked); distinct `payment.release` SoD; mock rail `providerRef`; sandbox `confirmSettlement` reduces remaining once; settlement id unique; accounting on settle.
- Payment runs: create, add scheduled payments, transactional release with SoD.
- Web: vendor/bill/payment-run detail pages; bills stage list navigates to detail; US seed `billPaySupported`.
- DB tests: duplicate vendor/invoice, SoD, partial settle once, payment-run release.

**REMAINING:**

- None for company-web M6 acceptance. Optional later: certified payment rail; invoice OCR intake; PO 2/3-way match (M8).

**BLOCKERS:**

- No live payment rail — sandbox/mock only.
- Prisma `generate` may EPERM while API holds the query engine DLL.

**TEST RESULTS:**

- Vitest: `vendor-ap-payments.db.test.ts` 2/2.
- Migration `20260917170000_m6_vendor_ap_payments` applied.
- API + web typecheck green.

**NEXT MILESTONE:** **M7 — Accounting queue + ERP export** (complete — see M7 tracking below).

---

## Milestone 7 — Accounting queue + ERP export

### M7 tracking

**DONE:**

- Migration `20260917180000_m7_accounting_erp`: entry amount/currency/externalId/syncedAt/attempts; SyncAttempt; SyncJob entryIds + success/failure counts; rule priority; provider dimension flag. Tenant-safe `@@unique([organizationId, sourceType, sourceId])` retained.
- Source adapters enrich CARD / REIMBURSEMENT / BILL / PAYMENT queue rows (amount, memo) via `queueAccounting` + optional rule auto-coding.
- Coding, mark ready, undo-ready, bulk ready, retry, sync job create, sandbox `confirmSync` with mock ERP ack.
- `MockAccountingAdapter` posts idempotently (`qbo_{entryId}`); retries reuse `externalId` — never a second posting.
- Worker sync processor records SyncAttempt SUCCEEDED/REUSED/SKIPPED/FAILED.
- Rules create API + unit matcher; provider dimension refresh.
- Web: overview queue KPIs + sync-all; rules create; ready undo; error retry; rules tab.
- Tests: rules 2/2; accounting-queue DB 2/2 (one source row, sync ack, retry same external id, multi-source summary).

**REMAINING:**

- None for company-web M7 acceptance. Optional later: certified QBO/Xero adapter; bulk select UI; undo after SYNCED.

**BLOCKERS:**

- No live ERP — MOCK_QBO only.
- Prisma `generate` may EPERM while API holds the query engine DLL.

**TEST RESULTS:**

- Vitest: `accounting-rules.test.ts` 2/2, `accounting-queue.db.test.ts` 2/2.
- Migration `20260917180000_m7_accounting_erp` applied.
- API + web typecheck green.

**NEXT MILESTONE:** **M8 — Procurement and POs** (complete — see M8 tracking below).

---

## Milestone 8 — Procurement and POs

### M8 tracking

**DONE:**

- Migration `20260917190000_m8_procurement_pos`: request formAnswers/outcomeId/vendor/memo; program defaultOutcomeType; PO commitment/match fields + unique per request; PO lines; receiving memo; MatchRecord.
- Create/submit/approve lifecycle: SOD (requester cannot approve); **PO created only on final approval**; resume-safe unique PO; lines total = amount.
- Non-PO outcomes (VIRTUAL_CARD / VENDOR_SETUP) set outcomeId without creating a PO.
- Receiving capped to remaining commitment; status OPEN → PARTIALLY_RECEIVED → RECEIVED.
- 2/3-way match vs bill (+ receiving); idempotent per bill; variance/exception status.
- Web: request + PO detail pages; list navigation; receiving create fields.
- Tests: match helpers 2/2; procurement-pos DB 2/2.

**REMAINING:**

- None for company-web M8 acceptance. Optional later: richer form builder UI; line-level receiving; Playwright smoke.

**BLOCKERS:**

- None beyond mock-only providers elsewhere.

**TEST RESULTS:**

- Vitest: `procurement-match.test.ts` 2/2, `procurement-pos.db.test.ts` 2/2.
- Migration `20260917190000_m8_procurement_pos` applied.
- API + web typecheck green.

**NEXT MILESTONE:** **M9 — Core travel** (complete — see M9 tracking below).

---

## Milestone 9 — Core travel

### M9 tracking

**DONE:**

- Migration `20260917200000_m9_core_travel`: trip dates/destination/cost/policy/fund/expense; booking org scope, itinerary, outOfPolicy, providerStatus (mock hold ≠ confirmed).
- Trip lifecycle: DRAFT → in-policy APPROVED or OOP/over-threshold PENDING_APPROVAL → APPROVED → BOOKING (mock hold) → CONFIRMED (sandbox only).
- MockTravelAdapter: search quotes, hold → BOOKED_MOCK/MOCK_HOLD, confirm → CONFIRMED; production confirm blocked.
- Fund + expense links; Inbox travel approve/reject; seed permissions/workflow/policy.
- Web: trip create/list/detail (search, select quote, submit, approve, mock hold, sandbox confirm, links); my travel + requests queues.
- Tests: travel-mock unit 2/2; travel-core DB 2/2.

**REMAINING:**

- None for company-web M9 acceptance. Optional later: cancel/refund, real travel provider, Playwright smoke.

**BLOCKERS:**

- None beyond mock-only travel provider (by design for local M9).

**TEST RESULTS:**

- Vitest: `travel-mock.test.ts` 2/2, `travel-core.db.test.ts` 2/2.
- Migration `20260917200000_m9_core_travel` applied.
- API + web typecheck green.

**NEXT MILESTONE:** **M10 — Reporting, budgets, integrations, web hardening** (complete — see M10 tracking below).

---

## Milestone 10 — Reporting, budgets, integrations, web hardening

### M10 tracking

**DONE:**

- Migration `20260917210000_m10_reporting_hardening`: budget freshness/updatedAt; notification href/object links; integration health/cursor/error; SavedView.
- Budget read model: remaining = amount − actual − committed (no double count); list/detail with utilization + linked programs; freshness stamped on commit/capture/reverse.
- Dashboard `/reporting`: currency-scoped spend/payables/budget/PO commitments, travel pending, integration health summary, freshness labels.
- Search: permission-scoped vendors/people/bills/txns/expenses/POs/trips/requests with deep links.
- Notifications (mine + mark-read/all); integration sandbox ping; saved views CRUD.
- Web: dashboard KPIs, budget detail, search UI, integrations health table, notifications page, skip-link + focus a11y, saved views on ResourcePage.
- Tests: budget-math 2/2; reporting-hardening DB 2/2.

**REMAINING:**

- None for company-web M10 acceptance. Optional later: Playwright P0 journey suite; live provider sync cursors.

**BLOCKERS:**

- None beyond mock-only external providers (by design for local P0).

**TEST RESULTS:**

- Vitest: `budget-math.test.ts` 2/2, `reporting-hardening.db.test.ts` 2/2.
- Migration `20260917210000_m10_reporting_hardening` applied.
- API + web typecheck green.

**NEXT MILESTONE:** P0 company-web milestone set complete. Optional: browser smoke / P1 enterprise automation.

---

## Milestone 1 acceptance checklist (gate)



- [x] Cross-tenant resource access denied in API tests against Postgres (or documented fixture harness).
- [x] Self-approval rejected for all Inbox object types covered.
- [x] Every remaining P0 money command in `actions.ts` uses transactional audit+outbox (no `mutate` on money paths).
- [x] Duplicate idempotent financial commands return same result or 409 on hash mismatch.
- [x] Uploaded attachments cannot be treated as CLEAN without scanner acknowledgment (interface + default quarantine).
- [x] Money helpers reject invalid amounts/currencies; entity currency mismatch fails closed.
- [x] Orphan report produced; unsafe uniques fixed via `20260916190000_m1_foundation_constraints`.
- [x] Worker: unsupported events unpublished; supported events claim/retry/DLQ implemented and unit-tested.
- [x] Typecheck + targeted tests green; M1 tracking updated with evidence.
