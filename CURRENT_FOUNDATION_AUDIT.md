# Current Foundation Audit — M0 / M1

**Date:** 2026-09-20  
**Sources audited:** `IMPLEMENTATION_AUDIT.md` (gap analysis baseline), `V3_IMPLEMENTATION_PLAN.md` §2, `RAMP_VERIFIED_PRODUCT_DESIGN_V3_OPTIMIZED.md`, `ON_PREMISES_MODULAR_ARCHITECTURE_GUIDE.md`  
**Method:** Every gap-analysis claim was checked against live code, schema, migrations, workers, and tests. Statuses below reflect **current repository state**, not the 2026-09-16 snapshot.

Classification:

| Status | Meaning |
|---|---|
| **CONFIRMED** | Gap still true in current code |
| **ALREADY FIXED** | Gap closed since the report |
| **PARTIAL** | Materially improved; still incomplete vs M0/M1 gate |
| **NOT APPLICABLE** | Claim outdated, misframed, or out of M0/M1 scope |

---

## 1. Tenant isolation

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| Generic router gives any authenticated user org-wide reads and unconstrained creates | **ALREADY FIXED** | `scopedWhere` on list/detail; create requires `assertResourcePermission`; missing create callback → 501 (`resource-router.ts`) |
| Frontend-supplied `organizationId` trusted for tenancy | **ALREADY FIXED** | Auth derives tenant from session/user (`platform/auth`); routes use `ctx.organizationId` |
| Not every mounted route is tenant-scoped | **PARTIAL** | Resource router and custom routers inject `organizationId`. Unlisted resources fall back to Owner-only empty rules |
| Generic CRUD bypasses resource authorization | **PARTIAL** | Reads/actions permission-checked. ~24 P1/P2 list stubs remain mounted (Owner can list; writes 501) |
| Cross-tenant read/update/delete/create-reference possible | **PARTIAL** | Two-tenant DB tests exist (`tenancy.db.test.ts`); matrix does not cover every finance resource yet |

---

## 2. RBAC and data scope

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| Permissions loaded but not enforced on generic routes | **ALREADY FIXED** | `resourceRule` + `assertResourcePermission` / `scopedWhere` |
| Server-side enforcement missing; UI hiding is security | **PARTIAL** | Server enforces on resource router + domain actions. UI `Can` still not a boundary (by design) |
| Scopes SELF / DIRECT_REPORTS / DEPARTMENT / ENTITY / ORGANIZATION | **PARTIAL** | Runtime: ORGANIZATION, ENTITY, MULTI_ENTITY, SELF, DIRECT_REPORTS. **DEPARTMENT not in `scopedWhere`** (package lists it) |
| Full Owner / Finance Admin / Manager / Employee matrix tests | **PARTIAL** | Spot DB + unit tests; no exhaustive route×role matrix |

---

## 3. Database integrity

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| 0 SQL FKs / 0 Prisma `@relation` | **PARTIAL** | **36 P0 FKs** installed (`20260920211000` / `20260920212000`). Prisma still has no `@relation` attributes |
| Orphans / cross-tenant links possible | **PARTIAL** | Migration prechecks abort on P0 orphans/cross-tenant. Polymorphic IDs remain logical |
| Unsafe uniques (`AccountingEntry`, card auth key) | **ALREADY FIXED** | Tenant-scoped uniques in schema + M1/P0 migrations |
| No InboxItem / Policy version fields | **ALREADY FIXED** | Schema has `InboxItem`, `Policy.version` / effective dates, `ApprovalWorkflow.version` |
| Child tables without `organizationId` | **PARTIAL** | Most P0 children carry org; some specialist tables deferred (P1/P2) |

---

## 4. Transactional mutations

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| Multi-record writes + audit/outbox not one DB transaction | **PARTIAL** | Money paths use `$transaction` / `auditedCommand`. Some admin creates (e.g. spend-programs, business-limits) still lack audit/outbox |
| Legacy `mutate()` post-commit in use | **ALREADY FIXED** | Helper remains; **zero callers** under `apps/api/src` |
| Approval ≠ fulfillment atomicity (spend) | **ALREADY FIXED** | `approveRequest` includes approval + fund/card + audit/outbox in one Serializable txn |

---

## 5. Idempotency

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| `withIdempotency` on payment.schedule + card auth | **PARTIAL** | `payment.schedule` uses `withIdempotency`. Card auth uses domain key + Serializable txn (equivalent) |
| Missing on other high-risk financial commands | **CONFIRMED** | Not wrapped: payment.release, bill create, reimbursement payout, treasury, ERP sync, webhooks |

---

## 6. Outbox + Redis + workers

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| Worker marks published without dispatch; empty processors | **ALREADY FIXED** | Claim → BullMQ → processors for payment, accounting, documents, OCR |
| Only 2 event types | **ALREADY FIXED** | Catalog: 4 actionable + informational set (`docs/OUTBOX_EVENT_CATALOG.md`) |
| No DLQ / claim / replay | **ALREADY FIXED** | Outbox claim/retry/dead-letter implemented |
| No worker health (depth, age, retries, DLQ, lag) | **PARTIAL** | `/operations/worker-health` exists (heartbeat, pending/retry/dead, job counts). Oldest age / consumer lag incomplete |
| Actionable events unpublished indefinitely | **ALREADY FIXED** | Unsupported types fail closed; actionable have consumers |

---

## 7. Approval engine foundation

| Capability | Status | Evidence |
|---|---|---|
| Eligible approver resolution | **PARTIAL** | By `userId` / `role` / step type (`workflow/index.ts`) |
| Self-approval prevention (SoD) | **ALREADY FIXED** | Requester cannot decide; payment/transfer SoD |
| Sequential steps | **ALREADY FIXED** | `currentStep` advancement |
| Parallel steps | **CONFIRMED** | Not implemented |
| Separation of duties (broader) | **PARTIAL** | Self + creator/releaser SoD; no multi-actor SOD matrix beyond that |
| Amount-based routing | **PARTIAL** | Priority bump ≥ 10k; no amount-threshold step selection |
| Department routing | **CONFIRMED** | Missing |
| Entity routing | **CONFIRMED** | Missing |
| Reassignment | **CONFIRMED** | Missing |
| Escalation | **CONFIRMED** | `dueAt` set; no escalation path |
| Workflow definition versioning | **PARTIAL** | Schema version column; start does not pin/select by version |

---

## 8. Policy engine foundation

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| Hardcoded only; DB `Policy.rules` unused | **PARTIAL** | Expense/reimbursement/travel load DB rules. Card authorize still uses default hardcoded path |
| PASS / WARN / REVIEW / BLOCK | **ALREADY FIXED** | `PolicyResult` + severity aggregation |
| Returns result, matched rules, reason, evidence, required actions | **PARTIAL** | Has `explanation` (reason), `matchedRules`, `evidence`, `requiredAction`. No separate `reason` field name |
| Deterministic evaluation | **ALREADY FIXED** | Shared `evaluatePolicy` path |
| Versioned publish / evaluation snapshot | **CONFIRMED** | Effective dates exist; no immutable evaluation snapshot store; no builder CRUD beyond simulate |

---

## 9. Spend authority

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| Budget → Program → Fund → Card chain | **PARTIAL** | Approve reserves budget, creates fund/card; auth enforces fund/card controls |
| Atomic auth controls (active card/user/fund, amount, limits, MCC, dates, velocity) | **PARTIAL** | Card/fund/limits/MCC/per-txn/velocity/merchant/date enforced. Active **user** holder check incomplete |
| Concurrent authorizations cannot overspend | **ALREADY FIXED** | Conditional `updateMany` + Serializable + DB test |

---

## 10. Settlement separation

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| Payments marked COMPLETED when scheduled/sent | **PARTIAL** | AP: SCHEDULED → PROCESSING → COMPLETED (settlement). Terminal success is named `COMPLETED`, not `SETTLED` |
| Provider callback determines SETTLED | **PARTIAL** | Mock settle / sandbox confirm; production blocks confirm |
| Treasury transfer COMPLETED on release | **CONFIRMED** | `treasury.release` sets `COMPLETED` immediately |
| Accounting SYNCED before worker | **ALREADY FIXED** (prod) | Sets SYNCING; confirm blocked in production |

---

## 11. Audit

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| Material mutations lack immutable audit | **PARTIAL** | Most money paths write audit with actor/action/object/org/before/after/correlation. No DB append-only guard |
| Missing entity / request ID fields | **PARTIAL** | Correlation present; legalEntityId not always on audit row |

---

## 12. Tests

| Gap-analysis claim | Status | Evidence |
|---|---|---|
| No DB / security / concurrency tests | **PARTIAL** | Multiple `*.db.test.ts` suites now exist (~24 test files) |
| Auth matrix incomplete | **CONFIRMED** | Still spot coverage |
| Worker failure/replay only unit | **PARTIAL** | `outbox.test.ts` unit; limited live worker integration |
| Browser E2E | **NOT APPLICABLE** | Explicitly deferred until foundation tests pass |

---

## Route surface summary

- **~68** mounted registry keys
- **~24** P1/P2 stubs: list/get only (Owner), POST → 501 — acceptable for M0 if not treated as product features
- Auth required on all `/api/v1` except login/activate

---

## Remaining M0/M1 work (this milestone)

**Closed in 2026-09-20 hardening pass** (see `FOUNDATION_TEST_REPORT.md`):

1. ~~DEPARTMENT scope in `scopedWhere`~~ — DONE
2. ~~Expand idempotency~~ — DONE for payment.release, bill.create (opt), reimbursement.schedule (opt); card auth remains domain-key based
3. ~~Approval engine depth~~ — DONE (parallel, routing, reassignment, escalation, version pin, distinct-control SoD)
4. ~~Policy reason/requiredActions + card DB rules~~ — DONE
5. ~~Settlement SETTLED + treasury SENT≠SETTLED~~ — DONE
6. ~~Worker health metrics~~ — DONE
7. ~~Auth matrix + expanded tenant isolation~~ — DONE
8. ~~Active card-holder check~~ — DONE
9. ~~Route authorization matrix~~ — DONE (`auth-matrix.ts`)
10. ~~Update IMPLEMENTATION_PLAN + FOUNDATION_TEST_REPORT~~ — DONE

**Accepted residual (not blocking M0/M1 gate):** Prisma `@relation` attrs, P1/P2 FKs, audit DB triggers, some admin creates without audit, P1/P2 list stubs, real malware scanner, policy builder UI, browser E2E.

**Out of scope for this milestone:** Expenses/AP/Procurement/Travel/AI/Sheets/Agents/Receivables product expansion, P1/P2 modules, UI redesign, scaffold pages, browser E2E.
