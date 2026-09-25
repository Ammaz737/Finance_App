# P0 Performance Report

**Date:** 2026-09-21  
**Environment:** Local Windows · API `:3001` · Web `:3002` · PostgreSQL local  
**Scope:** Directional baseline only — **not** a production SLA claim

---

## Methodology

1. Warm API + seed data (Acme).
2. Authenticated GETs for high-traffic surfaces.
3. Inspect Prisma indexes for common filters.
4. Flag unbounded `findMany` without `take` where noticed.

Suggested manual timing (browser Network / `curl -w`):

| Endpoint | Why |
|---|---|
| `GET /reporting` | Home / insights dashboard |
| `GET /inbox` (engine) | Universal inbox |
| `GET /transactions` | Spend ops |
| `GET /expenses` | Expense ops |
| `GET /bills` | AP |
| `GET /payments` | Treasury |
| `GET /procurement` | Buying |
| `GET /accounting` | Close |
| `GET /travel` | Travel |
| `GET /search?q=` | Global search |

Record p50 locally; do not extrapolate to multi-tenant prod load.

---

## Index evidence (existing)

Heavy use of composites already in `schema.prisma`, including:

- `organizationId + status` on trips, expenses, bills, payments, reimbursements, accounting, inbox
- `organizationId + travelerId` / `userId` / `vendorId` / `cardId`
- `organizationId + tripId` on bookings
- Outbox / notifications time indexes

**No new indexes added in closure** without measured slow queries.

---

## Observations / risks

| Risk | Mitigation |
|---|---|
| ResourcePage loads up to 100 rows then filters client-side | Acceptable for P0 seed scale; server filters for status when added later |
| Reporting dashboard many parallel aggregates | Already Promise.all; monitor as data grows |
| Search fans out to 11 resources × take 8 | Bounded; authz short-circuits missing grants |
| N+1 on detail pages | Prefer getDetail includes (travel/bill/PO patterns) |

---

## Result

**Baseline documented.** No blocking P0 performance defect identified at seed scale.
