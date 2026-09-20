# Implementation Audit — Finance Operations Platform

**Date:** 2026-09-16 (re-verified against live repository and local demo PostgreSQL)  
**Sources of truth:** `RAMP_VERIFIED_PRODUCT_DESIGN_V3_OPTIMIZED.md`, `ON_PREMISES_MODULAR_ARCHITECTURE_GUIDE.md`  
**Scope:** Company web portal + API/worker/database required for real workflows. Mobile, vendor-portal, advisor-console, and Stack apps exist as scaffolds and are **out of execution scope** unless a later milestone explicitly pulls them in.

A rendered page, a 200 response, or an insertable row is **not** completion. Completion requires lifecycle, RBAC, cross-module sync, audit, error handling, and tests that prove the workflow.

---

## CURRENT MODULE INVENTORY

### Monorepo

| Layer | Contents |
|---|---|
| Apps | `api` (Express/TS), `web` (Next.js), `worker` (BullMQ), plus scaffold apps `mobile`, `vendor-portal`, `advisor-console`, `stack` |
| Packages | `api-client`, `config`, `contracts`, `design-system`, `feature-flags`, `logger`, `money`, `permissions` |
| Runtime | PostgreSQL + Prisma, Redis + BullMQ, local/NAS file storage — matches on-prem modular monolith constraints |

### Backend reality (critical)

- **57 module folders** under `apps/api/src/modules/*` with DDD-style skeletons (`api/`, `application/`, `domain/`, `infrastructure/`). Most controllers still return **501** or re-export stubs.
- **Actual mounted behavior** lives in:
  - `apps/api/src/modules/registry.ts` (~63 mounted route keys)
  - `apps/api/src/application/actions.ts` (domain commands)
  - `apps/api/src/engines/{policy,workflow,ledger,documents,search}`
  - `apps/api/src/platform/{auth,resource-access,resource-router,database,idempotency,events}`
- Directory presence ≠ implementation completeness.

### Shared engines

| Engine | Status | Notes |
|---|---|---|
| Policy | NEEDS REFACTOR | Hardcoded `evaluatePolicy()`; DB `Policy.rules` unused |
| Workflow | PARTIAL | Sequential steps, SoD self-approval guard, eligibility by step type/role |
| Ledger | PARTIAL | Basic double-entry posting helper |
| Documents | PARTIAL | Validate + quarantine upload; **no malware scan processor** |
| Search | PARTIAL | Scoped queries + safe field selection |

### Integration adapters

Interfaces/mocks exist under `apps/api/src/integrations/` for: accounting, bank-data, card-issuer, payment-rail, travel, hris, identity, email, llm, and others. Most are **not wired** into live domain commands.

### Worker

Dispatches only:

- `payment.released` → mock payment settlement
- `accounting.sync_requested` → mock ERP sync

Unsupported outbox events remain unpublished (safe). No document/OCR/notification processors.

---

## CURRENT DATABASE MODEL

- **72 Prisma models** in `apps/api/prisma/schema.prisma`
- **One migration:** `20260916120000_init` — creates tables/indexes
- **0 FOREIGN KEY constraints** in SQL; **0 Prisma `@relation` attributes**
- Status fields are free **strings**, not Prisma enums
- Money columns generally `DECIMAL(18,2)`; `@finance/money` is only a `{amount,currency}` wrapper (no validation/arithmetic)

### Demo DB snapshot (local, 2026-09-16)

| Entity | Count |
|---|---|
| organizations | 1 |
| legalEntities | 2 |
| departments / locations | 1 / 1 |
| users | 5 |
| roles | 4 |
| policies / approvalWorkflows | 1 / 4 |
| approvalInstances | 3 |
| budgets / spendPrograms | 1 / 1 |
| spendRequests | 0 |
| funds / cards / txns / expenses | 1 / 1 / 1 / 1 |
| reimbursements | 1 |
| vendors / bills / payments | 1 / 2 / 0 |
| purchaseRequests / purchaseOrders | 1 / 0 |
| accountingEntries | 3 |
| travelTrips | 1 |
| bankAccounts | 2 |
| integrations | 1 |
| auditEvents / outboxEvents | 13 / 13 |
| attachments | 1 |

Seed script deletes/recreates data — **do not run against this active demo DB** without backup.

### High-risk schema issues

| Risk | Detail |
|---|---|
| No FK integrity | Orphans and cross-tenant links possible unless every command validates |
| `AccountingEntry @@unique([sourceType, sourceId])` | Missing `organizationId` — global uniqueness |
| `CardAuthorization.idempotencyKey @unique` | Global, not tenant-scoped |
| No InboxItem/Task model | Inbox is a live query over `ApprovalInstance` |
| No Policy versioning | No version, effective dates, or evaluation snapshot |
| No PO line items | Header totals only |
| Weak fulfillment links | Spend approval creates Fund/Card outside one transactional command boundary |
| Travel minimal | Trip name/status/policyResult; no dates/destination/request flow |

---

## CURRENT ROUTE INVENTORY

Mounted from `registry.ts` at `/api/v1/{key}` (`/auth` aliases identity):

| Area | Keys |
|---|---|
| Identity/company | `identity`, `inbox`, `organizations`, `entities`, `departments`, `locations`, `people`, `rbac`, `policies`, `approvals`, `entitlements`, `country-capabilities`, `notifications`, `integrations`, `audit` |
| Spend/expenses | `budgets`, `cards`, `funds`, `spend-programs`, `spend-requests`, `authorizations`, `transactions`, `expenses`, `receipts`, `reimbursements`, `documents` |
| Procurement/AP | `procurement`, `procurement-programs`, `purchase-orders`, `receiving`, `vendors`, `contracts`, `renewals`, `sourcing`, `price-intelligence`, `license-intelligence`, `bills`, `payments`, `payment-runs` |
| Finance/other | `accounting`, `accounting-rules`, `reconciliation`, `erp-sync`, `travel`, `banking`, `treasury`, `customers`, `invoices`, `incoming-payments`, `collections`, `cash-application`, `reporting`, `search`, `rewards`, `tax-operations`, AI/dev keys, `disputes`, `repayments` |

Generic `createResourceRouter` provides list/detail; writes return **501** unless a custom create/action callback exists.

Notable working custom surfaces: login/me/overview, inbox list+decide, reporting aggregates, search, document upload, org PATCH, entity/dept/location create, people create/publish/terminate, spend/expense/reimbursement/bill/payment/procurement/accounting/treasury actions.

---

## CURRENT UI PAGE INVENTORY

- **88** `page.tsx` files under `apps/web`
- Main nav (`navigation.ts`) is permission/entitlement aware and focuses on P0 workspace paths
- Shared shell: tables, drawers, status badges, ResourcePage, OverviewDashboard, AuthGate

| Kind | Count (approx) | Meaning |
|---|---|---|
| Custom workflows | ~4 | Login, Inbox, Company settings, Bill Pay bills (richer) |
| Dashboard | 2 | Home, Insights |
| ResourcePage tables | ~55 | Live generic CRUD-ish tables — **PARTIAL**, not completed workflows |
| Thin scaffolds | **23** | Explicit “Domain logic is not implemented yet” |

Scaffold P0 gaps include **travel requests/policy/travelers/reports/search**. Many P1/P2 scaffolds (AI Sheets, price intelligence, etc.) should stay out of primary nav until real workflows exist.

Raw UUIDs reduced in common list columns but still appear in many detail drawers. Prefer business labels; put technical IDs in expandable System Information.

---

## IMPLEMENTATION MATRIX

| Feature | Status | Working parts | Missing / debt | Required change |
|---|---|---|---|---|
| Organization / entities / depts / locations | PARTIAL | Tenant read, org rename, validated creates, web tables | Membership editing, safe delete, country capability UX | Foundation + scoped commands |
| People / RBAC | PARTIAL | Login/session, role grants, scopes, draft create/publish/terminate (txn), card freeze on terminate | MFA, role editing UI, activation/reset, approval reassignment on terminate | Identity contract + matrix tests |
| Policy engine | NEEDS REFACTOR | PASS/WARN/REVIEW/BLOCK helper | Ignores DB policies; no builder/version/sim | Versioned policy + engine contract |
| Approval engine | PARTIAL | Shared instance engine; SoD; multi-step; Inbox for 5 object types | Effects often after decision txn; no request-info; no payment-release/PO/accounting tasks; no versioning | Transactional workflow + task projection |
| Universal Inbox | PARTIAL | List → drawer → approve/reject; progress label | No InboxItem model; missing types; no auto-next; thin context | M2 task model + review UX |
| Audit / outbox | PARTIAL | Tables; `auditedCommand` atomic path; worker for 2 events | Legacy `mutate()` post-commit; incomplete coverage; no DLQ tooling | Migrate all money commands |
| Idempotency | PARTIAL | `withIdempotency` hash+409; payment.schedule + card auth | Not on other high-risk commands | Expand coverage + concurrency tests |
| Spend programs / requests / funds / cards | PARTIAL | Program/request create; approval → fund+virtual card; authorize/clear sandbox | Non-atomic fulfillment; incomplete form fields; weak detail UX; manual clear exposed | State machine + provider contract |
| Transactions / expenses / receipts | PARTIAL | Clear → expense + accounting; policy on submit; splits balance check | Receipt upload/link/OCR incomplete; lifecycle incomplete; clear is sandbox-only but UI may expose it | Document + expense vertical |
| Reimbursements | PARTIAL | Submit → Inbox → approve → accounting row | Mileage/per diem calc, receipt, payout provider, SCHEDULED/PAID | Payment abstraction |
| Vendor 360 | PARTIAL | Create/list; bill linkage | 360 tabs, spend rollups, banking verification | Counterparty read model |
| Bill Pay / payments / runs | PARTIAL | Duplicate invoice check; bill approval ≠ payment release; partial amounts; SoD on release; mock settle | Intake/OCR, PO match, payment runs UX, failure UX | AP domain expansion |
| Accounting | PARTIAL | Source queue, code/ready/sync, mock worker | Bulk, rules engine, retry UX, real ERP dims, tenant-safe unique | Source adapter + migration |
| Procurement / PO | PARTIAL | Program/request, progress string, PO after final approve, receiving amount | Non-atomic; no lines; no 2/3-way match | Workflow + PO model |
| Travel (P0) | MISSING | Seed trip + ResourcePage; scaffold request pages | Full request/approval/itinerary/spend link | Travel slice (M9) |
| Budgets / reporting | PARTIAL | Currency grouped overview; budget create | Commitments, forecast, drilldowns | Read models after sources stable |
| Banking | PARTIAL | Seed accounts; transfer commands | Provider freshness; mock vs live clarity | BankProvider contract |
| Integrations framework | PARTIAL | Connection table + adapter folders | Not wired; health/retry UX | Adapter ops |
| Documents | PARTIAL | Quarantine on upload | No scanner → never becomes CLEAN honestly | Scanner interface + worker |

---

## WORKING END-TO-END FLOWS

Verified locally (smoke / prior session + current code paths):

1. **Login + identity** — `/identity/login`, `/identity/me`; workspace slug for ambiguous email; Owner is an organization role in the current schema; seeded Owner assignments may specify a home entity.
2. **RBAC smoke** — employee card scope OK; employee bill read 403; employee invoice upload 403.
3. **Reimbursement → Inbox → accounting** — submit `IN_REVIEW` → owner Inbox approve → `APPROVED` + one `REIMBURSEMENT` accounting row.
4. **Accounting coding** — `/accounting/:id/code` → `/ready` → `READY_TO_SYNC`.
5. **People publish/terminate** — transactional state + session revoke + card freeze.
6. **Payment schedule idempotency** — tenant+operation+key+body-hash in serializable txn (unit + code path).
7. **Document quarantine** — owner upload stays `QUARANTINED`.
8. **Web render** — Home, Inbox, Spend Request form, Bill Pay stages, company settings (render proof only).

**Not regression-proven end-to-end in this audit:** spend request → fund/card fulfillment atomicity; bill → payment settlement with worker; procurement → PO; receipt → expense; travel request.

---

## PARTIAL FLOWS

- Spend request approval creates fund+card but **not in one transaction** with approval decision + audit
- Expense submit → policy → approval start (receipt/memo rules incomplete)
- Bill create → approval → APPROVED (intake/OCR/PO match missing)
- Payment schedule → release → mock worker settle (no real rail; payment runs thin)
- Procurement submit → multi-step approve → optional PO (non-atomic; no lines)
- Card authorize → pending txn → sandbox clear → expense (production must not expose generic Clear)
- Accounting queue for CARD/BILL/REIMBURSEMENT (limited fields; mock sync only)
- Inbox aggregates 5 approval types (not payment release / accounting exceptions / PO)

---

## MISSING P0 REQUIREMENTS

From V3 P0 core OS, still missing or not workflow-complete:

1. Reusable **policy builder** backed by DB definitions + versioning
2. **Universal Inbox** task model (payment release, accounting exceptions, request-info)
3. Spend request **full form + atomic fulfillment** outcomes
4. Card/Fund **detail experiences** (controls, spend period, restrictions)
5. Transaction lifecycle beyond PENDING/CLEARED (declined/reversed/refunded/disputed productization)
6. Expense receipts, OCR abstraction, requirement gates, full lifecycle to accounting
7. Reimbursement mileage/per diem + **payment abstraction** (approved ≠ paid)
8. Vendor 360
9. Bill intake pipeline + PO match + payment runs
10. Accounting rules/bulk/retry + tenant-safe source uniqueness
11. Procurement outcome types beyond thin PO; receiving/matching
12. **Core travel** request/approval (currently scaffold)
13. Reporting/budget commitment math without double count
14. Integration adapter **wiring** with mock-only semantics outside demo mode

---

## ARCHITECTURAL RISKS

1. **Logic centralization** in `actions.ts` while 57 module folders imply modular ownership — drift risk. Refactor incrementally into modules; do not rewrite the stack.
2. **Approval decision ≠ fulfillment atomicity** — approved objects can lack fund/card/PO/accounting effects if later steps fail.
3. **Legacy `mutate()`** writes audit/outbox **after** domain mutation.
4. **Module scaffolds returning 501** create false sense of coverage if someone mounts them.
5. Provider mocks must never present as live bank/ERP/issuer data outside demo/dev.

---

## DATA MODEL RISKS

1. No SQL FKs / Prisma relations
2. Unsafe uniques (`AccountingEntry`, card auth idempotency)
3. Free-string statuses
4. Missing InboxItem, PolicyVersion, PO lines, reimbursement calc fields, payment settlement refs
5. Child tables without `organizationId` (BillLine, ExpenseSplit, TravelBooking, …)

---

## RBAC GAPS

1. `scopedWhere` supports ORGANIZATION / ENTITY / MULTI_ENTITY / SELF / DIRECT_REPORTS only — packages list more scopes unused
2. Custom routes must re-check linked-object ownership; not all do (e.g. card freeze historically by id alone)
3. UI `Can` / nav hiding is **not** a security boundary
4. `payment.release` SoD exists in payment.release; must remain distinct from bill.approve
5. Full auth/scope matrix tests incomplete (unit mocks exist; DB multi-tenant matrix incomplete)
6. Terminate does not yet reassign pending approvals

---

## SYNC / EVENT GAPS

1. Outbox only publishes 2 event types
2. No dead-letter / claim / replay tooling
3. Notifications table with no delivery processor
4. `document.quarantined` never advances to CLEAN
5. Budget actuals updated on clear without commitment model
6. Reporting is on-read aggregation, not maintained read models

---

## UI / UX GAPS

1. 23 scaffold pages
2. ResourcePage lists lack saved views, column chooser, bulk actions, rich timelines
3. Inbox drawer lacks policy summary, full related objects, request-info, auto-advance
4. Card/Fund/Vendor detail too shallow
5. Manual transaction Clear must be sandbox-only in UX
6. Search page still developer-ish
7. Travel P0 nav incomplete / scaffolded

---

## TEST COVERAGE GAPS

| Present | Missing |
|---|---|
| 7 API Vitest files, 13 assertions (mocked/unit) | DB integration tests |
| Policy, workflow label, splits, documents validate, idempotency, login tenancy, resource-access | Full auth matrix against Postgres |
| Direct tsc for api/web/worker (when run) | Browser E2E journeys |
| | Worker failure/replay tests |
| | Concurrent overspend / double-fulfillment |
| | Migration backfill tests |
| | Accessibility / provider contract tests |

---

## CLASSIFICATION SUMMARY (P0)

| Requirement | Class |
|---|---|
| Org / entities / depts / locations | PARTIAL |
| People / RBAC / sessions | PARTIAL |
| Policy engine | NEEDS REFACTOR |
| Approval engine | PARTIAL |
| Audit / domain events | PARTIAL |
| Universal Inbox | PARTIAL |
| Spend programs / requests | PARTIAL |
| Funds / cards | PARTIAL |
| Transactions | PARTIAL |
| Expenses / receipts | PARTIAL |
| Reimbursements | PARTIAL |
| Vendor 360 | PARTIAL |
| Bill Pay | PARTIAL |
| Payments / release | PARTIAL |
| Payment runs | PARTIAL / MISSING UX |
| Accounting queue | PARTIAL |
| Procurement / PO | PARTIAL |
| Core travel | MISSING |
| Reporting / budgets | PARTIAL |
| Integrations framework | PARTIAL |
| Banking | PARTIAL |
| Money primitives | MISSING (wrapper only) |
| Document malware path | BROKEN (quarantine never clears) |

---

## BASELINE FOR PLANNING

Preserve Express + Next + Prisma + Redis modular monolith. Complete one vertical slice at a time. Track progress in `IMPLEMENTATION_PLAN.md`. **Milestone 1 (shared control foundation) is the only milestone to begin after this audit.**

