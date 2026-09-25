# P0 Authorization Matrix

**Date:** 2026-09-21  
**Source of truth:** `apps/api/src/platform/resource-access.ts` + `apps/api/src/modules/registry.ts`  
**Convention:** All list/get actions apply `organizationId` via `scopedWhere`. Owner / `*` bypasses narrow grants.

| Resource | Methods (pattern) | Create perm | Action → perm | Owner field | Entity field | Notes |
|---|---|---|---|---|---|---|
| entities | GET/POST /entities | roles.assign | — | — | id | publicToTenant |
| departments | GET/POST | roles.assign | — | — | — | publicToTenant |
| locations | GET/POST | roles.assign | — | — | — | publicToTenant |
| people | GET/POST /:id/actions | people.invite | publish/terminate/reset-credentials → people.edit | — | id | |
| cards | GET /:id/actions | — | freeze/unfreeze/terminate/set-controls → card.freeze/issue | holderId | legalEntityId | |
| funds | GET | — | — | ownerId | legalEntityId | read via card.read |
| spend-programs | GET/POST /deactivate | spend_program.manage | deactivate → spend_program.manage | — | legalEntityId | publicToTenant |
| spend-requests | GET/POST /approve | spend_request.create | approve → spend_request.approve | requesterId | legalEntityId | |
| authorizations | POST | card.issue | — | — | — | sandbox |
| transactions | GET /capture|void|reverse|clear | — | card.issue | — | legalEntityId | |
| expenses | GET/POST /submit|approve|… | expense.create | submit/update-memo/split → create; approve → approve | userId | legalEntityId | |
| receipts | GET/POST /link | expense.create | link → expense.create | — | — | |
| reimbursements | GET/POST /submit|approve|schedule|… | reimbursement.create | pay actions → reimbursement.pay | userId | legalEntityId | |
| vendors | GET/POST /set-bank|verify-bank | vendor.create | bank → vendor.bank_details.manage | — | legalEntityId | |
| bills | GET/POST /submit|approve|update-coding | bill.create | approve → bill.approve | — | legalEntityId | |
| payments | GET/POST /release|confirm-settlement | payment.create | release/settlement → payment.release | — | legalEntityId | |
| payment-runs | GET/POST /release|add-payments | payment_run.manage | same | — | legalEntityId | |
| procurement | GET/POST /submit|approve | procurement.request | approve → procurement.review | requesterId | legalEntityId | |
| purchase-orders | GET /receive|match|request-change | — | procurement.review | — | legalEntityId | |
| receiving | GET/POST | procurement.review | — | — | — | |
| matches | GET /resolve | — | resolve → procurement.review | — | — | |
| po-change-orders | GET /approve | — | approve → procurement.review | — | — | |
| travel | GET/POST /search|select-quote|submit|approve|provision|… | travel.book | approve → travel.approve | travelerId | legalEntityId | |
| travel-bookings | /book-mock|reprice|confirm|cancel|refund | — | travel.book | — | — | Child resource: tenant scope if grant exists; trip ownership in actions |
| accounting | GET /code|ready|sync|… | — | code/ready → accounting.code; sync → accounting.sync | — | legalEntityId | |
| accounting-rules | GET/POST | accounting.code | — | — | — | |
| erp-sync | GET/POST | accounting.sync | — | — | — | |
| budgets | GET/POST | budget.manage | — | — | legalEntityId | |
| integrations | GET /ping | — | ping → accounting.sync | — | — | |
| treasury | GET/POST /approve|release|… | treasury.transfer.create | approve/release | — | — | P1-hidden in nav |
| audit | GET | — | — | — | — | audit.read |
| policies | GET/POST | roles.assign | — | — | — | Admin policy defs |
| approvals | GET/POST | roles.assign | — | — | — | Workflow defs |
| reporting | GET /reporting | report.read | — | — | — | Custom router |
| search | GET /search?q= | authenticated | — | — | — | Per-resource scopedWhere |
| documents | POST upload | expense/bill/vendor create | — | — | — | |
| identity | login/activate/overview | public / session | — | — | — | |
| inbox | GET/POST actions | session | — | — | — | Engine |

## Gaps / Owner-only scaffolds (not P0 product)

Resources mounted without full product UX (disputes, receivables, AI, tax, rewards, developer) remain **Owner-default** or unused; UI blocked unless P1/P2 flags enabled.

## Tests covering authz

- `tenancy.db.test.ts` — two-tenant isolation
- `auth-matrix.test.ts` — permission matrix unit checks
- `resource-access.test.ts` — scopedWhere shapes
- Playwright A2/B3/C3/D4/E5/F — SoD + isolation negatives
