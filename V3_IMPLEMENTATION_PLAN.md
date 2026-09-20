# V3 application implementation plan

**Prepared:** 2026-09-16  
**Functional source:** `RAMP_VERIFIED_PRODUCT_DESIGN_V3_OPTIMIZED.md`, especially §§74–100, 106, 125–126  
**Architecture source:** `ON_PREMISES_MODULAR_ARCHITECTURE_GUIDE.md`  
**Scope of this plan:** Turn the current scaffold into a testable financial operations product, then expand to V3 P1 and P2. Section 126 is the priority authority where the document's earlier phase list differs.

## 1. Executive decision

Keep the on-premises TypeScript modular monolith, PostgreSQL, Redis/BullMQ, Next.js web app, and Expo mobile app. Build around the eight shared engines in V3 §125: identity, spend authority, policy, approvals, counterparties, accounting, events/audit, and AI decision support. Deliver complete user journeys one at a time. A route, model, or mock adapter does not count as a finished feature.

The current code is a **prototype scaffold**, not a production-ready P0. There are some working demo actions and a broad schema, but the control and settlement semantics are incomplete. Before additional finance modules, close the authorization, tenant isolation, state transition, audit, and job-delivery gaps below.

## 2. Current system inventory and evidence

| Area | Present today | Gap that affects delivery |
|---|---|---|
| Workspace | pnpm/Turbo monorepo, seven apps, shared packages, Docker Compose | No CI gate or repeatable integration-test environment documented; root `pnpm typecheck` triggered pnpm's interactive modules-purge prompt in this environment. |
| Data | One Prisma schema with organizations, users, spend, cards, AP, procurement, accounting, treasury, AR, specialist objects; one init migration and seed | Broad tables are mostly skeletal. Many object links are string IDs without relational constraints; state fields are free strings. Need additive migrations, tenant-safe foreign keys/uniques, currency and precision rules. |
| API | Express app and 54 generic resource routers in `apps/api/src/modules/registry.ts`; some domain actions in `apps/api/src/application/actions.ts` | The generic router in `apps/api/src/platform/resource-router.ts` gives any authenticated user organization-wide reads and unconstrained creates. The module-specific controllers are largely 501 scaffolds; 49 of 57 module service files are empty. |
| Identity/control | JWT-backed session lookup, seeded roles, simple `assertCan`, policy and workflow prototypes | Permissions/scopes/entitlements are loaded but not enforced on generic routes. `actOnApproval` prevents self-approval but does not resolve/check the step assignee or approval authority. Policy uses hardcoded thresholds. |
| Financial mutations | Demo card auth, transaction clear, expense, bill, payment, procurement, accounting, treasury actions | Multi-record writes and audit/outbox writes are not one DB transaction. Card authorization lacks a complete atomic hold/clear/reversal lifecycle. Payment/transfer actions mark `COMPLETED` before provider settlement; accounting sync marks `SYNCED` before any worker result. |
| Events/workers | Outbox table, queues, worker names | `apps/worker/src/index.ts` marks outbox rows published without dispatching them; queue workers only log jobs, and processors are empty. A successful API response can therefore imply work that never happened. |
| Web | Next.js shell, 86 app pages, design-system components, dashboard read | 32 pages use a generic JSON drawer; forms, filtered queues, stage actions, permissions, and drilldowns are mostly absent. `navigation.ts` is empty while layout has a static nav. Web typecheck currently fails on an unexported `Column` type. |
| Mobile | Expo routes and secure-storage/offline helpers | 22 of 24 TSX route files are placeholder screens. No complete card, receipt, request, approval, or reimbursement journey. |
| Specialist apps | Vendor Portal, Advisor Console, Stack route shells | No separate actor authentication or vendor/firm/client data scope; these are P2 unless a strategy decision moves them earlier. |
| Integrations | Interfaces and mock adapters; local upload implementation | No production issuer/payment/travel/ERP contract or webhook lifecycle. Document ingest labels a new attachment `CLEAN` without a scan. A second unused storage adapter file throws `not implemented`. |
| Tests | Four passing unit assertions across policy/workflow/splits; API, worker, mobile, and specialist apps typecheck | No DB/API security, concurrency, payment, worker, provider, or end-to-end tests. Existing split test duplicates logic instead of exercising the application function. |

**Verification on 2026-09-16:** Direct `tsc` passed for API, worker, mobile, Vendor Portal, Advisor Console, and Stack. Direct web `tsc` failed with four errors originating in `ResourcePage.tsx` (`Column` export and implicit `any` render parameters). Vitest from `apps/api` passed 3 files / 4 tests. No database, provider, or browser end-to-end run was performed.

## 3. Product boundaries and decisions to settle early

1. **First market and operating mode.** Choose the initial country, base currency, legal entity structure, and whether the first release is a sandbox pilot or real-money production. The capability matrix must gate unavailable rails.
2. **Regulated providers.** Select issuer/processor and payment rail partners, their certification path, authorization SLA, reversal/settlement events, and operational ownership. Mock adapters remain available only for deterministic test/demo tenants. No real card or banking claim is made until provider certification is complete.
3. **First ERP and travel provider.** Choose one ERP integration and one travel provider for initial production journeys. Implement provider interfaces and one real adapter at a time; retain export/manual fallback where valid.
4. **P0 release boundary.** Include V3 §126 P0. Ship a company web portal and focused employee/approver mobile flows. Keep tax, disputes, advanced treasury, developer platform, specialist products, Sheets, Router, and Agent Finance behind later milestones.
5. **Security and compliance ownership.** Define data retention, encryption/key custody, attachment scanning, MFA/step-up, incident response, and PCI scope with security/legal/provider partners before production. These decisions may change adapter details, not domain controls.

## 4. Delivery rules

- **One shared control graph:** all money objects carry tenant, entity, owner/actor, counterparty where relevant, spend authority, policy result, approval record, accounting source, and audit/event correlation.
- **No generic finance CRUD in production:** each command has validated input, an explicit permission and data scope, a state transition, idempotency, and audit. Queries use scoped repositories and paginated filters.
- **Separate intent, provider processing, and settlement:** `APPROVED` or `RELEASED` is not `COMPLETED`; only verified provider or reconciliation events complete money movement.
- **Use database transactions for invariants:** commit business state, audit, and outbox atomically. Workers consume with retry, dead-letter, idempotency, and replay.
- **AI recommends, humans/engines decide:** AI may extract or draft; it cannot bypass RBAC, policy, approval, payment release, or card controls.
- **One vertical slice per milestone:** schema/contract → domain service → API → worker/provider → web/mobile → security and workflow tests → operational metrics.
- **Backend owns finance totals:** use Decimal/minor-unit rules and currency-aware aggregates; UI displays server-calculated figures and freshness.

## 5. Target architecture and refactor path

### 5.1 Module ownership

Keep one API process initially. Replace the broad registry with module-owned routes and services gradually, beginning with identity, approvals/policy, spend/cards, expenses, bills/payments, and accounting. Each module exports a small public API from `index.ts`; cross-module calls go through services or typed domain events. Retire `createResourceRouter` for financial resources; it may remain temporarily for low-risk admin data only after explicit policies and validation are added.

### 5.2 Data and command contracts

Add typed status enums/state transition functions for each aggregate; ownership and entity keys for every finance object; foreign keys and composite constraints where practical; a provider-reference table/event inbox; idempotency records scoped by tenant, operation, and request hash; immutable accounting and audit records; and effective-dated policy/workflow versions. Preserve source transaction facts through corrections/reversals rather than overwriting financial history. Migrate existing demo data with explicit backfills and migration tests.

### 5.3 Shared engines

| Engine | First implementation contract |
|---|---|
| Identity and organization | Internal, vendor, and future advisor/agent actor types; active session, additive roles, entity/team/self scopes, delegate context, revocation. |
| Spend authority | Business capacity → budget → program → fund/card, with reservation, capture, reversal, expiry, currency conversion provenance, and concurrent authorization tests. |
| Policy | Versioned deterministic rules, `PASS/WARN/REVIEW/BLOCK`, rule/evidence/reason and override authority; card path uses precompiled low-latency rules. |
| Approval and Inbox | Versioned workflow definition, eligible assignee resolution, serial/parallel steps, reassignment/escalation, self-approval/SOD rules, one cross-product task projection. |
| Counterparty | Vendor identity, payment/tax details stored separately, verification/change approval, normalized links to cards, bills, POs, contracts, and spend. |
| Accounting | Source-normalized queue; `NEEDS_REVIEW → READY_TO_SYNC → SYNCING → SYNCED/ERROR`; immutable source, coding, rules, export/ERP mapping, retry. |
| Events and audit | Transactional outbox, durable delivery/inbox, append-only audit timeline, correlation and provider references, operational replay. |
| AI | Extraction/recommendation contract with model/prompt version, evidence, confidence, sources, human review, permission-scoped tool calls; no automatic financial execution. |

### 5.4 Read models and UX

Use server-side filtered, paginated queues with drilldown and a shared timeline. Build role-aware navigation from a single configuration, and check permissions/entitlements on both server and UI. Use the existing design system for tables, review drawers, status badges, forms, and approval timelines. Create a single Inbox rather than treating notifications as approval tasks.

## 6. Milestones and dependency order

Effort bands below are **planning ranges for a dedicated cross-functional team**, not promises. Re-estimate after provider selection and a one-sprint technical spike. Parallel work is appropriate only after the shared contracts and control rules are stable.

| Milestone | Priority / indicative effort | Work and proof of completion | Depends on |
|---|---|---|---|
| M0. Stabilize build and baseline | Gate / 1 sprint | Fix web typecheck; make `pnpm` checks non-interactive and reproducible; add CI for typecheck, unit, migration, API tests; create disposable Postgres/Redis fixtures; remove or identify 501 routes from public API; establish seeded demo-only accounts. | None |
| M1. Security and data-control foundation | P0 / 2–3 sprints | Replace generic finance writes; permission/action/resource/scope enforcement on every route; tenant/entity-safe queries and link validation; MFA/step-up design; validated contracts; safe document upload/quarantine/scanning; transactional mutation/audit/outbox; idempotency; queue dispatch/retry/dead-letter; status transition tests. | M0 |
| M2. Organization, people, policy, approvals, Inbox | P0 / 2–3 sprints | Entity/department/manager setup; role assignment; versioned policy/workflow builder basics; eligible approver resolution; SOD; unified task queue and timeline; web admin and mobile approval actions. Prove requester cannot approve self and delegated actors cannot gain approval authority. | M1 |
| M3. Spend authority, cards, transactions | P0 / 3–4 sprints plus provider certification | Programs/requests/funds/card issuance; deterministic auth, holds, reversals, clearing, declines, freeze; provider event mapping; capacity/limit/merchant/time controls; audit and reporting projection. Simulate concurrent authorizations and duplicate callbacks; enable real provider only after certification. | M1–M2, issuer decision |
| M4. Expenses, receipts, reimbursements | P0 / 2–3 sprints | Upload/capture, scan/OCR/match, requirements, policy review, splits, expense approval, reimbursement approval/payout states; mobile capture/submission; accounting source handoff. Prove transaction–expense–receipt linkage and amount balance. | M2–M3; document pipeline |
| M5. Vendor 360, AP, payment release | P0 / 3–4 sprints plus rail certification | Vendor onboarding and bank-detail change control; invoice draft/duplicate check; bill lines, approval, scheduling, partial payments, payment runs, separate release, provider processing/settlement/failure, vendor timeline. Reconcile bill balance from settled payments only. | M1–M2, rail decision; M6 accounting interface |
| M6. Universal accounting queue and first ERP | P0 / 2–3 sprints | Card, reimbursement, bill/payment source adapters; coding/dimensions/rules; needs-review/ready/sync/error queues; first ERP adapter or controlled export; idempotent retries and reconciliation. Build API and source model early so M3–M5 can integrate incrementally. | M1, ERP decision; then M3–M5 |
| M7. Procurement and core travel | P0 / 3–4 sprints plus travel provider work | Program → request → approval → outcome; PO, receiving, 2-way/3-way match; vendor link. For travel: profile, policy-before-booking, trip/itinerary, expense context, and first provider search/book/cancel flow when contracted. | M2, M5, provider decision |
| M8. Reporting, budgets, release hardening | P0 / 2–3 sprints | Role-scoped dashboard, budget actual/commitment, source drilldowns, freshness/currency labels, notifications, basic search, reconciliation alerts, backup/restore drill, load/security testing, accessibility QA, pilot feedback. | M3–M7 |
| M9. Enterprise automation and risk | P1 / staged | Draft onboarding; contracts/renewals/sourcing; tax/1099; disputes/repayments; advanced accounting/accrual/amortization; vendor verification; country capability/entitlement maturity; advanced treasury; OAuth/webhooks/developer diagnostics; price/seat intelligence. Each subproject has its own provider and legal gate. | P0 stable |
| M10. Adjacent products | P2 / separate roadmaps | Sheets, Agent Finance, AI Router, managed investments, Advisor Console, Stack, advanced global rails. Promote only if product strategy explicitly changes, as allowed by V3 §126. | Core platform metrics and dedicated business case |

**Critical path:** M0 → M1 → M2 → M3/M4 and M5/M6 → M7 → M8. Provider procurement/certification starts during M0–M1 and can become the release critical path. Core AP and accounting teams can work in parallel after the source/settlement contracts are agreed.

## 7. P0 end-to-end acceptance map

Use V3 §90 journeys and §100 criteria as release tests. Each journey must run against a disposable database with two tenants, multiple entities, more than one role, duplicate requests/events, and failure injection.

| Journey | Required assertions |
|---|---|
| Provision employee | Draft/publish/invite, manager/entity/role scope, activation, revocation; terminated user cannot log in and assigned cards follow freeze policy. |
| Request to card transaction | Program selects approval; correct approvers act; approved request issues only intended fund/card; simultaneous authorizations cannot overspend; clear/reversal preserves audit and budget totals. |
| Expense and reimbursement | Receipt file is scanned and linked; requirements/policy evidence visible; reviewer authority enforced; splits exactly balance; reimbursement payout and accounting state remain independent. |
| Bill to settlement | Duplicate invoice blocked/reviewed; bill approval and payment release use distinct actors; two partial payments never exceed bill balance; failure/retry/provider callbacks do not double-settle; accounting is queued after confirmed events. |
| Procurement | Request begins at intake, not PO; configured approval outcome creates correct fulfillment; receiving and 2/3-way match reveal exceptions and link to bill/vendor. |
| Travel | Out-of-policy selection requests approval before booking; provider confirmation creates trip; cancellation/refund and card/expense links remain traceable. |
| Accounting | Card, reimbursement, and AP rows appear once; coding and ready eligibility enforced; sync error/retry does not duplicate ERP posting; exported/synced status is provider accurate. |
| Reporting and audit | Every metric links to scoped source rows with currency/time/freshness; every critical state change has actor, before/after, correlation, approval/provider reference. |
| Security | Cross-tenant IDs, entity-scoped access, vendor actors, missing permissions, forged/delegated approval, replayed requests, and stale sessions are rejected server-side. |

## 8. Quality, operations, and release gates

- **Tests:** unit tests for money arithmetic and state machines; DB integration tests for tenant/transaction/invariant behavior; contract tests for provider callbacks; API authorization matrix; web/mobile journey tests; concurrency and replay tests for financial writes. Existing tests are a starting point only.
- **Performance:** instrument V3 §96 targets: web shell under 3 seconds on a normal business network, common API reads p95 under 500 ms, explicit issuer-specific card authorization target. OCR/AI/ERP/reporting run asynchronously.
- **Observability:** structured logs with correlation IDs; queue age, dead letters, provider errors, payment mismatch, sync failures, auth declines, and reconciliation dashboards/alerts. Never log secrets, full card data, or tax forms.
- **On-prem operations:** environment validation and secret rotation; TLS; Postgres/NAS backup to physically separate storage; tested restore and RPO/RTO; migration rollback plan; deployment health/readiness checks; documented incident roles.
- **Security and compliance:** threat model and penetration test before live money, file malware scanning, session/device management, least-privilege review, PII retention, provider/PCI boundary review, audit integrity. Legal/regulatory signoff is needed for the chosen market and rails.
- **Pilot:** one design-partner tenant in sandbox first, then a limited live pilot after provider certification. Use feature flags per tenant/country/plan. Roll out one rail and one ERP before broadening.
- **Definition of done:** a feature is done only when its domain invariant, scoped API, UI/mobile job, audit/outbox, error/retry path, tests, metrics, runbook, and acceptance journey pass. A generic table, mock log, or schema model alone is incomplete.

## 9. First two sprints: concrete backlog

### Sprint 1 — make the base trustworthy

1. Fix `@finance/design-system` `Column` export or the web import; run direct and CI typechecks for all apps.
2. Inventory all 54 generic router registrations; classify every route by actor, permission, scope, entitlement, data sensitivity, and write risk. Disable unimplemented/specialist routes and unrestricted create actions by default.
3. Add two-tenant and multi-entity DB fixtures. Write failing tests for cross-tenant IDs, unauthorized reads/creates/actions, and linked-object ownership.
4. Define shared command envelope: actor/delegate, tenant/entity, idempotency key, correlation ID, versioned state, and error contract.
5. Design settlement state machines with provider operations for card authorization, payment, treasury, and ERP sync; document what mock mode may simulate.
6. Establish CI, local test database, migration validation, and a safe seed script that cannot wipe non-demo data.

### Sprint 2 — enforce controls and make events durable

1. Implement resource-level authorization and scoped repositories; migrate the highest-risk routes first: people/roles, cards, bills/payments, treasury, accounting, audit, documents.
2. Make business mutation + audit + outbox one Prisma transaction; dispatch outbox to a durable queue and mark delivered only after acknowledgment. Add replay/dead-letter tests.
3. Implement explicit approver eligibility and SOD checks in the shared workflow; prevent duplicate decisions and invalid state transitions.
4. Validate tenant ownership of every referenced entity/vendor/fund/bill/account and all amounts/currencies; add idempotent command handling.
5. Replace upload's default `CLEAN` status with quarantine → scan → available; enforce size/type and download permission.
6. Deliver one demonstrable vertical slice: employee request → policy → assigned approval → fund/card in sandbox → audit/Inbox, with web forms and one mobile approval screen.

## 10. Planning cadence and ownership

Use a product/engineering/security/provider triage at the start of each milestone, then a two-week delivery cadence. Suggested dedicated functions: product/design, backend/domain, web, mobile, QA automation, DevOps/SRE, and security/compliance; provider integration specialists join the card, payment, ERP, and travel milestones. Maintain a dependency board by **journey and invariant**, not by page count. Review each milestone with finance/AP/accounting operators using realistic exception cases.

Track progress with: acceptance journeys passed, authorization matrix coverage, unprocessed outbox age, unreconciled money items, provider callback lag, accounting sync success, receipt completion, approval latency, and production defects. Feature counts and rendered routes are not release metrics.
