# P0-GF4 Reimbursement Audit

**Date:** 2026-09-21  
**Scope:** Employee reimbursement → policy → approval → payout → settlement → accounting  
**Foundation:** M0/M1 + GF1 + GF2 + GF3 must remain regression-safe  
**Baseline:** M5 reimbursements (`actions.reimbursements`, `calculateReimbursement`, mock payout)

Classification: **DONE** | **PARTIAL** | **MISSING** | **BROKEN** | **NEEDS_REFACTOR**

---

## Summary (post-implementation)

| Area | Status |
|---|---|
| STANDARD / MILEAGE / PER_DIEM types | DONE |
| Server-side mileage & per diem calc (rates locked) | DONE |
| DRAFT → submit → IN_REVIEW lifecycle | DONE |
| Policy snapshot (result/reason/rules/actions/version) | DONE |
| Requirements checklist | DONE |
| Duplicate detection | DONE |
| Approval + SoD (shared engine) | DONE |
| Inbox `REIMBURSEMENT_APPROVAL` | DONE |
| Payout ≠ approve permissions | DONE |
| Async worker settlement + sandbox confirm | DONE |
| FAILED / RETURNED states | DONE |
| Accounting only after settle (idempotent) | DONE |
| Reporting KPIs | DONE |
| Detail UX | DONE |
| Mobile employee journey | PARTIAL (scaffold; web validated) |
| Playwright D–D4 | DONE |
| DB + unit tests | DONE |

---

## Reused unchanged

- Shared Approval Engine + SoD
- GF1 document/receipt ingest + OCR abstraction
- Mock payout adapter (labeled SANDBOX / MOCK)
- `queueAccounting` unique REIMBURSEMENT source
- Permissions: `reimbursement.create|approve|pay`

## Deferred

- Full native mobile capture/offline
- Live payout rail / bank return ledger depth
- Map-based mileage providers

**Evidence:** `P0_GF4_TEST_REPORT.md`
