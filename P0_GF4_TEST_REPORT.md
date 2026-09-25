# P0-GF4 Test Report — Reimbursement → Policy → Approval → Payout → Settlement → Accounting

**Date:** 2026-09-21  
**Audit:** `P0_GF4_REIMBURSEMENT_AUDIT.md`  
**Foundation:** M0/M1 + P0-GF1 + P0-GF2 + P0-GF3 unchanged (regression-safe)

---

## Summary

GF4 hardens the employee reimbursement vertical on the M5 spine: DRAFT→submit separation, server-authoritative MILEAGE/PER_DIEM amounts (client rates ignored), requirements checklist, deterministic duplicate detection, approval ≠ payout SoD, mock async settlement, FAILED/RETURNED states, accounting only after settle, reporting KPIs, and Playwright D/D2/D3/D4.

| Gate | Result |
|---|---|
| API Vitest | **99/99 PASS** (29 files) |
| API / Web / Worker tsc | **PASS** |
| Worker event-catalog tests | **PASS** |
| Migration `20260921160000_p0_gf4_reimbursements` | **Applied** |
| Redis | **PONG** |
| Playwright | **12/12 PASS** (A–C3 + **D, D2, D3, D4**) |
| GF1 / GF2 / GF3 regression | **PASS** |

---

## Files changed (high level)

### Schema / migration
- `apps/api/prisma/schema.prisma` — reimbursement policy snapshot, duplicate, expense/destination/rate fields, payout/failure/returned
- `apps/api/prisma/migrations/20260921160000_p0_gf4_reimbursements/`

### Domain
- `apps/api/src/modules/reimbursements/domain/calc.ts` — rate lock + eligible days / date range
- `apps/api/src/modules/reimbursements/domain/requirements.ts`
- `apps/api/src/modules/reimbursements/domain/duplicate.ts`
- `apps/api/src/modules/reimbursements/domain/state-machine.ts`
- Policy: `receipt_required` scoped to STANDARD reimbursements

### API
- `actions.reimbursements` — create DRAFT, submit, approve, schedule, confirm/fail/mark-returned, enriched getDetail
- Registry actions: submit, fail-payout, mark-returned
- Reporting KPIs for reimbursements
- Inbox type `REIMBURSEMENT_APPROVAL`

### Worker
- `reimbursement.scheduled` actionable → mock settle (idempotent)
- Catalog + dispatch + `reimbursement.payout_failed`

### Web
- Reimbursement detail: requirements, policy, approvals, payout, activity
- Nav: For approval / For payout / Paid / Failures
- Resource create fields for category/dates/destination

### Mobile
- Minimal `reimbursements/new` scaffold — **full native capture deferred** (web+API are validated path)

### Tests
- `reimbursements.db.test.ts`, `reimbursement-calc.test.ts`
- Playwright **D / D2 / D3 / D4**

---

## Playwright evidence

```
ok A … A2 … B … B2 … B3 … C … C2 … C3
ok D: STANDARD reimbursement → approval → payout → accounting
ok D2: mileage server calc ignores forged amount
ok D3: per diem server calc and payout
ok D4: reimbursement negatives — SoD, duplicate, fail payout, forge blocked
12 passed
```

---

## Acceptance checklist

- [x] STANDARD end-to-end (Web + API)
- [x] Mileage server-authoritative
- [x] Per diem server-authoritative
- [x] Requirements + receipt policy
- [x] Policy snapshot persisted
- [x] Duplicate detection
- [x] Shared approval + self-approve blocked
- [x] Payout separated from approval
- [x] Unauthorized payout blocked
- [x] Async mock settlement (+ sandbox confirm)
- [x] PAID only after settlement
- [x] Failed payout remains unpaid / retryable
- [x] Idempotent confirm / accounting
- [x] ERP sync idempotent after code→ready
- [x] Reporting KPIs
- [x] Audit / outbox
- [x] Tenant / RBAC / SoD
- [x] GF1–GF3 regression green
- [x] Redis / tsc / API tests
- [x] Playwright D–D4

---

## Remaining / deferred (not GF5)

- Full native mobile receipt camera + offline queue (scaffold only)
- Live bank payout provider certification (mock remains)
- Bank return reconciliation beyond RETURNED state
- Map/GPS mileage providers

**NEXT:** Stop — do not start P0-GF5 Travel.
