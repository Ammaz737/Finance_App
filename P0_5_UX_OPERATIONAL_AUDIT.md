# P0.5 UX & Operational Completion Audit

**Date:** 2026-09-22  
**Scope:** Existing P0 company web product only. No P1/P2 modules, architectural redesign, or live-provider implementation.

## Outcome

P0.5 closes the audited UI and operational gaps over the existing GF1–GF5 domain services. Existing tenant scoping, entity scoping, RBAC, separation of duties, audit events, outbox events, state machines, and mock-provider boundaries remain authoritative.

## Acceptance map

| Area | Delivered behavior | Result |
|---|---|---|
| Authentication | Admin invite returns a browser activation path; sandbox copy-link replaces raw-token UX. `/activate`, `/forgot-password`, `/reset-password`, authenticated password change, session revocation, and explicit expired-session login notice are implemented. | PASS |
| Payment runs | Detail UI selects only eligible scheduled payments, prevents duplicates, removes items while OPEN, shows count/total/source/validation, and releases via GF2 payment release. | PASS |
| Vendor payment details | Vendor 360 exposes masked current details, method/verification/change history, protected add/change and verification; raw account secrets are never rendered. | PASS |
| Match exceptions | Review UI exposes override, receiving update, corrected invoice, reject, resolve, and comment over the existing tolerance/SoD/audit path. | PASS |
| Cards and spend | Freeze/unfreeze/terminate and merchant/MCC/per-transaction/velocity controls are accessible; programs support guarded edit/deactivate. | PASS |
| My Work and notifications | Request rows open exact request details. Inbox and actionable notifications resolve to exact records, including query-selected match/accounting records. | PASS |
| Bills | Dedicated creation supports vendor/entity/invoice dates/currency, line quantity/unit price/tax/coding, document upload, and authoritative server totals. DRAFT correction and valid cancel semantics are exposed. | PASS |
| Resource corrections | Edit/archive/deactivate/cancel/terminate/version/change-order semantics are domain-specific. Settled, cleared, paid, issued-history, synced, and audited records are not hard-deleted. | PASS |
| Receipts | Unmatched receipt detail provides deterministic suggested candidates plus employee/merchant/amount/date/transaction/expense search and explicit selection. | PASS |
| Reimbursements | Submit is available from personal/finance lists; mileage and per-diem inputs, configured rates, and server-calculated results are visible. | PASS |
| Travel | State-dependent cancel/refund actions, terms, refund state/amount, and activity are exposed using GF5 sandbox behavior. | PASS |
| People and roles | Admin can update manager/department/location/entity, assign/remove roles, suspend/terminate, and reset credentials. Role detail shows permissions, scope, and entity restrictions. | PASS |
| Policy builder | Create, version/edit, disable, simulate, priority/effective date/enabled state, controlled conditions, and supported actions are available without JSON DB editing. | PASS |
| Approval builder | Create/version, enable/disable, serial/parallel steps, assignee types, thresholds, entity/department routing, and preview/simulation use the shared engine. | PASS |
| Accounting dimensions | Local GL/department/location/class/project/custom dimensions can be created/updated; provider/source identity is retained and provider-synced values are protected. | PASS |
| UX consistency | Existing forms, notices, validation errors, loading/error states, confirmations, and permission surfaces were reused; no global visual redesign. | PASS |

## Security and financial invariants

- Password activation/reset tokens are random, stored only as hashes, expire, and are consumed once. Password changes revoke other sessions.
- Forgot-password responses do not disclose whether an account exists. Sandbox paths are returned only outside production.
- Payment-run additions are tenant/entity scoped, scheduled-only, and assigned atomically; release retains creator/releaser SoD.
- Vendor bank presentation is masked. Changes and verification retain changer/verifier SoD and history.
- Bill totals are recomputed server-side from line values; DRAFT-only editing prevents arbitrary mutation after protected stages.
- Organizational archives and deactivations are rejected when active financial dependencies make them unsafe.
- Policy/workflow edits create versions; active workflow selection honors enabled/effective dates. A preservation migration keeps pre-P0.5 workflows active while new workflows default disabled.
- Material mutations write audit and outbox records through the existing transaction boundary.

## Migrations

1. `20260922120000_p0_5_ux_operational`
   - password reset fields/index and person legal-entity assignment
   - department/location lifecycle status
   - approval workflow lifecycle/effective dates
   - accounting-dimension source
   - payment-run source account
   - bill-line quantity, unit price, and tax
2. `20260922130000_p0_5_entity_status`
   - legal-entity lifecycle status
3. `20260922140000_preserve_existing_workflows`
   - marks workflows predating the lifecycle migration enabled, without enabling newly-created drafts

All 25 repository migrations are applied successfully in the verification database.

## API surface added or completed

- Identity: `forgot-password`, `reset-password`, `change-password`; activation paths on invite/reset-credentials.
- People: detail/update, assign/remove role, suspend, terminate, reset credentials; role detail.
- Payment runs: detail composition projection, add/remove payments, source account, release validation.
- Vendors/bills/payments: vendor update/deactivate; bank detail management; bill DRAFT edit/cancel; cancellable payment action.
- Spend/cards: program update/deactivate; unfreeze and control updates.
- Procurement: expanded match resolution commands and comments.
- Admin configuration: policy create/version/disable/simulate; workflow create/version/enable/disable/preview; accounting-dimension create/update.
- Organization/budgets: safe update/archive and guarded budget update/version behavior.
- Receipts/notifications: ranked receipt candidates and record-specific notification targets.

## UI files and routes added

- Public auth: `apps/web/src/app/activate`, `forgot-password`, `reset-password`.
- Corporate cards: canonical `/app/cards` overview and `/app/cards/[id]` alias over the existing Spend/Card detail controls.
- Bill create: `apps/web/src/app/app/bill-pay/bills/new`.
- People and role detail: `company/people/[id]`, `company/roles/[id]`.
- Accounting dimensions: `company/accounting-dimensions`.
- Receipt picker: `expenses/receipts/[id]`.
- Match exception workspace: `procurement/match-exceptions`.
- Spend-program detail: `spend/programs/[id]`.
- Existing detail/list pages were extended for payment runs, vendors, bills, cards, reimbursements, trips, inbox, notifications, policies, workflows, organizational resources, and budgets.

## External integration gaps intentionally remaining

- Production email delivery for invite/reset links.
- Certified card issuer, payment rail, reimbursement payout, ERP/accounting, OCR/malware scanner, and travel booking/refund providers.
- Provider reconciliation/webhook certification and production secret rotation.

Sandbox copy links and existing mock adapters remain explicit; they do not claim live execution.

## P1/P2 backlog (not started)

- Advanced custom-role authoring beyond existing P0 roles/scopes/entity restrictions.
- Enterprise/provider breadth, native/mobile parity beyond existing stubs, sourcing/RFP/contract breadth, and other features already classified P1/P2 in the verified design.
- No P1/P2 route was enabled or promoted as part of P0.5.

## Changed-file summary

The P0.5 delta is concentrated in:

- `apps/api/prisma/schema.prisma` and the three P0.5 migrations.
- `apps/api/src/application/actions.ts`, `modules/registry.ts`, resource access/router, workflow/search/inbox engines, and focused DB tests.
- `packages/api-client/src/index.ts` for session-expiry handling.
- Web auth routes, new P0.5 detail/admin routes, existing domain pages, `ResourcePage`, navigation/resource configuration, session provider, and `e2e/p0-5-ux.spec.ts`.
- `IMPLEMENTATION_PLAN.md`, this audit, and `P0_5_TEST_REPORT.md`.

The worktree also contains the previously completed P0 closure/GF changes and reports. They were preserved rather than rewritten or reverted.
