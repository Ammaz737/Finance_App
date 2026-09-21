# P0-GF2 Test Report — Vendor → Bill → Payment → Accounting

**Date:** 2026-09-21  
**Audit:** `P0_GF2_AP_AUDIT.md`  
**Foundation:** M0/M1 + P0-GF1 unchanged (regression-safe)

---

## Summary

GF2 hardens the AP vertical on top of M6: vendor legal/display/payment readiness, bank verify SoD, bill vendor-match + duplicate tiers, invoice OCR sandbox path, richer bill/payment detail + inbox `BILL_APPROVAL`, AP reporting KPIs, and expanded Playwright B/B2/B3.

| Gate | Result |
|---|---|
| API Vitest | **96/96 PASS** (29 files) |
| API / Web / Worker tsc | **PASS** |
| Worker event-catalog tests | **PASS** |
| Migration `20260921120000_p0_gf2_ap_hardening` | **Applied** |
| Redis | **PONG** |
| Playwright | **5/5 PASS** (A, A2, B, B2, B3) |
| GF1 regression (A + A2) | **PASS** |

---

## Files changed (high level)

### Schema / migration
- `apps/api/prisma/schema.prisma` — Vendor legal/display/paymentStatus; bank method/beneficiary/currency/country/verified*; Bill invoiceDate/tax/subtotal/department/match/duplicate/coding; BillLine GL dims; Attachment ocr*
- `apps/api/prisma/migrations/20260921120000_p0_gf2_ap_hardening/`

### Domain
- `apps/api/src/modules/ap/domain/vendor-match.ts`
- `apps/api/src/modules/ap/domain/duplicate-check.ts`

### API
- `apps/api/src/application/actions.ts` — vendors create/bank/verify/detail; bills create/match/duplicate/draft/fromDocument/coding/detail; payment detail; reporting AP KPIs
- `apps/api/src/modules/registry.ts` — verify-bank, update-coding, createFromDocument fields
- `apps/api/src/platform/resource-access.ts` — verify-bank / update-coding actions
- `apps/api/src/engines/inbox/index.ts` — `BILL_APPROVAL` type + bill fields

### Worker
- Invoice OCR on CLEAN `INVOICE` (`invoice.ocr_requested`)
- `ocr.processor.ts` invoice extraction (SANDBOX / MOCK OCR)
- Payment worker audit aligned to `payment.settled`
- Event catalog + dispatch + `OUTBOX_EVENT_CATALOG.md`

### Web
- Bill Pay nav: Bills / For approval / For payment / Payments / Runs / History
- Bill detail: summary, lines, approval progress, payments, activity
- Payment detail page
- Vendor 360: payment readiness, verify bank, POs, timeline
- Bills stage tabs include `NEEDS_REVIEW`

### Tests
- `apps/api/src/tests/ap-intake.test.ts`
- `apps/web/e2e/golden-flows.spec.ts` — B expanded; **B2** partial; **B3** negatives

---

## Playwright evidence

```
ok A: spend request to accounting golden journey
ok A2: declined authorization + tenant isolation negatives
ok B: bill approval, release, settlement, and accounting golden journey
ok B2: partial payment then settle remaining
ok B3: AP negatives — duplicate, creator SoD, tenant isolation
5 passed
```

baseURL: `http://localhost:3002` · API `:3001`

---

## Acceptance checklist

- [x] Bill creation (API + web detail)
- [x] Invoice OCR sandbox path (upload INVOICE → scan → OCR → createFromDocument)
- [x] Vendor matching (MATCHED/SUGGESTED/NO_MATCH)
- [x] Duplicate detection (CLEAR / POSSIBLE_DUPLICATE / DUPLICATE_BLOCKED)
- [x] Shared approval engine + visible progress
- [x] bill.approve ≠ payment.release
- [x] Unauthorized release blocked
- [x] Release idempotent; settle after provider/sandbox confirm
- [x] Partial payments; no overpay (DB + B2)
- [x] Payment runs (existing M6 + regression)
- [x] Accounting BILL/PAYMENT sources
- [x] Reporting AP KPIs
- [x] Audit timeline on bill/vendor/payment detail
- [x] Tenant/RBAC negatives (B3 + auth matrix)
- [x] GF1 regression
- [x] Typecheck + API/worker tests

---

## Remaining / deferred (not GF3)

- Certified live payment rail / ERP (mock remains)
- Full RETURNED payment state machine beyond FAILED
- Production malware engine (sandbox scan only)
- Email invoice intake
- Consolidate settle helper into a shared package used by API + worker (logic aligned; still duplicated)
- Deep browser create-form wizard (API create + UI detail covered)

**NEXT:** Stop — do not start P0-GF3.
