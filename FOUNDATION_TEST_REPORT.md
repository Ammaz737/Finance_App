# Foundation Test Report — M0 / M1

**Date:** 2026-09-20  
**Milestone:** Foundation Hardening (M0 + M1 only)  
**Audit:** `CURRENT_FOUNDATION_AUDIT.md`

---

## Summary

Foundation hardening completed against the live repository. Gap-analysis claims from `IMPLEMENTATION_AUDIT.md` / `V3_IMPLEMENTATION_PLAN.md` were re-verified; many were **ALREADY FIXED**. Remaining M0/M1 gaps closed in this pass.

| Gate | Result |
|---|---|
| Tenant isolation tests | PASS |
| Entity-scope / auth matrix | PASS |
| Financial mutations transactional | PASS (money paths) |
| Audit + outbox transactional | PASS (money paths) |
| Idempotency | PASS |
| Concurrent auth cannot overspend | PASS |
| Approval SoD | PASS |
| Policy PASS/WARN/REVIEW/BLOCK | PASS |
| Settlement ≠ scheduling | PASS (`SETTLED` terminal) |
| TypeScript API / Web / Worker | PASS |
| Existing tests | PASS (87/87) |
| Migrations on seed DB | PASS |

---

## Files changed

### Platform / engines
- `apps/api/src/platform/resource-access.ts` — DEPARTMENT scope; treasury rules; expenses.create
- `apps/api/src/platform/queue/index.ts` — queueDepth, oldestJobAgeMs, retryCount, deadLetterCount, consumerLag
- `apps/api/src/engines/workflow/index.ts` — parallel steps, amount/dept/entity routing, reassignment, escalation, version pin, distinct-control SoD
- `apps/api/src/engines/policy/index.ts` — `reason` + `requiredActions` on evaluation shape
- `apps/api/src/application/actions.ts` — card auth active-user + DB policy; payment SETTLED; payment.release idempotency; bill.create idempotency; reimbursement.schedule idempotency; treasury SENT→SETTLED
- `apps/api/src/modules/registry.ts` — treasury confirm-settlement action
- `apps/worker/src/processors/payments.processor.ts` — settle to SETTLED
- `apps/api/prisma/schema.prisma` — ApprovalInstance workflowVersion, assignee, escalation, parallelApprovals, resolvedSteps

### Docs
- `CURRENT_FOUNDATION_AUDIT.md` (new)
- `docs/OUTBOX_EVENT_CATALOG.md` — payment.settled, transfer.sent/settled
- `IMPLEMENTATION_PLAN.md` — M0/M1 foundation update
- `FOUNDATION_TEST_REPORT.md` (this file)

### Tests
- `apps/api/src/tests/auth-matrix.ts` + `auth-matrix.test.ts`
- `apps/api/src/tests/department-scope.test.ts`
- `apps/api/src/tests/approval-engine.db.test.ts`
- `apps/api/src/tests/workflow.test.ts` (expanded)
- `apps/api/src/tests/policy.test.ts` (expanded)
- `apps/api/src/tests/tenancy.db.test.ts` (cross-tenant update/delete/reference)
- `apps/api/src/tests/vendor-ap-payments.db.test.ts` (SETTLED)
- `apps/api/src/tests/procurement-pos.db.test.ts` (two-approver SoD)

---

## Migrations added

| Migration | Purpose |
|---|---|
| `20260920220000_m0_m1_foundation_hardening` | Approval instance fields; backfill payment/transfer `COMPLETED` → `SETTLED` where settled |

Prior P0 FK migrations (already present) remain the integrity baseline.

---

## Tests added / expanded

| Suite | Coverage |
|---|---|
| `tenancy.db.test.ts` | Cross-tenant update/delete/create-reference denial |
| `auth-matrix.test.ts` | Owner / Finance Admin / Manager / Employee matrix |
| `department-scope.test.ts` | DEPARTMENT scopedWhere |
| `approval-engine.db.test.ts` | Version pin, self-approval, parallel, distinct SoD, reassign, escalate |
| `workflow.test.ts` | Eligibility, routing, progress labels |
| `policy.test.ts` | PASS/WARN/REVIEW/BLOCK + reason/requiredActions |

---

## Test results (2026-09-20)

```
Vitest apps/api:  27 files / 87 tests PASS
tsc apps/api:     PASS
tsc apps/web:     PASS
tsc apps/worker:  PASS
prisma migrate deploy: applied 20260920220000_m0_m1_foundation_hardening
```

---

## Remaining gaps (accepted for post-M1)

1. Prisma `@relation` attributes still absent (SQL FKs exist for P0).
2. P1/P2 tables still without FKs (deferred by design).
3. Audit immutability is application-level only (no DB triggers/RLS).
4. Some admin creates (spend-programs, business-limits) still lack audit/outbox.
5. ~24 mounted P1/P2 list stubs remain Owner-readable (writes 501).
6. Production document CLEAN requires a real malware scanner.
7. Policy/workflow builder CRUD UI deferred to M2.
8. Browser E2E deferred until foundation gate (now green).

---

## Known risks

1. Payment status rename: writers use `SETTLED`; readers still accept legacy `COMPLETED`.
2. Distinct-control SoD requires different actors across differently-typed sequential steps — seed/demo workflows with one human doing finance→controller need a second actor.
3. `withIdempotency` on `payment.release` uses key `release-{paymentId}`; intentional for replay, not client-supplied keys.
4. Windows Prisma `generate` may EPERM while API/worker hold the query engine DLL.

---

## Stop

M0/M1 foundation hardening is complete. Do **not** start Expenses/AP/Procurement/Travel/AI/Sheets/Agents/Receivables product expansion or P1/P2 features from this milestone.
