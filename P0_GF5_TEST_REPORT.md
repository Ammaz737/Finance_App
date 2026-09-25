# P0-GF5 Travel — Test Report

**Date:** 2026-09-21  
**Scope:** Travel Request → Policy → Approval → Search → Offer/Reprice → Booking → Trip → Fund/Card → Expense → Accounting  
**Baseline preserved:** M0/M1 + GF1–GF4

---

## Gates

| Gate | Result |
|---|---|
| API Vitest | **104/104** |
| API `tsc` | GREEN |
| Web `tsc` | GREEN |
| Worker `tsc` | GREEN |
| Redis | PONG |
| Playwright | **17/17** (A, A2, B, B2, B3, C, C2, C3, D, D2, D3, D4, **E, E2, E3, E4, E5**) |

---

## What was verified

### Unit / adapter
- Normalized FLIGHT/HOTEL/CAR quotes from `MockTravelAdapter`
- Reprice mild vs `forceHigh`; tolerance helper
- Cancel → REFUND_PENDING / CANCELLED; refund → REFUNDED
- Policy PASS/REVIEW for max amount + OOP
- State helpers: search/book on `READY_TO_BOOK`

### DB integration (`travel-core.db.test.ts`)
- In-policy submit → `READY_TO_BOOK`; hold ≠ confirm; confirm provisions fund + travel MCC card
- OOP → `PENDING_APPROVAL`; SoD blocks self-approve; approve → `READY_TO_BOOK`
- Reprice above tolerance persists `REPRICE_REQUIRED` then throws
- Cancel/refund lifecycle; duplicate refund idempotent
- Booking idempotency key does not create duplicate hold

### Product flows (Playwright)
- **E** Golden travel → book → fund/card → expense → accounting → reporting/audit
- **E2** OOP requires inbox approval before book
- **E3** Force-high reprice blocks booking
- **E4** Cancel + refund
- **E5** SoD, MCC block, booking idempotency, isolation 404

### Shared-engine fix
- `scopedWhere`: child resources without owner/entity columns (e.g. `travel-bookings`) allow tenant scope when the actor has the action permission; handlers still enforce trip ownership.

### GF1–GF4 regression
- A–D4 all green in the same Playwright run

---

## Migrations

- `apps/api/prisma/migrations/20260921180000_p0_gf5_travel/migration.sql`
  - Trip: origin, department, international, cardId, policy snapshot fields, repriceTolerance
  - Booking: offer snapshot, quoted/approved amounts, cancel/refund fields, idempotency
  - `traveler_profiles` table
  - Remap legacy `APPROVED` → `READY_TO_BOOK`

---

## API surface (additions)

| Route | Action |
|---|---|
| `POST /travel` | createTrip (+ origin/department/international/tolerance) |
| `POST /travel/:id/search` | mock FLIGHT/HOTEL/CAR |
| `POST /travel/:id/select-quote` | immutable offer snapshot |
| `POST /travel/:id/submit` | policy → READY_TO_BOOK or PENDING_APPROVAL |
| `POST /travel/:id/approve` | → READY_TO_BOOK |
| `POST /travel/:id/provision` | travel fund/card |
| `POST /travel/:id/import-booking` | off-platform import |
| `POST /travel-bookings/:id/reprice` | tolerance gate |
| `POST /travel-bookings/:id/book-mock` | hold + optional idempotency |
| `POST /travel-bookings/:id/confirm` | CONFIRMED + provision |
| `POST /travel-bookings/:id/cancel` | CANCELLED / REFUND_PENDING |
| `POST /travel-bookings/:id/refund` | REFUNDED |

Inbox type: `TRAVEL_REQUEST`  
Reporting: `travel` KPI object on `/reporting`

---

## Files changed (high level)

- `apps/api/src/application/actions.ts` — travel lifecycle, provision, reprice, cancel/refund, expense match, reporting KPIs
- `apps/api/src/integrations/travel/*` — provider + mock reprice/cancel/refund
- `apps/api/src/modules/travel/domain/state-machine.ts`
- `apps/api/src/modules/registry.ts`, `resource-access.ts`, `engines/inbox/index.ts`
- `apps/api/prisma/schema.prisma` + migration `20260921180000_p0_gf5_travel`
- `apps/web` travel trip/search/reports pages; `e2e/golden-flows.spec.ts` E–E5
- `apps/mobile` trip list/detail stubs
- `P0_GF5_TRAVEL_AUDIT.md`, `P0_GF5_TEST_REPORT.md`, `IMPLEMENTATION_PLAN.md`

---

## Remaining gaps (deferred — not P1/P2)

- Real Duffel / Expedia / TravelPerk adapters
- Gmail/Outlook booking ingestion
- Full native mobile search/book UX
- Guest booking; negotiated-rate management
- Distinct TravelRequest entity (trip doubles as request for GF5)

---

## STOP

**GF5 complete.** Do not start P1/P2.
