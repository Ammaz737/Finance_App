# P0 Closure Audit

**Date:** 2026-09-21  
**Purpose:** Close P0 as one coherent product (no new modules, no live providers)  
**Baseline:** M0/M1 + GF1–GF5 validated

Classification: **COMPLETE** | **PARTIAL** | **INCONSISTENT** | **BROKEN** | **DEFERRED_EXTERNAL_INTEGRATION**

---

## Product areas

| Area | Status | Notes |
|---|---|---|
| Foundation (auth, tenancy, outbox, money) | COMPLETE | Org-scoped queries; Decimal money; outbox catalog |
| People | COMPLETE | Invite/activate/publish/terminate + SoD |
| Entities / Depts / Locations | COMPLETE | Seeded; entity scoping in resource-access |
| RBAC | COMPLETE | Permissions + grants; child-resource scopedWhere fix |
| Policy engine | COMPLETE | PASS/WARN/REVIEW/BLOCK + matched rules snapshot on GF flows |
| Approvals | COMPLETE | Shared workflow engine; SoD; inbox actions |
| Inbox | COMPLETE | Spend/expense/bill/procurement/match/reimbursement/travel types |
| Spend programs / requests | COMPLETE | Policy + fulfillment fund/card |
| Funds / Cards / Transactions | COMPLETE | Sandbox issuer; MCC/fund expiry; capture→expense |
| Expenses / Receipts | COMPLETE | Requirements + GF1 accounting path |
| Reimbursements | COMPLETE | STANDARD/MILEAGE/PER_DIEM; payout SoD |
| Vendors / Bills / Payments / Runs | COMPLETE | Duplicate/vendor match; release SoD; settlement |
| Procurement / POs / Receiving / Match | COMPLETE | PO on approval; 2/3-way match; exceptions |
| Travel / Trips / Bookings | COMPLETE | Mock provider; reprice; fund/card; cancel/refund |
| Accounting | COMPLETE | Shared queue; mock ERP sync |
| Budgets / Reporting | COMPLETE | Backend KPIs incl. travel; currency-aware |
| Documents | PARTIAL | Upload + OCR mock; not full DMS |
| Search | COMPLETE | Authz-scoped; people/cards/txns/expenses/reimb/vendors/bills/payments/PO/trips/spend |
| Notifications | PARTIAL | In-app list; core events present; no external messaging |
| Audit | COMPLETE | AuditEvent on domain actions |
| Integrations framework | DEFERRED_EXTERNAL_INTEGRATION | Mock adapters only (by design for P0) |

---

## Cross-cutting closure work (this milestone)

- Unfinished P1/P2 routes blocked in shell (`isUnfinishedProductRoute`) even on direct URL
- Travel nav: Search + Reports
- ResourcePage: business fields primary; IDs under System information; API error messages surfaced
- Search expanded for reimbursements/payments/cards with deep links
- Playwright **F** integrated coexistence journey added
- Money invariants hardened: no budget spillover to all entity budgets; travel refund clamps fund restore to `limitAmount`; travel booking KPIs count **CONFIRMED** only
- `policies` / `approvals` readable with `roles.assign`; people create uses `people.invite` only (no double `roles.assign` gate)

---

## Known intentional gaps (not P0 blockers)

| Gap | Disposition |
|---|---|
| Live card/rail/ERP/payout/travel/OCR | DEFERRED_EXTERNAL_INTEGRATION |
| Distinct TravelRequest entity | Trip doubles as request |
| Native mobile booking | Scaffold only |
| Advanced table features everywhere | Prioritized lists use ResourcePage filters/views |
| Automated axe CI | Documented as accessibility follow-up |
| Docker Redis when Docker Desktop down | Document operational dependency |
| Child-resource list scope (bookings/matches/receipts) | Tenant-scoped with parent mutate checks; join-parent list hardening deferred |
| `people.entityField=id` quirk | Documented in auth matrix; Owner/Finance org grants cover seed |

---

## Verdict

**P0 COMPLETE** for product closure (GF1–GF5 + integration F). External-provider certification is explicitly out of this gate.
