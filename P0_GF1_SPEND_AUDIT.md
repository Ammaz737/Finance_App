# P0-GF1 Spend Vertical Audit

**Date:** 2026-09-20  
**Scope:** Spend Request → Policy → Approval → Fund/Card → Auth → Capture → Expense → Receipt → Accounting → Sync  
**Foundation:** M0/M1 complete (`CURRENT_FOUNDATION_AUDIT.md`, `FOUNDATION_TEST_REPORT.md`)

Classification: **DONE** | **PARTIAL** | **MISSING** | **BROKEN** | **NEEDS_REFACTOR**

---

## Summary

The sandbox golden path largely works (M3/M4 + DB/Playwright coverage). This milestone closes explainable policy on spend submit, card unfreeze/terminate, request/expense UX depth, vendor normalization, requirements checklist, richer E2E, and reporting/timeline gaps — without redesigning foundation.

| Area | Status |
|---|---|
| Spend Programs | PARTIAL |
| Spend Requests | PARTIAL |
| Policy on submit | MISSING → target DONE |
| Approval + Inbox | DONE |
| Fulfillment FUND_ONLY / VIRTUAL_CARD | PARTIAL |
| Fund / Card detail | PARTIAL / DONE |
| Authorization declines | PARTIAL |
| Transaction lifecycle | DONE |
| Expense auto-create | DONE |
| Expense requirements | PARTIAL |
| Receipt / OCR / match | PARTIAL |
| Expense policy + approval | DONE |
| Accounting handoff | DONE |
| Budget commit→actual | DONE |
| Vendor normalization | MISSING |
| Reporting | PARTIAL |
| Timelines | PARTIAL |
| Web journey pages | PARTIAL |
| Playwright | PARTIAL |
| P1/P2 nav gating | DONE |

---

## Detailed classification

### 1. Spend Programs — PARTIAL
Reusable template exists (amount, entity, fulfillment, MCC/velocity defaults). Missing: update/deactivate, eligibility lists, workflowId wiring on create, audit on create.

### 2. Spend Requests — PARTIAL
Create → SUBMITTED → approve → FULFILLED via fund/card. No DRAFT path, thin detail UX, recurrence UI incomplete, no dedicated request detail page.

### 3. Policy on spend submit — MISSING
Expense/travel evaluate policy; spend request create does not. No snapshot columns on SpendRequest.

### 4. Approval + Inbox — DONE
Shared engine + Inbox decide for spend.approveRequest / reject.

### 5. Fulfillment — PARTIAL
Idempotent VIRTUAL_CARD + FUND_ONLY. FUND_ONLY has no card auth path (by design for this vertical; card journey is primary).

### 6. Fund/Card UI — PARTIAL / DONE
Card detail rich; fund detail read-only without timeline.

### 7. Card lifecycle — PARTIAL
Freeze exists; unfreeze/terminate missing.

### 8. Transaction lifecycle — DONE
Capture / void / reverse / clear sandbox-gated.

### 9. Expense on clear — DONE
Exactly one expense per txn; accounting upsert.

### 10. Requirements — PARTIAL
Policy-enforced receipt/memo; no checklist UI from requiredActions.

### 11. Receipts — PARTIAL
Upload + mock OCR + link; deterministic match scoring thin.

### 12. Expense policy/approval — DONE

### 13. Accounting — DONE
NEEDS_REVIEW → READY → SYNCING → SYNCED via worker.

### 14. Budget — DONE
Commit on approve; actual on capture; reverse restores.

### 15. Vendor normalization — MISSING
Txn.vendorId unused on authorize/capture.

### 16. Reporting — PARTIAL
Currency KPIs; missing receipt/policy exception aggregates thin.

### 17. Timelines — PARTIAL
Card activity only; request/expense/fund need coherent timelines.

### 18. Web pages — PARTIAL
Journey routes exist; request detail missing; UUID-heavy drawers.

### 19. Playwright — PARTIAL
`e2e/golden-flows.spec.ts` API-hybrid; needs full browser golden + negatives.

### 20. Nav flags — DONE
P1/P2 behind `NEXT_PUBLIC_ENABLE_P1_ROUTES` / P2.

---

## Implementation priority for this milestone

1. Policy snapshot on spend submit + schema
2. Card unfreeze / terminate
3. Spend request detail page + policy/approval/timeline UX
4. Expense requirements checklist UX
5. Deterministic receipt matching score
6. Merchant → vendor link on clear
7. Program eligibility + update/deactivate (minimal)
8. Reporting: missing receipts + policy exceptions
9. Playwright golden + negative E2E
10. Tests + P0_GF1_TEST_REPORT

**Out of scope:** Bill Pay, Procurement, Travel, Treasury, AR, Tax, Disputes, AI, Sheets, Agent Finance, P1/P2 product work.
