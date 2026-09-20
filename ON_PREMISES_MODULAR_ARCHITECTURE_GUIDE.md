# On-Premises Modular Architecture Guide
## AI-Powered Financial Operations SaaS — Optimized to Verified Product Design V3

**Architecture style:** Modular monolith with extractable bounded contexts  
**Primary source of truth:** `RAMP_VERIFIED_PRODUCT_DESIGN_V3_OPTIMIZED.md`  
**Backend:** Node.js + Express + TypeScript  
**Web:** Next.js + React + TypeScript  
**Mobile:** React Native (Expo) + TypeScript  
**Database:** PostgreSQL  
**Queue / Cache:** Redis + BullMQ  
**Search:** PostgreSQL full-text first; optional later search engine  
**Storage:** Local server storage / NAS  
**Deployment:** On-premises server  
**Reverse proxy:** Nginx or IIS  
**Process management:** PM2 or Docker Compose  
**Status:** Architecture optimized to V3 product, UX, RBAC, AI, and platform scope  
**Date:** 2026-09-15

This document is the **implementation architecture**. The V3 product design remains the functional/UX source of truth. If a UI label, workflow, or feature in this file conflicts with V3, follow V3.

---

# 0. How This Architecture Maps to V3

| V3 product need | Architecture decision |
|---|---|
| One financial operating system, not disconnected tools | Shared control graph, shared engines, event-driven module communication |
| Web + Mobile + Vendor Portal + Advisor Console + Stack | Separate apps, one API, one identity/RBAC model |
| Cards, AP, travel, procurement, treasury, AR, tax, AI | Modular monolith domains with hard boundaries |
| Real-time card authorization | Dedicated low-latency authorization path; AI never decides hard auth |
| Approvals everywhere | One workflow engine |
| Policy across cards, expenses, travel, AP, vendors | One policy engine |
| AI throughout the product | Tool-calling agents behind domain services; deterministic controls override AI |
| Developer platform | OAuth, scopes, signed webhooks, sandbox, OpenAPI on the same API |
| Country / plan / add-on variation | Entitlements + country capability matrix, not hardcoded if-role/if-country checks |
| Regulated money movement | Provider adapters; never fake banking/card rails with an internal ledger only |
| On-premises deployment | No Kubernetes/cloud requirement; keep storage, identity, and queue behind adapters |

---

# 1. Architecture Goals

The architecture must be:

- modular and reusable;
- easy to maintain and test;
- suitable for financial applications;
- secure by default;
- multi-surface (web, mobile, portals, developer API);
- simple enough for on-premises deployment;
- scalable later without rewriting core business modules;
- aligned to the V3 shared control graph.

For the current phase, **do not require**:

- AWS S3
- Terraform
- Kubernetes
- ECS
- Lambda
- CloudFront
- AWS Secrets Manager
- Managed cloud databases
- Microservices

These can be introduced later if required. The code must already sit behind adapters so those changes do not rewrite domain modules.

---

# 2. Non-Negotiable Architecture Invariants

These come from V3 §106 and related domain rules. Treat them as architecture law.

1. **Do not use Purchase Order as the normal procurement intake object.**  
   Flow is Program → Request → Approval → fulfillment (PO / card / fund / vendor / contract).

2. **Do not merge bill approval and payment release.**  
   They are separate control phases, separate permissions, and usually different people.

3. **Do not model one Bill = one Payment.**  
   A bill has 1:N payments, including partial payments.

4. **Do not model Expense as a detached report.**  
   Card transaction + receipt + requirements + policy + review + accounting stay linked.

5. **Do not hard-code one historic navigation set.**  
   Domain state is stable. UI labels and nav are configuration.

6. **Do not assume every payment rail exists for every tenant.**  
   Rails are entitlement + country + provider eligibility.

7. **Do not treat all AI spend limits as hard enforcement.**  
   Provider capabilities differ; store enforcement mode explicitly.

8. **Do not implement regulated banking as an internal ledger only.**  
   Real card/bank/payment movement requires provider-backed infrastructure. The local ledger records our books, not the bank.

9. **Do not let AI bypass RBAC, approval, payment release, card controls, entity scope, or audit.**

10. **Do not compute authoritative finance totals in the frontend.**  
    PostgreSQL / backend services are the calculation source.

11. **Budget, Fund, Business Limit, and Bank Balance are four different objects.**  
    Never collapse them.

12. **Dispute and repayment are separate concepts.**

13. **Agent financial activity never collapses into the human owner's personal activity.**

14. **Feature flags / entitlements gate beta, add-on, and country-specific product.**

---

# 3. Shared Control Graph

Every major financial event must travel the same organizational and control graph:

```text
Person / Team / Entity
        ↓
Vendor / Customer / Counterparty
        ↓
Budget / Spend Authority
        ↓
Policy
        ↓
Approval
        ↓
Payment / Transaction
        ↓
Receipt / Invoice / Contract
        ↓
Accounting
        ↓
Reporting
        ↓
Audit
```

This is why the system is one financial operating system rather than separate card, AP, travel, and procurement products.

Three money phases must remain visible in module design:

```text
BEFORE SPEND          WHILE SPENDING           AFTER SPEND
budgets               physical cards           receipts
spend programs        virtual cards            expense review
spend requests        vendor payments          reimbursements
procurement           travel booking           policy verification
approvals             purchase orders          accounting coding
card/fund limits      banking transfers        reconciliation
policy controls                                reporting / audit
```

---

# 4. Recommended Technology Stack

## Web Portal / Specialized Portals

```text
Next.js
React
TypeScript
TanStack Query
React Hook Form
Zod
Zustand
Tailwind CSS
Shared Design System
```

Use separate Next.js apps for:

- company web portal;
- vendor portal;
- advisor console;
- Stack close/bookkeeping OS.

They share `packages/design-system`, `packages/api-client`, and `packages/contracts`.

## Mobile App

```text
React Native
Expo
TypeScript
TanStack Query
Zod
Secure storage / biometric unlock
Push notifications
Shared API client generated from OpenAPI
```

Mobile is a first-class surface from Phase 3 onward, not a later rewrite.

## Backend

```text
Node.js
Express
TypeScript
PostgreSQL
Prisma ORM
Redis
BullMQ
Zod
JWT + session store
OpenAPI
```

## Storage

```text
Local Server Storage
or
NAS
```

## Deployment

```text
Nginx / IIS
PM2
or
Docker Compose
```

---

# 5. High-Level Runtime Architecture

```text
                         USERS / VENDORS / ADVISORS / DEVELOPERS
                                          │
                                          ↓
                                   NGINX / IIS
                    ┌──────────────┬──────┴──────┬──────────────┐
                    ↓              ↓             ↓              ↓
              NEXT.JS WEB     VENDOR PORTAL   ADVISOR/STACK   MOBILE API
              Company app        app            apps          + Push
                    └──────────────┴──────┬──────┴──────────────┘
                                          ↓
                                    EXPRESS API
                                          │
              ┌───────────────┬───────────┼───────────┬───────────────┐
              ↓               ↓           ↓           ↓               ↓
         DOMAIN MODULES   PLATFORM    INTEGRATIONS  AUTHZ PATH    FILE STORAGE
              │               │           │           │            Local / NAS
              └───────┬───────┴─────┬─────┴───────────┘
                      ↓             ↓
                 PostgreSQL       Redis
                      │             │
                 Outbox/Ledger      │
                                    ↓
                                  BullMQ
                                    │
                                    ↓
                                  WORKER
                 ┌─────────┬────────┼────────┬─────────┐
                 ↓         ↓        ↓        ↓         ↓
                OCR        AI    Email/Push  ERP     Payments
```

Card authorization is part of the same codebase, but it must be a **dedicated in-process path** with its own latency budget. It can be extracted later without changing domain rules.

---

# 6. Product Surfaces and Apps

V3 has more than "web + API".

| Surface | App | Audience | Scope |
|---|---|---|---|
| Company Web Portal | `apps/web` | Finance, AP, procurement, treasury, admin, managers | Full product |
| Mobile App | `apps/mobile` | Employees, managers, travelers, executives | Action + approval; not full admin config |
| Vendor Portal | `apps/vendor-portal` | External vendors | Payment/tax details, bills, comments, documents |
| Advisor Console | `apps/advisor-console` | Accounting firms / partners | Multi-client staff, reporting, close projects |
| Stack | `apps/stack` | Bookkeeping OS users | Close, reconciliations, skills, statements |
| Developer Platform | same API + `apps/web` developer pages | Integrators | OAuth, webhooks, sandbox, logs |
| Sheets | `apps/web` feature or `apps/sheets` later | Finance modelers | AI spreadsheet workspace |

All surfaces authenticate against the same identity platform. Actor types differ:

```text
INTERNAL_USER
VENDOR_USER
ADVISOR_USER
OAUTH_APP
AI_AGENT_IDENTITY
```

RBAC, entitlements, and audit must understand actor type. An AI agent identity is not a human employee.

---

# 7. Architecture Style

Use a **modular monolith**.

Do not start with microservices.

The application is still divided into clear business modules that can later be extracted if load, regulation, or team topology requires it.

Extract later only if needed:

```text
Card Authorization Path
Payment Rail Workers
OCR / Document Pipeline
AI Router Gateway
Search Indexer
```

All modules run inside the same backend application initially.

This gives:

```text
Simple On-Prem Deployment
+
Strong Transactions
+
Reusable Shared Engines
+
Clear Bounded Contexts
+
Easy Future Scaling
```

---

# 8. Recommended Repository Structure

```text
finance-platform/
│
├── apps/
│   ├── api/
│   ├── worker/
│   ├── web/
│   ├── mobile/
│   ├── vendor-portal/
│   ├── advisor-console/
│   └── stack/
│
├── packages/
│   ├── contracts/          # Zod + OpenAPI source
│   ├── api-client/         # generated TS client
│   ├── config/
│   ├── logger/
│   ├── design-system/
│   ├── money/              # shared Money type
│   ├── permissions/        # permission constants shared by web/mobile/api
│   └── feature-flags/
│
├── scripts/
│   ├── backup-db.sh
│   ├── backup-files.sh
│   └── deploy.sh
│
├── docs/
│   ├── architecture/
│   └── runbooks/
│
├── docker/
│
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── package.json
```

Recommended workspace:

```text
pnpm
+
Turborepo
```

---

# 9. Backend Folder Structure

```text
apps/api/src/
│
├── app/
│   ├── app.ts
│   ├── server.ts
│   ├── routes.ts
│   └── bootstrap.ts
│
├── modules/
├── engines/                 # shared policy / workflow / search / documents
├── platform/
├── integrations/
├── database/
├── config/
├── shared/
└── tests/
```

`engines/` is not a dumping ground. Only cross-module control systems live there.

---

# 10. Backend Business Modules

Align modules to V3 §97. Do not invent a parallel module map.

```text
modules/
│
├── identity/
├── organizations/
├── entities/
├── people/                     # includes draft-user onboarding
├── rbac/
│
├── policies/
├── approvals/
├── budgets/
├── entitlements/               # plans, add-ons, feature flags
├── country-capabilities/
│
├── cards/
├── funds/
├── spend-programs/
├── spend-requests/
├── authorizations/             # real-time card auth decisioning
├── transactions/
├── disputes/
├── repayments/
│
├── expenses/
├── receipts/
├── reimbursements/
│
├── procurement/
├── purchase-orders/
├── receiving/
├── vendors/
├── contracts/
├── renewals/
├── sourcing/
├── price-intelligence/
├── license-intelligence/
│
├── bills/
├── payments/
├── payment-runs/
│
├── travel/
│
├── banking/
├── treasury/
│
├── accounting/
├── reconciliation/
├── erp-sync/
│
├── customers/
├── invoices/
├── collections/
├── cash-application/
│
├── rewards/
├── tax-operations/             # 1099 / W-9 / TIN
│
├── ai-token-spend/
├── router/
├── agent-finance/              # Ramp-for-Agents identities
├── sheets/                     # financial modeling workspace
│
├── reporting/
├── search/
├── documents/                  # OCR, affidavits, attachments
├── notifications/
├── integrations/
├── developer-platform/         # OAuth apps, webhooks, sandbox
├── audit/
└── ai/                         # orchestrator, agents, guardrails
```

Specialized bounded contexts, same database initially, separate apps:

```text
Vendor Portal
Advisor Console
Stack
```

They reuse People, Accounting, Reporting, Documents, and Audit. They must not own a second vendor/bill/accounting model.

---

# 11. Standard Backend Module Structure

Every module uses the same structure.

Example:

```text
modules/expenses/
│
├── api/
│   ├── expense.controller.ts
│   ├── expense.routes.ts
│   ├── expense.schema.ts
│   └── expense.presenter.ts
│
├── application/
│   ├── commands/
│   ├── queries/
│   └── services/
│
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── policies/
│   ├── events/
│   ├── state-machine.ts
│   └── repositories/
│
├── infrastructure/
│   ├── repositories/
│   ├── mappers/
│   └── adapters/
│
├── tests/
│   ├── unit/
│   └── integration/
│
└── index.ts
```

Public module API is `index.ts` only. Other modules import the public API, never internal folders.

---

# 12. Backend Layer Responsibilities

## API Layer

Responsible for:

- HTTP requests
- request validation
- authentication context
- response formatting
- status codes
- idempotency-key intake

The API layer must not contain business logic.

```text
Controller
→ Validate
→ Authorize
→ Call Use Case
→ Return Response
```

## Application Layer

Contains use cases.

Examples:

```text
ApproveExpense
IssueVirtualCard
CreateSpendRequest
ScheduleBillPayment
ReleasePayment
AuthorizeCardPresentment
CreateDispute
PublishDraftUser
ReleaseTransfer
```

Responsibilities:

- orchestration
- authorization
- transaction boundary
- calling domain services
- saving data
- writing outbox events
- writing audit records

## Domain Layer

Contains business rules.

Examples:

```text
Fund.canSpend()
Expense.approve()
Bill.canSchedulePayment()
Budget.reserve()
PaymentRun.canRelease()
Dispute.isEligible()
AgentIdentity.canPay()
```

The domain must not depend on:

- Express
- Prisma
- PostgreSQL
- Redis
- OpenAI / other providers

## Infrastructure Layer

Contains technical implementations:

- PostgreSQL repositories
- Redis
- local storage
- external APIs
- AI providers
- email / push / Slack providers
- card issuer / payment rail / ERP adapters

---

# 13. Dependency Rule

Correct dependency direction:

```text
API
 ↓
Application
 ↓
Domain
```

Infrastructure implements interfaces defined by the application/domain.

Avoid:

```text
Domain → Express
Domain → Prisma
Domain → OpenAI
Expenses → Bills internals
Cards → Accounting internals
```

Cross-module communication:

```text
Synchronous: public application service of the owning module
Asynchronous: domain event via outbox
Never: reach into another module's tables from application code
```

Reporting/search may read replica-friendly projections, not mutate another module's aggregates.

---

# 14. Shared Platform Layer

```text
platform/
│
├── auth/
├── rbac/
├── database/
├── events/
├── queue/
├── cache/
├── storage/
├── email/
├── push/
├── observability/
├── idempotency/
├── encryption/
├── secrets/
├── rate-limit/
├── pagination/
└── feature-flags/
```

Avoid one huge `utils` folder.

---

# 15. Shared Engines

These are not ordinary business modules. Ordinary modules consume them.

```text
engines/
│
├── policy/          # PASS / WARN / REVIEW / BLOCK
├── workflow/        # approvals, SLAs, escalation, delegation
├── documents/       # ingest, OCR, classification, malware scan
├── search/          # traditional + authorized NL search
└── ledger/          # immutable money movement journal
```

## Policy engine

Used by card authorization, expenses, reimbursements, travel, procurement, bill pay, vendor, accounting.

Result contract:

```text
PASS
WARN
REVIEW
BLOCK
+ rule
+ explanation
+ evidence
+ required action
```

## Workflow engine

Objects:

- spend request
- expense
- reimbursement
- procurement request
- PO
- vendor change
- bill
- payment
- transfer
- contract
- invoice exception
- dispute (internal review steps)

A requester cannot satisfy their own approval step.

## Document engine

Shared by receipts, invoices, contracts, tax forms, dispute evidence, travel documents.

---

# 16. Shared Kernel

```text
shared/
│
├── errors/
├── types/
├── constants/
├── money/
├── date-time/
├── result/
├── identifiers/
└── country/
```

Only generic primitives live here.

Business rules remain inside their modules.

---

# 17. Shared Object Model

Core persistable entities from V3 §74, plus V3 additions that the original architecture omitted:

```text
Organization
Workspace
LegalEntity
CountryCapability
User
EmploymentProfile
DraftUser
Role
Permission
Entitlement
Department
Location
ManagerHierarchy
Delegation

BankAccount
BusinessLimit
Budget
SpendProgram
Fund
Card
CardAuthorization
Transaction
DisputeCase
Repayment

Expense
Receipt
Reimbursement
TravelTrip
TravelBooking

Vendor
VendorBankAccount
VendorUser
PurchaseRequest
ApprovalWorkflow
ApprovalStep
PurchaseOrder
ReceivingRecord
Contract
Renewal

Bill
BillLine
Payment
PaymentRun

AccountingEntry
AccountingDimension
AccountingRule
SyncJob
AmortizationSchedule
Accrual

Customer
Invoice
IncomingPayment
CashApplication

Policy
PolicyRule

IntegrationConnection
OAuthApp
WebhookEndpoint
WebhookDelivery
Notification
Comment
Attachment
AuditEvent

AIConversation
AIDecision
AIRecommendation
AgentRun
AgentIdentity
Workbook
TaxForm
RewardLedger
```

Do not create a second copy of Vendor, Bill, or Transaction inside portals or Stack.

---

# 18. PostgreSQL Database Design

PostgreSQL is the primary source of truth.

Use:

```text
UUID
TIMESTAMPTZ
NUMERIC / DECIMAL
Foreign Keys
Unique Constraints
Check Constraints
Indexes
Partial Indexes
Exclusion constraints where needed for date-bounded uniqueness
```

Avoid JSON for core relational business data.

JSON is acceptable only for:

- provider raw payloads;
- workflow node graphs;
- spreadsheet workbook snapshots;
- extensible evidence packs;

and even then a typed envelope plus version must exist.

---

# 19. Tenant, Entity, and Country Isolation

Every tenant-owned table includes:

```text
organization_id
```

Financial objects normally also contain:

```text
legal_entity_id
source_currency
```

Every query must be organization-scoped. Sensitive writes must also be entity-scoped.

User access may be:

```text
one entity
selected entities
entire organization
```

Cross-entity dashboards require currency normalization in the backend.

## Country capability matrix

Do not hard-code "US can do X, UK can do Y" in module code.

Store versioned, effective-dated capabilities:

```text
cards_supported
reimbursement_to_local_bank_supported
bill_pay_supported
bill_pay_local_rails[]
swift_supported
tax_capture_supported
travel_supported
statement_payment_supported
provider_constraints
plan_required
effective_from / effective_to
```

Payment methods, reimbursement rails, tax features, and card products are resolved through this matrix + entitlements + provider eligibility.

---

# 20. Entitlements and Feature Flags

UI visibility and backend authorization both use entitlements.

```text
Plan
Feature
Entitlement
Subscription
Trial
AddOn
UsageLimit
FeatureFlag
```

Do not scatter plan-name checks:

```text
if (plan === "enterprise") allow
```

Correct:

```text
entitlements.can(organization, "payment_release")
featureFlags.isEnabled(organization, "travel.employee_rewards")
```

Beta / alpha / add-on / video-only items from V3 stay behind flags until verified for that tenant.

---

# 21. Money Handling

Never use JavaScript floating-point values for financial calculations.

Use:

```text
PostgreSQL NUMERIC
+
Decimal library
+
shared Money value object
```

```text
Money {
  amount      # string/decimal, never number
  currency
}
```

API example:

```json
{
  "amount": "1250.50",
  "currency": "USD"
}
```

## Multi-currency

Store:

```text
source_currency
source_amount
settlement_currency
settlement_amount
fx_rate
fx_rate_source
reporting_currency_amount
```

Never overwrite the original transaction currency.

---

# 22. Budget vs Fund vs Business Limit vs Bank Balance

Keep these separate in schema and services.

| Object | Meaning |
|---|---|
| Bank Balance | Actual money in company bank accounts, provider-backed |
| Business Limit | Company-wide card/credit exposure capacity |
| Budget | Planning and management target |
| Fund / Spend Limit | Actual employee, vendor, or agent spending permission |

Example:

```text
Bank Balance      = 500000.00 USD
Business Limit    = 200000.00 USD
Marketing Budget  = 100000.00 USD
Ali Ad Fund       = 15000.00 USD / month
```

A card spend check uses Fund + Business Limit + policy + merchant controls. Budget is management; it may warn or block only if policy says so.

---

# 23. Database Transactions

Any operation that updates multiple financial records must run inside a database transaction.

Example:

```text
Approve Spend Request
        ↓
Update Request
        ↓
Create Fund
        ↓
Reserve Budget
        ↓
Create Audit Event
        ↓
Create Outbox Event
        ↓
COMMIT
```

Either everything succeeds or everything fails.

---

# 24. Financial Concurrency

Balance-changing operations must be atomic.

Do not:

```text
Read balance
→ calculate in Node.js
→ update balance
```

Use an atomic database operation, row locks, or serializable transaction as appropriate.

```sql
UPDATE funds
SET available_amount = available_amount - :amount
WHERE id = :id
AND organization_id = :organization_id
AND available_amount >= :amount;
```

Card authorization, payment release, fund edits, and reimbursement payouts all follow this rule.

---

# 25. Idempotency

Critical financial APIs must support idempotency keys.

Required at minimum:

- payment creation
- payment release
- bank transfer
- card authorization
- reimbursement payout
- dispute submission
- webhook processing
- ERP sync posting
- OAuth-app financial writes

Use:

```text
Idempotency-Key
```

Store request hash, response, and expiry. Repeated requests must not create duplicate financial records.

---

# 26. Immutable Financial Ledger

For money movement, maintain an immutable ledger.

```text
ledger_accounts
ledger_transactions
ledger_entries
```

Do not overwrite financial history.

Balances may be cached for performance. Ledger entries remain the historical source of truth.

The ledger is **our books**. Provider statements remain the external source for actual bank/card movement. Reconciliation jobs bind the two.

---

# 27. Deterministic State Machines

Every money or control object has an explicit state machine in the domain layer.

Examples:

```text
SpendRequest:    draft → submitted → in_review → approved | rejected | cancelled
Expense:         incomplete → submitted → in_review → approved | rejected
Bill:            draft → needs_info → pending_approval → approved → ready_for_payment → paid | cancelled
Payment:         scheduled → releasing → submitted → completed | failed | cancelled
Accounting:      needs_review → ready_to_sync → synced | sync_error
Dispute:         eligible → evidence → submitted → provisional_credit → won | lost | cancelled
DraftUser:       draft → published/invited → active → suspended | terminated
```

Illegal transitions throw domain errors. Controllers never set status strings directly.

"Ready" and "Synced" are different accounting states. Do not collapse them.

---

# 28. Event-Driven Internal Architecture

Modules communicate through events where possible.

The owning module writes an outbox event in the same database transaction as the business change. It does not directly call every downstream module.

Example:

```text
transaction.cleared
```

Consumers:

```text
Expenses
Budgets
Accounting
Reporting
Notifications
Vendor Spend
Search
AI
```

---

# 29. Transactional Outbox

```text
Database Transaction
        ↓
Business Change
+
Outbox Event
        ↓
Commit
        ↓
Worker Reads Outbox
        ↓
Publish Event
```

Table:

```text
outbox_events
```

Failed handlers go to a dead-letter table with retry count, last error, and replay support.

---

# 30. Canonical Domain Events

Minimum event catalog from V3 §98, plus omitted V3 domains:

```text
user.created
user.published
user.terminated
card.issued
card.frozen
card.terminated
fund.created
fund.limit_changed
transaction.authorized
transaction.cleared
transaction.declined
receipt.matched
expense.submitted
expense.approved
request.submitted
request.approved
bill.created
bill.approved
payment.scheduled
payment.released
payment.completed
payment.failed
vendor.bank_changed
po.created
receiving.recorded
contract.renewal_due
transfer.created
transfer.completed
accounting.ready
accounting.synced
invoice.sent
invoice.paid
dispute.opened
dispute.resolved
repayment.requested
repayment.completed
agent.payment.requested
tax.form.filed
```

Subscribers:

- notifications
- reporting
- audit
- accounting
- budgets
- vendor 360 projections
- AI
- integrations / developer webhooks

---

# 31. Core Synchronization Rules

These are architecture, not optional product ideas.

### Cleared card transaction

```text
Transaction Cleared
→ Expense Record Updated
→ Fund Availability Updated
→ Budget Actual Updated
→ Vendor Spend Updated
→ Accounting Queue Updated
→ Reporting Updated
→ Audit Written
```

### Employee terminated

```text
HRIS Termination / Admin Terminate
→ User Status Disabled
→ Login Revoked
→ Cards Frozen/Terminated per Policy
→ Spend Programs Removed
→ Pending Approvals Reassigned
→ Audit Written
```

### Bill paid

```text
Payment Completed
→ Bill Balance Reduced
→ AP Aging Updated
→ Cash Balance/Forecast Updated
→ Vendor Payment History Updated
→ Accounting Sync Updated
→ Reporting Updated
```

### Vendor bank details changed

```text
Bank Change
→ Verification Workflow
→ Separation-of-duties Flag
→ Hold High-Value Payments if Policy Requires
→ Audit Written
```

---

# 32. Redis and BullMQ

Redis is used even on-premises for:

- BullMQ
- temporary cache
- rate limiting
- sessions
- distributed locks
- idempotency short-cache

Queues:

```text
notifications
documents
ocr
integrations
accounting-sync
payments
reporting
ai
webhooks
search-index
tax
travel
sheets
disputes
```

Card authorization is **not** a BullMQ job. It is synchronous and low-latency.

OCR, AI, ERP sync, exports, imports, large reports, and document analysis are asynchronous.

---

# 33. Worker Architecture

Run a separate worker process.

```text
Express API
    ↓
Create Job / Outbox
    ↓
Redis / BullMQ
    ↓
Worker
```

Worker responsibilities:

- OCR and document classification
- AI processing
- email / push / Slack / Teams
- ERP sync
- reports and exports
- invoice processing
- webhook delivery
- scheduled jobs
- search indexing
- tax filing jobs
- receipt matching
- reconciliation

Workers must be retry-safe and idempotent.

---

# 34. Card Authorization Architecture

This is a Tier A path.

```text
Card Swipe / Online Charge
        ↓
Card Active?
        ↓
User / Agent Active?
        ↓
Business Capacity Available?
        ↓
Eligible Fund?
        ↓
Fund Balance Available?
        ↓
Fund Date Valid?
        ↓
Merchant Allowed?
        ↓
Merchant Category Allowed?
        ↓
Per-Transaction Limit?
        ↓
Velocity / Risk Controls?
        ↓
Policy Engine (hard BLOCK only)
        ↓
Approve / Decline
```

Rules:

- deterministic;
- concurrency-safe;
- idempotent on network/provider retry;
- no AI in the hard decision;
- no ERP, OCR, or reporting calls on the hot path;
- result stored as `CardAuthorization` then projected to `Transaction`.

Physical card and virtual card share the authorization engine. Virtual cards add merchant lock, single-purpose, and request/program linkage.

A card is not an employee bank account.

---

# 35. Local File Storage

Use local disk or NAS instead of S3 for now.

```text
/data/finance-app/
│
├── uploads/
│   ├── receipts/
│   ├── invoices/
│   ├── contracts/
│   ├── attachments/
│   ├── tax-forms/
│   ├── dispute-evidence/
│   ├── workbooks/
│   └── profile-images/
│
├── exports/
├── temp/
└── backups/
```

Do not store production uploads inside the source tree.

Scan uploads for malware before they become available to other users.

---

# 36. File Metadata

Store file metadata in PostgreSQL.

```text
attachments

id
organization_id
legal_entity_id
original_name
stored_name
mime_type
size
checksum
storage_provider
storage_path
classification
malware_scan_status
created_by
created_at
```

Example:

```text
storage_provider = LOCAL
storage_path = receipts/2026/09/abc123.pdf
```

---

# 37. Storage Adapter

Do not call filesystem APIs directly from business modules.

```ts
interface FileStorage {
  upload(file): Promise<StoredFile>;
  get(id): Promise<Buffer>;
  delete(id): Promise<void>;
}
```

Current:

```text
FileStorage → LocalStorageAdapter
```

Future:

```text
FileStorage
├── LocalStorageAdapter
├── NASStorageAdapter
├── S3StorageAdapter
└── AzureBlobAdapter
```

---

# 38. Integration Adapter Pattern

External providers remain behind interfaces.

```text
Domain Module
    ↓
Normalized Integration Interface
    ↓
Provider Adapter
    ↓
External System
```

## Adapter families

```text
AccountingProvider
HRISProvider
IdentityProvider
BankDataProvider
PaymentRailProvider
CardIssuerProcessor
TravelProvider
EmailProvider
CollaborationProvider
ContractProvider
ESignProvider
AIUsageProvider
LLMProvider
DataExportProvider
TaxFilingProvider
SanctionsScreeningProvider
```

Include `MockAdapter` for every family so on-prem development and tests can run without live vendors.

## Synchronization model

```text
Connection
→ Incremental Cursor / Webhook
→ Raw Provider Event
→ Validate
→ Normalize
→ Idempotent Upsert
→ Domain Event
→ Downstream Consumers
```

Store:

- external ID
- connection ID
- sync cursor
- provider timestamps
- normalization version
- last successful sync
- error
- retry count

Provider timeouts and circuit breakers are required. Sync health is a first-class operational signal.

---

# 39. AI Architecture

AI is an embedded intelligence layer, not a replacement for deterministic finance controls.

## Placement

```text
User / Event
    ↓
Agent Orchestrator
    ↓
Permission + Scope + Entitlement Context
    ↓
Approved Tools
    ↓
Domain Services
    ↓
Audit + AI Governance Record
```

Agents do not receive unrestricted database access.

## Agent families

Keep agents as folders under `modules/ai/agents`, calling domain tools:

```text
policy-agent
accounting-agent
ap-agent
procurement-agent
contract-agent
reporting-agent
collections-agent
inbox-agent
```

## Recommendation contract

Every material recommendation includes:

```text
recommendation
confidence
evidence
source objects
policy/rule references
human review required?
```

## Deterministic controls override AI

AI cannot override:

- RBAC
- approval authority
- payment release policy
- card spend controls
- hard policy blocks
- entity scope
- audit requirements

AI may extract, classify, recommend, summarize, draft, and suggest.

AI must not silently:

- release money
- change vendor bank account
- grant admin permissions
- override security
- bypass approval workflows

## Router

Router is a separate product capability, not just an internal LLM helper.

```text
Application
→ Router-compatible endpoint
→ Routing strategy
→ Provider / Model
```

Requirements:

- OpenAI-compatible API shape where practical
- multi-provider/model access
- request-level usage/cost logging
- latency
- fallback
- cost/quality/availability rules

Advanced strategies (flex-tier, shadow traffic, difficulty routing) are later phases.

## AI Token Spend

Treat provider/model/user/API-key usage as a spend domain:

- connections
- sync
- attribution
- limits
- anomalies
- relationship to normal vendor spend

Enforcement mode is stored explicitly because providers differ.

## Agent Finance

`modules/agent-finance` owns durable AI-agent identities:

```text
Agent Identity
Human Owner
Purpose
Budget
Policy
Merchant Restrictions
Allowed Payment Rails
Approval Rules
Audit Trail
```

Every rail still passes policy, approval, vendor verification, risk, accounting, and audit.

## Sheets

Sheets is a separate workspace, not a hidden table inside Spend.

AI spreadsheet edits must be planned, validated, reversible, and must not assume Google-Sheets-style realtime collaboration unless that flag is enabled.

## Stack

Stack is a specialized accounting OS surface. It reuses Accounting, Reconciliation, Documents, and Reporting. It is not "the accounting agent with a new name."

## AI governance

Every production AI call stores:

```text
Agent / Model
Model Version
Prompt / Skill Version
Input Sources
Tool Calls
Confidence
Human Override
Cost
Latency
Evaluation Result
Rollback Version
```

Redact secrets/PII before provider calls where appropriate.

---

# 40. Authentication

Support:

```text
Email / Password
JWT + server session
MFA
SSO / OIDC / SAML
SCIM
Device / session management
Step-up authentication for high-risk actions
```

Request context:

```text
actorType
userId | oauthAppId | agentId
organizationId
entityIds
roles
permissions
entitlements
sessionId
correlationId
actingAsUserId          # delegation
```

High-risk actions requiring step-up:

- payment release
- vendor bank change
- role elevation
- treasury transfer release
- card PAN/account reveal where allowed
- tax filing submit

---

# 41. RBAC

Use centralized authorization.

```text
authorization.can(
  actor,
  "expense.approve",
  expense
)
```

Never:

```text
if (role === "admin") allow
```

Permission model:

```text
Permission =
Role
+ Action
+ Resource
+ Scope
+ Approval Authority
+ Delegation
+ Entity Access
+ Entitlement
+ Explicit Restriction
```

Permission constants live in `packages/permissions` and are shared by API, web, and mobile. Frontend `Can` components are UX only. Backend is the final authority.

---

# 42. Permission Scopes

```text
SELF
ASSIGNED
DIRECT_REPORTS
TEAM
DEPARTMENT
LOCATION
ENTITY
MULTI_ENTITY
ORGANIZATION
VENDOR_SCOPED
CUSTOM_SCOPE
```

Example:

```text
expense.approve
scope = DIRECT_REPORTS
```

Vendor Portal and Advisor Console have their own actor scopes. A vendor user sees only that vendor. An advisor user sees only assigned client organizations.

---

# 43. Approval Authority

Approval is more than RBAC.

```text
object_type
max_amount
currency
entity_scope
department_scope
vendor_scope
category_scope
```

Example:

```text
Engineering VP
Can approve: Spend Requests
Department: Engineering
Maximum Amount: 25000.00 USD
```

---

# 44. Separation of Duties

High-risk flows must support SoD in the workflow engine and authorization layer.

| Flow | Rule |
|---|---|
| Vendor bank details | Changer is not the sole high-value payment approver |
| Bill payments | Creator ≠ final payment releaser when policy requires |
| Treasury transfer | Creator → Approver → Release |
| Role elevation | User cannot silently grant Owner-level permissions |
| Spend request | Requester cannot satisfy their own step |
| Accounting override | Logged; optionally Controller approval |

SoD is configuration per organization, with safe defaults for finance tenants.

---

# 45. Developer Platform

Same Express API, separate auth audience.

```text
OAuth apps
Granular scopes
Client credentials
Authorization code
Sandbox tenants
OpenAPI
Cursor pagination
Idempotency
Rate limits
Trace IDs
Signed webhooks
Delivery history
Replay
Developer logs
```

Example scopes:

```text
transactions:read
bills:read
bills:write
users:read
vendors:read
accounting:read
```

Webhook flow:

```text
Create Endpoint
→ Select Events
→ Signing Secret
→ Deliver
→ Verify Signature
→ Retry
→ Delivery History
→ Replay
```

OAuth financial writes use the same domain services as the web app. They do not bypass policy or approval.

---

# 46. API Design

Use versioned REST:

```text
/api/v1/...
```

Examples:

```text
GET    /api/v1/expenses
GET    /api/v1/expenses/:id
POST   /api/v1/expenses
PATCH  /api/v1/expenses/:id
POST   /api/v1/expenses/:id/approve
POST   /api/v1/expenses/:id/reject
```

Use explicit action endpoints for business operations.

Surface-specific route prefixes are acceptable:

```text
/api/v1/app/...
/api/v1/vendor-portal/...
/api/v1/advisor/...
/api/v1/mobile/...
```

They still call the same domain services.

---

# 47. API Response Standard

Success:

```json
{
  "data": {},
  "meta": {
    "requestId": "...",
    "pagination": {}
  }
}
```

Error:

```json
{
  "error": {
    "code": "EXPENSE_POLICY_BLOCK",
    "message": "Expense requires finance review.",
    "details": {},
    "requestId": "..."
  }
}
```

Every response includes `requestId` / trace ID.

---

# 48. Validation

Use Zod in `packages/contracts`.

```text
CreateExpenseSchema
UpdateExpenseSchema
ApproveExpenseSchema
ExpenseFilterSchema
```

The same schemas generate OpenAPI and the TypeScript API client used by web, mobile, and portals.

---

# 49. OpenAPI and Shared API Client

```text
packages/contracts
        ↓
OpenAPI
        ↓
Generated API Client
        ↓
Web / Mobile / Vendor Portal / Advisor / Stack
```

Do not hand-duplicate API types.

---

# 50. Web Frontend Architecture

```text
apps/web/src/
│
├── app/                     # Next.js routes, aligned to V3 §92
├── features/
├── design-system/
├── components/
├── hooks/
├── lib/
├── stores/
├── providers/
├── config/                  # nav labels, flags
└── tests/
```

## Feature folders

```text
features/expenses/
│
├── api/
├── components/
├── forms/
├── hooks/
├── schemas/
├── types/
├── utils/
└── index.ts
```

Apply the same pattern to every V3 domain the web portal exposes.

Navigation is permission + entitlement + country-capability aware. Do not hard-code demo-era labels into the data model. Keep a UI-label configuration layer if visual replica fidelity is required.

Specialized portals (`vendor-portal`, `advisor-console`, `stack`) are separate apps with smaller feature sets and the same design system.

---

# 51. Recommended Web Routes

Follow V3 §92. Do not invent a second information architecture.

```text
/app
  /home
  /inbox
  /search
  /me/...
  /spend/...
  /expenses/...
  /procurement/...
  /vendors
  /bill-pay/...
  /travel/...
  /accounting/...
  /banking/...
  /insights/...
  /receivables/...
  /ai/...
  /company/...
  /developer/...
  /tax/...
  /disputes/...

/vendor-portal
/advisor-console
/stack
```

Actual menu visibility is entitlement + RBAC driven.

---

# 52. Frontend State, Forms, and Permissions

Server state: TanStack Query.

Zustand only for UI/local state:

- sidebar
- selected workspace / entity
- temporary flow state

Do not duplicate server data in Zustand.

Forms: React Hook Form + Zod.

Reusable fields:

```text
MoneyField
UserSelect
VendorSelect
EntitySelect
DateField
AccountingDimensionSelect
```

Permission UX:

```tsx
<Can permission="expense.approve">
  <ApproveButton />
</Can>
```

Backend remains the final authority.

---

# 53. Design System and UX Patterns

Use a dense, table-first enterprise finance system, not a marketing dashboard.

Required patterns:

```text
DataTable          server filter/sort, cursor pagination, saved views,
                   column visibility, bulk actions, export, row selection
PageHeader
FilterBar
StatusBadge
ApprovalTimeline
AuditTimeline
DocumentViewer
EmptyState
DrawerReview       Inbox, Expenses, Accounting Queue, Bill Approvals
```

Detail page layout:

```text
Page Header
├── Status
├── Main Actions
└── Metadata

Main Content
├── Details
├── Documents
├── Accounting
└── Related Records

Right Sidebar
├── Approval Timeline
├── Comments
└── Activity
```

Drawer pattern:

```text
Table → Row click → Right drawer → Review → Approve/Reject → Next item
```

Every page supports loading, empty, partial data, permission denied, integration disconnected, sync delayed, failed, and retry.

Dashboards never aggregate in the browser:

```text
GET /api/v1/dashboard/spend-summary
```

Accounting UX must support source selector, status tabs, inline coding, Ready vs Synced, and rules counters. That is a platform pattern, not a one-off page.

---

# 54. Mobile Architecture

Mobile is the employee action and approval surface.

Primary jobs:

- funds and cards
- freeze/unfreeze
- receipt capture
- expenses
- spend requests
- reimbursements
- approvals
- travel
- notifications
- Ask AI

Complex configuration stays web-based.

```text
apps/mobile/
├── app/                 # Expo Router, aligned to V3 §93
├── features/
├── lib/
└── tests/
```

Routes:

```text
/(tabs)
  /home
  /cards
  /expenses
  /approvals
  /more
```

## Mobile security

- certificate pinning where practical;
- biometric unlock;
- secure token storage;
- remote session revoke;
- no PAN/full account numbers on device;
- step-up for freeze if policy requires.

## Offline / poor network

Safe temporary capture only:

- receipt photos
- draft reimbursement
- draft memo

Financial approvals and card changes require online confirmation.

Push notifications are a worker-delivered channel, not a second business-logic path.

---

# 55. Search and Command Layer

Global search supports:

### Traditional

```text
OpenAI
INV-10034
John Smith
4500.00
```

### Natural language

```text
Show OpenAI spend this year
Bills due next week
Expenses missing receipts
```

AI search returns only objects the actor is authorized to see. Search indexing is a worker projection, not a live unscoped query across all tables.

---

# 56. Notification System

Event-driven.

Channels:

- web in-app
- mobile push
- email
- Slack
- Teams

Example events:

```text
expense.receipt_missing
expense.approval_requested
request.approved
bill.approval_requested
payment.failed
budget.threshold_reached
contract.renewal_due
card.declined
security.login_risk
```

Notification content is generated from events. Modules do not send raw emails from domain code.

---

# 57. File Upload Flow

```text
Client
    ↓
Upload API
    ↓
Malware scan
    ↓
Local/NAS Storage
    ↓
Attachment Record
    ↓
Queue OCR / matching if required
```

On-premises, uploading through the backend is acceptable if file sizes are controlled.

Later signed uploads can be added behind the same storage adapter.

---

# 58. Realtime Updates

Use WebSocket/SSE only where useful:

- inbox / approval count
- payment status
- OCR completion
- AI completion
- accounting sync completion

Do not make every screen realtime.

---

# 59. Logging, Metrics, and Traces

Structured JSON logs:

```text
timestamp
level
requestId
correlationId
organizationId
actorType
userId
module
operation
duration
error
```

Never log:

- passwords
- full card details
- JWTs
- bank credentials
- API secrets
- raw tax identifiers unless masked

Observability also includes:

- metrics
- traces / correlation IDs
- queue health
- sync health
- webhook delivery health
- payment/reconciliation alerts
- AI latency/cost/failure
- provider status

---

# 60. Audit Log

Audit is different from application logs and is immutable.

Every critical mutation stores:

```text
actor
acting-as / delegated user
AI agent ID if AI initiated
object
object ID
old values
new values
timestamp
source
device/IP if applicable
correlation ID
approval reference
```

Examples:

```text
Card limit changed
Role assigned
Vendor bank details changed
Bill approved
Payment released
Policy modified
Agent payment requested
Draft user published
```

---

# 61. Security Architecture

- TLS in transit
- encryption at rest for disks/backups
- MFA
- SSO/SAML/OIDC
- SCIM
- server-side RBAC + scopes
- SoD
- step-up auth
- session/device management
- secrets isolation
- token rotation
- card-data tokenization / PCI scope minimization
- attachment malware scanning
- immutable audit trail
- rate limiting
- CORS and portal origin isolation

PAN, CVV, and raw bank secrets never belong in PostgreSQL application tables. Tokenize via the card/payment provider. On-prem deployments still keep PCI scope minimized by not storing or logging those values.

---

# 62. Privacy and Compliance Operations

The platform needs explicit workflows, even on-premises:

- KYB/KYC ownership and review
- sanctions screening responsibilities
- privacy requests
- data export/deletion request handling
- legal retention schedules
- consent records
- vendor tax-document retention
- country-specific regulatory configuration
- data residency controls where contractually required
- privileged-access review

Do not claim certifications until independently audited.

---

# 63. Non-Functional Requirements and SLO Tiers

## Performance

- Web shell interactive target: under 3 seconds on a normal business network
- Common API reads: p95 under 500 ms when no external provider is required
- OCR, AI, ERP sync, exports, imports, large reports, document analysis: async

## Reliability

- idempotency for financial writes
- retry-safe jobs
- transactional outbox
- immutable financial/audit history
- deterministic state machines
- reconciliation jobs
- dead-letter handling
- duplicate-event protection
- provider timeout and circuit-breaker policy

## Availability classes

```text
Tier A: Card authorization / payment release / treasury controls
Tier B: Transaction, expense, AP, accounting APIs
Tier C: Reporting, AI, exports, non-critical analytics
```

Each tier needs availability, p95/p99, error-budget, escalation, and dependency-health definitions before production.

---

# 64. Environment Configuration

Example `.env`:

```text
NODE_ENV=production

DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

STORAGE_DRIVER=local
STORAGE_PATH=/data/finance-app/uploads

OPENAI_API_KEY=...

JWT_SECRET=...
ENCRYPTION_KEY=...

APP_URL=https://finance.company.local
API_URL=https://finance.company.local/api
MOBILE_DEEP_LINK_SCHEME=financeapp

FEATURE_TRAVEL_EMPLOYEE_REWARDS=false
FEATURE_SHEETS_REALTIME_COLLAB=false
```

Production environment files must have restricted OS permissions. Secrets do not belong in git.

---

# 65. On-Premises Deployment Structure

Linux:

```text
/opt/finance-app/
├── api/
├── web/
├── vendor-portal/
├── advisor-console/
├── stack/
├── worker/
└── scripts/

/data/finance-app/
├── uploads/
├── exports/
├── temp/
└── backups/

/var/log/finance-app/
```

Portals can be served as additional Nginx/IIS locations from the same host.

---

# 66. Production Processes

Minimum:

```text
1. Nginx / IIS
2. Next.js web
3. Express API
4. Worker
5. PostgreSQL
6. Redis
```

Add when those surfaces are enabled:

```text
7. Vendor portal
8. Advisor console
9. Stack
```

Mobile talks to the API; it is not an on-prem process.

No Kubernetes is required.

---

# 67. Process Management

Option 1 — PM2:

```text
finance-web
finance-api
finance-worker
finance-vendor-portal      # when enabled
finance-advisor            # when enabled
finance-stack              # when enabled
```

Option 2 — Docker Compose:

```text
web
api
worker
postgres
redis
vendor-portal
advisor-console
stack
```

Volumes:

```text
postgres-data
redis-data
/data/finance-app/uploads
```

---

# 68. Backup and Disaster Recovery

Because files and PostgreSQL are on-premises, backups are essential.

Database:

```text
Nightly pg_dump
    ↓
/data/finance-app/backups/db/
    ↓
Secondary disk / NAS / backup server
```

Prefer PITR where supported.

Files:

```text
Uploads
    ↓
Nightly rsync
    ↓
Secondary disk / NAS
```

Retention: daily / weekly / monthly per company policy.

A backup on the same physical disk is not a real backup.

Define and test:

- RPO
- RTO
- restore drills
- Redis recovery expectations
- provider credential recovery
- incident runbooks

---

# 69. Deployment Flow

```text
Release package
        ↓
Install dependencies
        ↓
Build apps
        ↓
Run DB migrations
        ↓
Restart API
        ↓
Restart Worker
        ↓
Restart Web / enabled portals
        ↓
Smoke test
```

Optional later CI:

```text
Lint → Type Check → Tests → Build → Package → Deploy to On-Prem
```

Terraform is not required.

---

# 70. Testing Strategy

Backend:

```text
Unit tests
Domain state-machine tests
Integration tests
API tests
Authorization / SoD tests
Idempotency tests
Concurrency tests for funds/payments
Provider-adapter contract tests
```

Frontend / mobile:

```text
Vitest
React Testing Library
Playwright
Detox or Maestro for mobile smoke
```

Critical E2E flows:

- login / MFA
- draft user publish
- spend request → fund/card
- card authorization (mocked issuer)
- receipt upload → expense approval
- reimbursement payout
- procurement request → PO
- bill OCR → approval → partial payment → release
- accounting ready → sync
- vendor bank change SoD
- dispute open
- agent identity payment (mocked)
- developer webhook delivery

---

# 71. Module Definition of Done

Every backend module includes:

- API routes
- validation contracts
- commands / queries
- domain rules and state machine
- repository
- migrations
- RBAC + scopes
- entitlements
- audit
- events
- tests
- documentation

Every frontend/mobile feature includes:

- route
- API hook
- list/table or mobile equivalent
- detail view
- forms where needed
- loading / empty / error / denied
- permission behavior
- tests

A module is not done because pages render. It is done when the V3 acceptance path for that domain works end to end.

---

# 72. Recommended Development Order

Build by V3 dependency, not by menu order.

## Phase 1 — Platform Foundation

```text
Monorepo
→ Auth / sessions / MFA
→ Organizations / legal entities
→ People + draft users
→ RBAC + scopes + SoD
→ Entitlements / feature flags
→ Country capability matrix
→ Audit
→ Outbox / events
→ Policy engine
→ Workflow engine
→ Documents / storage
→ Integration framework
```

## Phase 2 — Cards & Spend

```text
Business limit
→ Budgets
→ Spend programs
→ Funds
→ Cards (physical/virtual abstractions)
→ Authorizations
→ Transactions
```

## Phase 3 — Expense Management

```text
Receipts / OCR
→ Matching
→ Expenses
→ Policy Agent (recommend only)
→ Splits
→ Reimbursements
→ Mobile capture
```

## Phase 4 — Accounting

```text
Dimensions
→ Coding
→ Rules
→ Ready-to-sync lifecycle
→ ERP adapters
→ Sync errors
→ Auto-ready / auto-sync controls
```

## Phase 5 — AP / Bill Pay

```text
Vendors (minimum)
→ Invoice intake / OCR
→ Bills
→ Bill approval
→ Payments 1:N
→ Payment release
→ Payment runs
→ AP AI (draft/recommend)
```

## Phase 6 — Procurement / Vendor / Contract

```text
Programs
→ Purchase requests
→ Multi-branch fulfillment
→ Vendor onboarding / Vendor 360
→ PO
→ Receiving
→ 2-way / 3-way match
→ Contracts / renewals
→ Sourcing
→ Price Intelligence
```

## Phase 7 — Travel

```text
Policy
→ Provider inventory
→ Trips
→ Requests
→ Guest / delegate
→ Off-platform context
→ Expense automation
```

## Phase 8 — Insights / Budgets / Savings

```text
Reporting
→ Reporting Agent
→ Budgets (insights depth)
→ Savings
→ License intelligence
```

## Phase 9 — Banking / Treasury

Only after regulated/provider partnerships are defined:

```text
Accounts
→ Balances / transactions
→ Transfers + SoD
→ Automations
→ Statements
→ Cash forecast
```

## Phase 10 — Receivables

```text
Customers
→ Invoices
→ Collections
→ Incoming payments
→ Cash application
```

## Phase 11 — AI Spend + Router

```text
Provider connections
→ Usage/cost attribution
→ Limits
→ Anomaly
→ Router gateway
```

## Phase 12 — External / Specialist Products

```text
Vendor Portal
→ Advisor Console
→ Stack
→ Rewards / cashback
→ Tax / 1099
→ Disputes / repayments
→ Developer platform
→ Sheets
→ Agent Finance
```

Phase 12 items can start earlier as thin slices if a customer needs them, but they must not precede the shared engines they depend on.

## Phase 13 — Advanced Agents

Add only after deterministic workflows are reliable:

```text
Autonomous draft preparation
→ Low-risk automation
→ AP inbox agent
→ Procurement sourcing agent
→ Collections agent
→ Close / accounting coworker
```

Human approval remains mandatory for high-risk financial actions.

---

# 73. What Not to Extract Early

Stay in the monolith until a measured reason exists:

| Temptation | Keep in monolith until |
|---|---|
| Microservice per module | A module has independent scale/regulation/team need |
| Separate auth service | SSO/SCIM complexity actually requires it |
| Separate AI service | Token spend/Router product needs an isolated gateway |
| Elasticsearch on day one | PostgreSQL FTS is insufficient |
| Kubernetes | Multiple hosts and ops maturity require it |
| S3 | NAS/local backup strategy is actually failing |

The seams (storage, queue, LLM, card issuer, ERP, search) already exist so extraction is a deploy change, not a rewrite.

---

# 74. Final Architecture Diagram

```text
                         WEB PORTAL / MOBILE / PORTALS / OAUTH APPS
                                            │
                                            ↓
                                     NGINX / IIS
                                            │
                                            ↓
                                      EXPRESS API
                           ┌────────────────┼────────────────┐
                           ↓                ↓                ↓
                     DOMAIN MODULES      ENGINES         PLATFORM
                     Identity           Policy           Auth/RBAC
                     Spend              Workflow         Events/Outbox
                     Expenses           Documents        Queue/Cache
                     P2P / AP           Search           Storage
                     Travel             Ledger           Observability
                     Accounting
                     Treasury / AR
                     Tax / Disputes
                     AI / Router / Agents
                     Developer Platform
                                            │
                           ┌────────────────┼────────────────┐
                           ↓                ↓                ↓
                     POSTGRESQL           REDIS          LOCAL / NAS
                     System of record     BullMQ          Files
                     Ledger / Audit       Locks
                                            │
                                            ↓
                                         WORKER
                           OCR / AI / ERP / Payments / Webhooks / Index
                                            │
                                            ↓
                                      PROVIDER ADAPTERS
                           Card issuer / Rails / ERP / HRIS / LLM / Travel
```

---

# 75. Final Recommendation

For the current on-premises phase, use:

```text
Modular Monolith
+ Next.js company portal
+ Expo mobile app
+ Optional Vendor / Advisor / Stack apps
+ Express API
+ TypeScript
+ PostgreSQL
+ Redis + BullMQ
+ Shared policy / workflow / document / ledger engines
+ Local / NAS storage
+ Nginx or IIS
+ PM2 or Docker Compose
```

Avoid for now:

```text
S3 as a hard requirement
Terraform
Kubernetes
ECS
Lambda
CloudFront
Managed cloud infrastructure
Microservices
Frontend-calculated financial totals
AI-authorized card spend
Internal-ledger-only banking
```

Keep adapters so future changes such as:

```text
Local Storage → S3
Single Server → Multiple Servers
Local PostgreSQL → Managed PostgreSQL
PM2 → Kubernetes
In-process authorization → isolated authz process
```

can be made without rewriting core business modules.

The goal is:

```text
Simple infrastructure today
+
V3-complete modular domains
+
Shared control graph
+
Strong financial data integrity
+
Safe AI
+
Easy future scalability
```
