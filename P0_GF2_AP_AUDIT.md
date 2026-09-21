# P0-GF2 Accounts Payable Audit

**Date:** 2026-09-21  
**Scope:** Vendor → Bill → Approval → Payment Release → Settlement → Accounting  
**Foundation:** M0/M1 + P0-GF1 complete (do not redesign)  
**Baseline:** M6 Vendor/AP/payments largely implemented

Classification: **DONE** | **PARTIAL** | **MISSING** | **BROKEN** | **NEEDS_REFACTOR**

---

## Summary

Golden-path AP spine (create bill → multi-step approve → schedule → release → settle → accounting) works under M6 with strong DB coverage and Playwright journey **B**. GF2 closes intake intelligence, vendor/payment-detail richness, duplicate tiers, approval/inbox clarity, bill UX depth, and regression-safe settlement/idempotency proofs — without redesigning M0/M1 or GF1.

| Area | Status |
|---|---|
| Vendor model / Vendor 360 | PARTIAL |
| Vendor payment details | PARTIAL |
| Bill intake (manual) | DONE |
| Invoice document / OCR → draft | MISSING |
| Vendor matching | MISSING |
| Duplicate detection | PARTIAL |
| Bill lifecycle states | PARTIAL |
| Bill review UI | PARTIAL |
| Bill approval + SoD | DONE |
| Inbox bill tasks | PARTIAL |
| bill.approve ≠ payment.release | DONE |
| Payment create / partial | DONE |
| Payment release | DONE |
| Provider abstraction (mock) | DONE |
| Settlement idempotency | DONE |
| Return / failure paths | PARTIAL |
| Payment runs | DONE |
| Accounting BILL/PAYMENT | DONE |
| ERP sync | PARTIAL |
| Reporting AP metrics | PARTIAL |
| Audit / timeline on detail | PARTIAL |
| Bill Pay navigation / UX | PARTIAL |
| Playwright B | DONE (spec); expand for partial + negatives |
| Dual settlement paths | NEEDS_REFACTOR |

---

## Detailed classification

### 1. Vendor model / Vendor 360 — PARTIAL
`Vendor`: `name`, `category`, `ownerId`, `legalEntityId`, `status`, `taxId`, `riskLevel`, `notes`.  
360 UI: bills, payments, bank history, KPIs.  
**Gaps:** no legal vs display name; no payment-readiness aggregate; owner shown as id.

### 2. Vendor payment details — PARTIAL
`VendorBankAccount` stores masked `last4` / `routingMasked`, supersession, `vendor.bank_changed` audit+outbox, permission `vendor.bank_details.manage`.  
**Gaps:** no verify transition; no paymentMethod / beneficiary / currency / country; bank changer SoD for release already separate.

### 3. Bill intake — DONE (manual)
Create with vendor, invoice #, amount, lines, attachmentId, PO link; starts approval. Submit exists for DRAFT.

### 4. Invoice OCR pipeline — MISSING
Upload supports `INVOICE` classification; worker OCR only for `RECEIPT` → Receipt rows. No invoice extraction → bill draft.

### 5. Vendor matching — MISSING (for AP)
Receipt match enum exists for expenses only. No bill `vendorMatchStatus`.

### 6. Duplicate detection — PARTIAL
Hard unique `(org, vendor, invoiceNumber)` → `DUPLICATE_INVOICE`. No `CLEAR` / `POSSIBLE_DUPLICATE` / evidence persistence.

### 7. Bill lifecycle — PARTIAL
Statuses: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PARTIAL`, `PAID`, `REJECTED`.  
Create skips DRAFT (goes straight to pending). UI stages reference DRAFT/IN_REVIEW inconsistently. No explicit `READY_FOR_PAYMENT` (APPROVED serves that role).

### 8. Bill review UI — PARTIAL
Detail shows lines, remaining, payments, accounting. Missing: duplicate result, vendor match, approval progress, timeline, coding panel.

### 9. Bill approval — DONE
Shared Approval Engine; seed steps `ap` → `finance`; creator SoD; consecutive distinct-step SoD; progress via inbox.

### 10. Inbox — PARTIAL
Bills appear as generic `APPROVAL` with `objectType: bill`. Spec wants `BILL_APPROVAL` + richer fields (vendor, duplicate, progress).

### 11. Approve ≠ release — DONE
Distinct permissions + UI gating + auth matrix + SoD tests.

### 12–16. Payments / settlement / mock rail — DONE
Schedule idempotent; partial vs remaining; release → PROCESSING; settle decrements remaining once; unique settlementId.

### 17. Return / failure — PARTIAL
FAILED path on rail decline; RETURNED not fully modeled.

### 18. Payment runs — DONE
Create, add payments, release with SoD; UI pages exist.

### 19–20. Accounting + ERP — PARTIAL / DONE queue
`BILL` on create, `PAYMENT` on settle; mock sync path. No AP-specific ERP mapping tests beyond queue.

### 21. Reporting — PARTIAL
`openPayablesByCurrency`, `pendingBills`. Missing aging / failures / vendor spend KPIs on dashboard.

### 22. Audit timeline — PARTIAL
Events emitted; bill/vendor detail pages do not surface timeline.

### 23. UI — PARTIAL
Bill-pay bills/payments/runs present; recurring/settings stubs. UUID-heavy in places.

### 24. Playwright — PARTIAL
Journey B covers approve → pay → settle → accounting. Missing: partial-payment journey, richer negatives (bank change, duplicate tiers, worker settle).

### 25. Settlement dual path — NEEDS_REFACTOR
`settlePaymentRecord` (API sandbox) vs `payments.processor.ts` (worker). Prefer single shared helper; E2E may keep sandbox confirm when worker disabled.

---

## GF2 build plan (priority)

1. Schema: vendor legal/display/paymentStatus; bank method/beneficiary/currency/country/verified*; bill invoiceDate/tax/subtotal/department; vendorMatch*; duplicate*; codingSource; timeline via existing AuditEvent.
2. Domain: `vendor-match`, `duplicate-check`; wire into bill create + intake-from-document.
3. Invoice OCR: CLEAN INVOICE → `invoice.ocr_requested` → mock extraction; `bills.createFromDocument` / review path.
4. Bank verify action; SoD unchanged for payment.release.
5. Inbox type `BILL_APPROVAL` for bill objectType; richer payload.
6. Bill getDetail: approval progress, duplicate, match, timeline, coding.
7. Reporting KPIs: overdue, partial, failures, approved payables.
8. UI: nav emphasis, bill/payment detail sections, SANDBOX labels.
9. Tests + Playwright B/B2/negatives; GF1 regression.

**Reuse:** M6 models/actions, approval engine, mock rail, accounting queue, payment runs, existing Playwright B actors (`treasury`, `ap`, `admin`).
