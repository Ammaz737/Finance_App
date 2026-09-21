# P0-GF1 Test Report — Spend → Card → Expense → Accounting

**Date:** 2026-09-20  
**Audit:** `P0_GF1_SPEND_AUDIT.md`  
**Foundation:** M0/M1 complete (not reopened)

---

## Summary

P0-GF1 vertical slice hardened: policy snapshot on spend submit, fulfillment → `FULFILLED`, card unfreeze/terminate, request detail UX, expense requirements checklist, receipt match scoring, merchant→vendor link on capture, reporting counters, Playwright golden + negatives updated.

| Gate | Result |
|---|---|
| API Vitest | **91/91 PASS** (28 files) |
| API / Web / Worker tsc | **PASS** |
| Migration `20260920230000_p0_gf1_spend_policy` | **Applied** |
| Playwright golden journey | **3/3 PASS** (`A`, `A2`, `B`). baseURL `http://localhost:3002` (matches `pnpm dev:web`); API `:3001`. Bill path uses distinct `ap@acme.test` + `admin@acme.test` for consecutive SoD. |

---

## Files changed (high level)

### API
- `apps/api/prisma/schema.prisma` — SpendProgram eligibility/dates; SpendRequest policy snapshot fields
- `apps/api/prisma/migrations/20260920230000_p0_gf1_spend_policy/`
- `apps/api/src/application/actions.ts` — createRequest policy+eligibility; approve→FULFILLED idempotent; getRequestDetail; deactivateProgram; card unfreeze/terminate; CARD_FROZEN; vendor normalize on capture; expense requirements; dashboard missingReceipts/policyExceptions
- `apps/api/src/modules/registry.ts` — spend get detail, program deactivate, card actions
- `apps/api/src/platform/resource-access.ts` — unfreeze/terminate/deactivate permissions
- `apps/api/src/engines/policy/index.ts` — memo_required for spend_request
- `apps/api/src/modules/expenses/domain/requirements.ts` — requirements + receipt score
- `apps/worker/src/event-catalog.ts` — request.policy_blocked, card.unfrozen/terminated, spend_program.deactivated

### Web
- `apps/web/src/app/app/spend/requests/page.tsx` — navigate to detail
- `apps/web/src/app/app/spend/requests/[id]/page.tsx` — **new** policy/approval/fulfillment/timeline
- `apps/web/src/app/app/spend/cards/[id]/page.tsx` — unfreeze/terminate + SANDBOX label
- `apps/web/src/app/app/expenses/[id]/page.tsx` — requirements checklist
- `apps/web/src/config/resource-config.ts` — richer spend request fields
- `apps/web/e2e/golden-flows.spec.ts` — golden A + A2 negatives

### Docs
- `P0_GF1_SPEND_AUDIT.md`
- `P0_GF1_TEST_REPORT.md` (this file)
- `IMPLEMENTATION_PLAN.md` (updated)

### Tests
- `apps/api/src/tests/expense-requirements.test.ts`
- `apps/api/src/tests/spend-fulfillment.db.test.ts` — FULFILLED + idempotent re-approve

---

## Migrations

| Migration | Purpose |
|---|---|
| `20260920230000_p0_gf1_spend_policy` | Program eligibility/date columns; request policy snapshot + category/comments/attachment |

---

## APIs added/changed

| Endpoint | Change |
|---|---|
| `POST /spend-requests` | Policy eval persisted; eligibility; returns policy; BLOCKED path |
| `GET /spend-requests/:id` | Rich detail (policy, approval progress, fund/card, timeline) |
| `POST /spend-requests/:id/approve` | Ends in `FULFILLED`; idempotent replay |
| `POST /spend-programs/:id/deactivate` | Soft deactivate |
| `POST /cards/:id/unfreeze` | Unfreeze |
| `POST /cards/:id/terminate` | Terminate |
| `POST /authorizations` | CARD_FROZEN / CARD_TERMINATED reasons |
| `GET /expenses/:id` | `requirements` + `timeline` |
| `GET` reporting dashboard | `missingReceipts`, `policyExceptions` |

---

## Events

Informational: `request.policy_blocked`, `spend_program.deactivated`, `card.unfrozen`, `card.terminated`  
Existing: `request.submitted`, `request.approved`, `transaction.*`, accounting sync unchanged.

---

## Test results

```
Vitest apps/api: 28 files / 91 tests PASS
tsc apps/api:    PASS
tsc apps/web:    PASS
tsc apps/worker: PASS
migrate deploy:  20260920230000_p0_gf1_spend_policy applied
```

Playwright: specs ready (`golden-flows.spec.ts` A + A2 + B). Not executed in this session because local API/web processes were stopped to unlock Prisma generate. Re-run after:

```bash
# start API + web + worker + redis against seeded DB
pnpm --filter web test:e2e
```

---

## Remaining gaps (accepted / deferred)

1. FUND_ONLY still has no card-less spend UI (fund ledger only) — card journey is primary for GF1.
2. DRAFT save-without-submit path not exposed in UI.
3. Deterministic receipt match helper unit-tested; auto-attach still link-based (no low-confidence auto-attach).
4. Real malware scanner still mock/sandbox.
5. Program eligibility UI for department/role lists is schema+API ready; create form still basic.
6. Full browser create-form E2E (vs API create + UI detail) can be deepened later.
7. Broad multi-tenant Playwright against Tenant B seed (`seed-e2e-tenant.ts`) not run this session.

---

## STOP

P0-GF1 implementation and API regression gate complete. Do **not** start P0-GF2 or other verticals from this milestone.
