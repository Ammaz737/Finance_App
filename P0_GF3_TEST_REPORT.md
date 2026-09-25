# P0-GF3 Test Report — Procurement → PO → Receiving → Match → GF2 AP

**Date:** 2026-09-21  
**Audit:** `P0_GF3_PROCUREMENT_AUDIT.md`  
**Foundation:** M0/M1 + P0-GF1 + P0-GF2 unchanged (regression-safe)

---

## Summary

GF3 completes the procurement vertical on the M8 spine: program intake, policy snapshot, multi-step approval, idempotent PO issuance, partial/qty/service receiving, 2/3-way match with tolerances and first-class exceptions, commitments, change orders, inbox types, reporting KPIs, and Playwright C/C2/C3 — all terminating into existing GF2 Bill → Payment → Accounting.

| Gate | Result |
|---|---|
| API Vitest | **96/96 PASS** (29 files) |
| API / Web / Worker tsc | **PASS** |
| Migration `20260921140000_p0_gf3_procurement` | **Applied** |
| Redis | **PONG** |
| Playwright | **8/8 PASS** (A, A2, B, B2, B3, C, C2, C3) |
| GF1 regression (A + A2) | **PASS** |
| GF2 regression (B + B2 + B3) | **PASS** |

---

## Files changed (high level)

### Schema / migration
- `apps/api/prisma/schema.prisma` — program tolerance/receiving/budget; request policy + intake fields; PO issuance/qty/commitment; receiving qty/type/idempotency; MatchRecord exception fields; `PoChangeOrder`
- `apps/api/prisma/migrations/20260921140000_p0_gf3_procurement/`

### Domain
- `apps/api/src/modules/procurement/domain/match.ts` — 2/3-way + % tolerance + qty
- `apps/api/src/modules/procurement/domain/state-machine.ts` — receive eligibility + next status (amount vs quantity semantics)
- `apps/api/src/engines/policy/index.ts` — `vendor_required` / `quote_required`
- `apps/api/src/engines/inbox/index.ts` — `PROCUREMENT_REQUEST`, `PROCUREMENT_MATCH_EXCEPTION`

### API
- `apps/api/src/application/actions.ts` — submit/approve→ISSUED+FULFILLED, receive, match, resolveException, change orders, details, reporting KPIs, budget commit/release
- `apps/api/src/modules/registry.ts` — purchase-orders receive/match/request-change; matches resolve; receiving create
- `apps/api/src/platform/resource-access.ts` — action permissions
- Seed: procurement workflow manager+finance; policy rules; `procurement.request` for Employee

### Web
- Nav: Requests / Programs / Purchase Orders / Receiving / Match Exceptions
- Request detail: overview, policy, approvals progress, activity
- PO detail: lines, receiving, matching, remaining commitment, activity
- Match exceptions: table + review drawer actions

### Tests
- `procurement-pos.db.test.ts`, `procurement-match.test.ts`
- `apps/web/e2e/golden-flows.spec.ts` — **C**, **C2**, **C3**

### Events / outbox
- Existing informational: `procurement.*`, `receiving.recorded`, `procurement.matched` (worker catalog + docs)

---

## Playwright evidence

```
ok A: spend request to accounting golden journey
ok A2: declined authorization + tenant isolation negatives
ok B: bill approval, release, settlement, and accounting golden journey
ok B2: partial payment then settle remaining
ok B3: AP negatives — duplicate, creator SoD, tenant isolation
ok C: procurement request → PO → receiving → bill match → GF2 settle
ok C2: 3-way match exception when invoice exceeds received qty
ok C3: procurement negatives — self-approve, over-receive, duplicate PO
8 passed
```

baseURL: `http://localhost:3002` · API `:3001`

---

## Acceptance checklist

- [x] Procurement Program / intake
- [x] Purchase Request through Web + API
- [x] Policy result persisted
- [x] Multi-step approval + Universal Inbox
- [x] Exactly one PO after final approval (idempotent)
- [x] PO state machine; partial + over-receive prevention
- [x] Service / amount receiving
- [x] GF2 Bill link + 2/3-way match + tolerances
- [x] Match exceptions + review
- [x] Commitments; change orders
- [x] Bill → Payment → Settlement → Accounting via GF2
- [x] Reporting + audit/outbox
- [x] Tenant / RBAC / SoD (C3 + matrix)
- [x] GF1 + GF2 regression green
- [x] Redis healthy; tsc green; API tests pass
- [x] Playwright C, C2, C3

---

## Remaining / deferred (not GF4)

- Sourcing / RFP, advanced contracts, renewals, price/license intelligence
- External PO document email delivery (sandbox/local only)
- Certified live rail / ERP (unchanged mock path)
- Richer program eligibility admin forms beyond API fields

**NEXT:** Stop — do not start P0-GF4.
