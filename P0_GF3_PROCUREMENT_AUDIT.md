# P0-GF3 Procurement Audit

**Date:** 2026-09-21  
**Scope:** Program → Request → Policy → Approval → PO → Receiving → Bill Match → GF2 AP  
**Foundation:** M0/M1 + GF1 + GF2 must remain regression-safe  
**Baseline:** M8 procurement spine (`actions.procurement`, shared policy/workflow/inbox)

Classification: **DONE** | **PARTIAL** | **MISSING** | **BROKEN** | **NEEDS_REFACTOR**

---

## Summary (post-implementation)

| Area | Status |
|---|---|
| Procurement Program / intake config | DONE |
| Purchase Request lifecycle + policy snapshot | DONE |
| Multi-step approval + SoD (shared engine) | DONE |
| Universal Inbox `PROCUREMENT_REQUEST` | DONE |
| Vendor link / proposed vendor fields | DONE |
| PO create after final approval (idempotent) | DONE |
| PO lifecycle / `ISSUED` + receive states | DONE |
| Partial receiving / over-receive block | DONE |
| Service / amount receipt semantics | DONE |
| GF2 Bill `purchaseOrderId` link | DONE |
| 2-way / 3-way match + % tolerance | DONE |
| Match exceptions first-class + resolve | DONE |
| Exception inbox `PROCUREMENT_MATCH_EXCEPTION` | DONE |
| Budget commitments on issue / release on match | DONE |
| PO change orders | DONE |
| Reporting procurement KPIs | DONE |
| GF3 UX (Requests/Programs/POs/Receiving/Exceptions) | DONE |
| Playwright C / C2 / C3 | DONE |
| DB + unit tests | DONE |

---

## Detail

### DONE
- Shared Policy Engine on submit (`vendor_required`, `quote_required`, amount/memo/high-value); snapshot persisted.
- Shared Approval Engine: manager → finance; SoD; progress labels on request detail + inbox.
- Unique `(organizationId, requestId)` PO create; replay does not duplicate.
- PO issued as `ISSUED` with `issuedAt`, lines, commitment fields.
- Receiving: amount / quantity / service; partial; over-receive blocked without override; idempotency key.
- Match: MATCHED / WITHIN_TOLERANCE / EXCEPTION / BLOCKED; qty 3-way; exception resolve; inbox tasks.
- Commitments: budget commit on PO issue when program has `budgetId`; release on matched bill delta.
- Change orders: `PoChangeOrder` + request/approve APIs.
- Reporting: open requests, awaiting approval, open POs, match exceptions.
- Web nav + detail/match-exception UX; terminates into GF2 bill → payment → accounting.

### PARTIAL (acceptable for GF3; not blockers)
- Program admin UI covers core fields; not every eligibility knob has a dedicated form control (API/schema present).
- External PO email/PDF delivery remains sandbox/local.
- Full parallel/conditional step matrix beyond seeded manager+finance remains engine-capability, not new GF3 routing UI.

### MISSING / deferred (out of milestone)
- Sourcing / RFP, advanced contracts, renewal/price/license intelligence (flagged P1).
- Live mail delivery of issued POs.
- Dedicated commitment ledger distinct from Budget + PO amount fields.

### BROKEN
- None remaining after receive-status fix (`AMOUNT`/`SERVICE` receipt no longer blocked by unused `orderedQuantity`).

### NEEDS_REFACTOR
- Incremental only: continue peeling `actions.procurement` into module services when convenient; do not redesign shared engines.

---

## Build evidence

- Migration: `20260921140000_p0_gf3_procurement`
- Tests: API **96/96**; Playwright **8/8** (A–C3)
- Report: `P0_GF3_TEST_REPORT.md`
