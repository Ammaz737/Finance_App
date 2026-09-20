# Ramp-Style Financial Operations SaaS — A-to-Z Product Requirements & Replica Blueprint

**Document type:** Product Requirements Document (PRD) + Software Requirements Specification (SRS) + Workflow/Data/AI Blueprint  
**Research snapshot:** 14 September 2026  
**Target:** Build a functionally equivalent, AI-powered financial operations SaaS with Ramp-like breadth and workflow behavior  
**Research inputs:** Ramp public website, current Ramp Help Center/product release documentation, and the uploaded Ramp product-tour recording supplied in this chat.

> **Important scope note**
>
> This document describes **observable/public product behavior** and then translates that behavior into an implementation-ready blueprint. It does **not** claim access to Ramp's private source code, proprietary underwriting models, fraud models, issuer/banking contracts, internal prompts, private APIs, or hidden infrastructure. Where a behavior is not publicly verifiable, it is explicitly marked **[INFERRED]** or **[REQUIRES VERIFICATION]**.
>
> For a commercial product, replicate functionality and UX patterns under **your own brand, visual identity, copy, contracts, banking partners, and compliance program** rather than copying Ramp trademarks, logos, proprietary text, or protected assets.

---

## 0. Evidence / Confidence Legend

| Tag | Meaning |
|---|---|
| **[VERIFIED]** | Confirmed from current Ramp public documentation/site or directly visible in the supplied product-tour video. |
| **[VIDEO]** | Directly observed in the user's uploaded Ramp tour recording. |
| **[INFERRED]** | Reasonable implementation inference needed to reproduce observed behavior, but not confirmed as Ramp's private implementation. |
| **[REQUIRES VERIFICATION]** | Public sources do not expose the exact internal algorithm, formula, threshold, provider, or state transition. |
| **[REPLICA DESIGN]** | Recommended architecture/behavior for your clone to achieve functional parity. |

---

# 1. Executive Summary

Ramp is best understood as a **financial operations operating system**, not merely a corporate-card application.

At a product level, the platform combines:

1. Corporate cards, funds, and pre-spend controls
2. Spend requests and reusable Spend Programs
3. Expense capture, receipts, memos, policy enforcement, and approvals
4. Employee reimbursements and mileage/per-diem
5. Travel search, booking, trip management, and travel-policy enforcement
6. Accounts payable / Bill Pay
7. Procurement / intake-to-pay / purchase orders
8. Vendor management and vendor onboarding
9. Contracts, renewals, expansions, and sourcing
10. Accounting automation and ERP synchronization
11. Real-time reporting, dashboards, budgets, and savings insights
12. Business banking / treasury / cash automation
13. Receivables / invoicing / collections / cash application
14. AI-token-spend management
15. Multi-entity / multi-currency controls
16. User/role/security/provisioning administration
17. Vendor Portal and accounting-advisor surfaces
18. AI assistants and specialized agents embedded across finance workflows

The key product principle is that these are **not isolated modules**. The core value comes from a single graph of shared data:

`People + Organization + Entity + Vendor + Policy + Budget + Approval Workflow + Accounting Dimensions + Payment Rail + Audit Events`

Every transaction/request/bill/PO/reimbursement/trip/invoice is linked to this graph.

A successful replica therefore needs a **shared workflow engine, policy engine, permissions engine, accounting dimension system, event bus, audit trail, and AI orchestration layer**. Building only visually similar pages would produce a shallow clone and would miss the core product.

---

# 2. Product Vision for the Replica

## 2.1 Product vision

Build an AI-powered finance operations SaaS where a company can:

- onboard its organization and entities;
- invite/provision employees;
- assign roles and approval authority;
- issue physical/virtual spending instruments;
- define spend limits and policies before money is spent;
- collect and review expenses after money is spent;
- reimburse employees;
- buy travel;
- request purchases;
- onboard vendors;
- issue purchase orders;
- receive invoices;
- approve and pay bills;
- manage contracts and renewals;
- monitor treasury;
- invoice customers and collect receivables;
- code everything to an accounting system;
- analyze financial operations in real time;
- ask AI questions and allow AI agents to complete low-risk work;
- preserve human authority, permissions, evidence, and a complete audit trail.

## 2.2 Core product promise

**One finance data model + one control plane + multiple money/workflow products.**

All modules must share:

- users
- entities
- departments
- locations
- vendors
- accounting dimensions
- policies
- approval chains
- budgets
- notifications
- documents
- comments
- audit events
- AI context
- integrations
- permissions

---

# 3. Product Architecture — Conceptual

```text
                        ┌───────────────────────────────┐
                        │          Web / Mobile         │
                        │ Employee | Manager | Finance  │
                        └───────────────┬───────────────┘
                                        │
                              Global Search / Ask AI
                                        │
┌───────────────────────────────────────┴───────────────────────────────────────┐
│                         FINANCIAL OPERATIONS PLATFORM                         │
├─────────────────┬────────────────┬────────────────┬───────────────────────────┤
│ Spend & Cards   │ Expenses       │ Procure-to-Pay │ Order-to-Cash             │
│ Funds/Programs  │ Reimbursements │ Procurement    │ Receivables               │
│ Requests        │ Travel         │ Vendors        │ Collections               │
│                │                │ Bill Pay       │ Cash Application          │
├─────────────────┴────────────────┴────────────────┴───────────────────────────┤
│ Reporting | Budgets | Savings | Banking/Treasury | AI Token Spend            │
├───────────────────────────────────────────────────────────────────────────────┤
│ Shared Platform Services                                                      │
│ RBAC | Policy | Approval Workflow | Accounting | Entity | Document/OCR        │
│ Notifications | Search | Audit | Integrations | Event Bus | AI Agents         │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

# 4. Primary Navigation / Information Architecture

## 4.1 Navigation observed in the supplied Ramp tour

**[VIDEO]** The left navigation shown in the supplied product-tour recording includes:

```text
Setup guide
  Next: Review your policy

Home
  Overview
  Inbox
  My expenses
  My travel

Insights
Manage spend
Expenses
Travel
Bill Pay
Banking
Accounting
Vendors
Policy
Ask Ramp
```

The recording also shows:

- a global top search field similar to **Search for anything**;
- notification bell;
- global create/add button;
- help/support entry point;
- profile/avatar;
- badges/counters on navigation items;
- a setup progress indicator;
- contextual right-side drawers;
- product-tour overlays.

**[VERIFIED]** Current Ramp documentation additionally exposes product surfaces for Procurement, Receivables, AI Token Spend, Vendor Portal, Advisor Console, security/integrations, multi-entity, budgets/reporting, contracts/renewals, and settings.

## 4.2 Recommended replica navigation

```text
HOME
  Overview
  Inbox
  My expenses
  My travel
  My AI spend

INSIGHTS
  Reports
  Dashboards
  Budgets
  Savings
  Price intelligence

MANAGE SPEND
  Funds & cards
  Programs
  Requests
  Purchase orders
  Tokens

EXPENSES & TRAVEL
  Card transactions
  Reimbursements
  Travel
    Overview
    Trip management
    Travel policies

BILL PAY
  Bills
  Payments
  Payment runs
  AP inbox
  Settings

RECEIVABLES
  Invoices
  Customers
  Products & services
  Payments
  Collections
  Settings

VENDORS
  Vendors
  Contracts & renewals
  Vendor requests
  Sourcing
  Documents

BANKING
  Accounts
  Transactions
  Transfers
  Automations
  Investment
  Settings

ACCOUNTING
  Overview
  Waiting for cardholder
  Needs review
  Ready to sync
  Synced
  Rules
  Automation
  Sync settings
  Accounting fields

POLICY
  Travel & expenses
  Spend requests
  Bill Pay
  Procurement
  Vendors
  Reimbursements
  Travel
  Collections

ASK AI

COMPANY
  People
  Departments
  Locations
  Entities
  Roles & permissions
  Integrations
  Security
  Developer API
  Audit log
  Notifications
  Billing / plan / entitlements
```

---

# 5. Personas and Roles

## 5.1 Core personas

### Business Owner
Owns the financial account and highest-risk configuration. Can administer users, policies, entities, payments, and security.

### Business/Admin User
Full operational administration for finance and spend.

### Finance Admin
Broad access to spend, bills, vendors, treasury, accounting, and finance settings while having more restricted people/security administration than an Owner.

### Accounting
Codes, reviews, reconciles, and syncs financial transactions.

### Accounts Payable
Manages vendors, invoices, approval queues, payment scheduling, and Bill Pay.

### IT Admin
Manages identity/provisioning/security/integrations without broad access to sensitive spend workflows.

### Employee / Cardholder
Views own funds/cards, expenses, trips, requests, and reimbursements.

### Manager
Approves/reporting-chain activity and sees team-scoped data based on hierarchy.

### Assistant
Can perform delegated administrative actions for assigned users, while approvals remain controlled separately.

### View-Only Admin
Broad visibility with restricted mutation permissions.

### Guest / Contractor
Limited spend/reimbursement access.

### AI Token Spend Admin
Manages AI provider connections and token-spend controls when entitled.

### Procurement Roles
Requester, Procurement Admin, Workflow Owner, Sourcing Owner, Collaborator, Grader.

### Travel Manager
Manages travel configuration/trips according to granted scope.

### Accounts Receivable Clerk
Manages customers, invoices, products/services, payments, and collections subject to configured permissions.

## 5.2 Permission model

**[VERIFIED]** Ramp roles are additive. A user can inherit broader visibility by having multiple roles.

**[REPLICA DESIGN]** Implement permissions as:

```text
EffectivePermission(user, action, resource) =
  BaseRolePermissions
  ∪ AdditionalRolePermissions
  ∪ DelegatedPermissions
  ∪ ResourceScopedPermissions
  ∪ ApprovalAuthority
  - ExplicitRestrictions
```

Do not hard-code page access by role name only. Every protected action must check:

- business/workspace
- entity
- resource ownership
- reporting hierarchy
- department/location
- role permission
- delegated/assistant relationship
- approval step
- separation-of-duties rule
- plan entitlement

---

# 6. Shared Domain Model

A functional replica should center on the following objects.

## 6.1 Organization objects

```text
Business
BusinessEntity
User
UserProfile
Role
Permission
UserRole
Department
Location
ManagerRelationship
CustomFieldDefinition
CustomFieldValue
NotificationPreference
IntegrationConnection
PlanEntitlement
```

## 6.2 Spend/card objects

```text
Card
PhysicalCard
VirtualCard
Fund
FundPeriod
SpendProgram
SpendProgramVersion
SpendRequest
LimitIncreaseRequest
MerchantControl
CategoryControl
CardTransaction
CardAuthorization
CardSettlement
CardRefund
CardDispute
Statement
StatementPayment
```

## 6.3 Expense objects

```text
Expense
Receipt
ReceiptMatch
Memo
Attendee
ExpenseRequirement
Policy
PolicyVersion
PolicyAssessment
ExpenseReview
Repayment
Comment
```

## 6.4 Procurement/AP objects

```text
ProcurementProgram
ProcurementRequest
PurchaseOrder
PurchaseOrderLine
SourcingEvent
SourcingVendor
SourcingQuestionnaire
Vendor
VendorContact
VendorPaymentDetail
VendorTaxDetail
VendorDocument
VendorApproval
Contract
ContractVersion
RenewalRequest
ExpansionRequest

Bill
BillLine
BillAttachment
BillApproval
BillPayment
PaymentRun
PaymentRelease
POInvoiceMatch
```

## 6.5 Travel/reimbursement objects

```text
Trip
TravelBooking
FlightBooking
HotelBooking
CarBooking
TravelPolicy
PerDiemPolicy
PerDiemDay
Reimbursement
MileageRoute
MileageRate
```

## 6.6 Accounting objects

```text
AccountingProvider
AccountingConnection
AccountingDimension
AccountingDimensionValue
CodingRule
CodingRuleCondition
CodingRuleAction
AccountingCoding
AccountingSyncJob
AccountingSyncRecord
AccountingPeriod
```

## 6.7 Banking objects

```text
BankAccount
BankTransaction
Transfer
RecurringTransferRule
TargetBalanceRule
CashForecast
InvestmentAccount
InvestmentPosition
```

## 6.8 Receivables objects

```text
Customer
CustomerContact
ProductService
ARInvoice
ARInvoiceLine
CreditNote
ARPayment
PaymentApplication
BankDeposit
CollectionCase
CollectionMessage
PromiseToPay
```

## 6.9 AI objects

```text
AIConversation
AIMessage
AgentDefinition
AgentRun
AgentDecision
AgentEvidence
AgentCitation
AgentFeedback
AgentAction
AIProviderConnection
AIUsageRecord
AIUsageLimit
AIAnomaly
```

## 6.10 Platform objects

```text
ApprovalWorkflow
WorkflowVersion
WorkflowNode
WorkflowCondition
WorkflowExecution
ApprovalStep
AuditEvent
Document
FileAttachment
OCRExtraction
Notification
SearchIndexDocument
WebhookSubscription
BackgroundJob
FeatureFlag
```

---

# 7. Home / Overview

## 7.1 Purpose

The Home page is the user's operational landing surface.

It should answer:

- What needs my attention?
- How much money/spend is visible to me?
- Which requests/expenses/bills need review?
- Which funds/cards can I use?
- What trips or important objects are active?
- Are there warnings, recommendations, or renewal tasks?

## 7.2 Observed dashboard

**[VIDEO]** The tour showed:

- greeting: `Good morning, David`
- current card balance
- Cash & Treasury balance
- total spending over a 90-day period
- spend trend chart
- "Requires your approval" feed
- bill and reimbursement approval cards
- yellow `Issue` button
- `New` action/menu
- card/fund tiles such as Software, Marketing Travel, General Expenses
- available amount / amount left
- upcoming trip card
- navigation counters
- right-hand contextual panel

## 7.3 Home widgets

**[REPLICA DESIGN]**

### Metric row
- current card balance
- cash / treasury balance
- total spend for selectable period
- pending approvals
- overdue bills
- out-of-policy spend
- budget risk

### Task Feed
Unified work queue containing:
- spend approvals
- card/expense reviews
- reimbursement approvals
- Bill Pay approvals
- procurement approvals
- missing receipts/memos/coding
- contract renewals
- vendor changes
- AI recommendations
- draft requests/invoices where applicable

### Right rail
- issue/request actions
- own cards/funds
- up to N recently/relevant accessible funds
- active/upcoming trip
- contextual business notices
- bank balance alerts
- renewal reminders

### FYI events
Read-only information:
- request approved/rejected
- user added
- card terminated
- threshold warning
- budget warning
- bank balance warning

## 7.4 Data query

```text
Home(user):
  permissions = resolvePermissions(user)
  tasks = TaskService.getOpenTasks(user, permissions)
  ownSpend = SpendService.getAccessibleFunds(user)
  metrics = AnalyticsService.homeMetrics(scope)
  trips = TravelService.upcomingTrips(user)
  notices = NotificationService.highPriority(user)
  renewals = ContractService.actionableRenewals(user)
```

## 7.5 Acceptance criteria

- Home must be role-sensitive.
- An employee must not see company-wide finance data unless explicitly granted.
- An approver must see tasks currently assigned to them.
- A completed/rejected approval must disappear from the active queue.
- Changes in spend/payment data must propagate into dashboard metrics according to the defined freshness SLA.
- Right-rail cards/funds must reflect current usable balances and lock state.

---

# 8. Global Search

## 8.1 Purpose

One keyboard-accessible search across finance objects and navigation.

## 8.2 Searchable object types

**[REPLICA DESIGN]**
- pages/settings
- users
- vendors
- transactions
- bills
- invoices
- cards/funds
- spend requests
- purchase orders
- contracts
- trips
- reimbursements
- customers
- payment records
- reports

## 8.3 Result ranking

```text
score =
  lexical_match
  + semantic_match
  + recency_weight
  + object_priority
  + user_access_weight
```

Search must filter unauthorized objects **before** results are returned.

---

# 9. Inbox

## 9.1 Purpose

One review/approval queue across products.

**[VERIFIED]** Ramp documentation describes Inbox as a primary place for approvals across card transactions, reimbursements, bills, and spend requests.

## 9.2 Tabs / queue types

Recommended:
- All
- Expenses
- Reimbursements
- Spend requests
- Bills
- Procurement
- Vendors
- Other

## 9.3 Common review layout

Three-pane pattern:

```text
Left: queue/list
Center: object + activity + fields
Right: evidence / receipt / invoice / policy
Bottom/top sticky actions: Reject | Request changes | Approve
```

**[VIDEO]** Expense review in the tour showed:
- queue on left
- receipt preview
- detailed fields
- AI recommendation
- activity/comments
- Reject and Approve actions
- policy-reference drawer

## 9.4 Queue eligibility

Example for card expense:

```text
ReadyForReview =
  Transaction.status == CLEARED
  AND all_submission_requirements_satisfied
  AND NOT exempted
  AND assigned_workflow_step_is_active
```

Pending transactions and expenses with unresolved required items should remain visible in dedicated transaction pages but should not enter the final approval queue until eligible.

---

# 10. Funds & Cards / Manage Spend

## 10.1 Core model

**[VERIFIED]**

- A physical card can spend against eligible Funds.
- A virtual card has its own card number and is suitable for online/vendor-specific use.
- Funds represent controlled spend limits.
- Spend Programs are reusable templates/workflows for issuing/requesting spend.

## 10.2 Funds & Cards page

### Table/grid fields
- owner
- fund/card name
- purpose
- type
- card status
- fund status
- entity
- currency
- limit
- frequency
- spent
- remaining
- linked physical card
- Spend Program
- merchant/category restrictions
- start/end lock dates
- last transaction
- created by

### Actions
- issue
- edit
- lock/unlock
- terminate
- request increase
- temporary increase
- replace/reorder physical card
- view activity
- view declines
- change linked fund
- copy card details when authorized
- request new spend

## 10.3 Card/fund issuance form

**[VIDEO]** Tour example "Marketing Travel":

- purpose/name: Marketing Travel
- description: funds for client-facing marketing travel
- amount: $35,000 USD
- frequency: quarterly
- submission policy
- owner
- entity
- policy & controls accordions:
  - Sharing
  - Spending controls and restrictions
  - Receipts, memos, and reviews
  - Transaction coding rules
  - Payment options

### Required issuance fields

```text
Owner
Purpose
Amount
Currency
Frequency
Entity
Submission Policy
Card Type / Fund Type
Start/End Controls
Merchant/Category Controls
Receipt/Memo Requirements
Accounting Coding Defaults/Rules
Payment Options
```

**[VERIFIED]** Currency is selected on creation and is not freely mutable afterward for existing funds/cards.

## 10.4 Frequency

Common periodic reset modes:

- one-time / does not repeat
- daily
- weekly
- monthly
- quarterly
- yearly
- annual relative to issue date

**[VERIFIED]** Ramp publicly documents reset timing semantics for these modes. Your replica should store reset schedule explicitly rather than recomputing from display text.

## 10.5 Fund balance model

**[REPLICA DESIGN]**

```text
period_limit = configured_limit
temporary_increase = active_temporary_adjustment
buffer = configured_limit * buffer_percentage

authorization_capacity =
  period_limit
  + temporary_increase
  + buffer
  - cleared_spend_in_period
  - eligible_pending_authorizations
  + eligible_refunds_or_reversals
```

**[REQUIRES VERIFICATION]** Exact treatment of every network authorization, incremental authorization, reversed hold, refund timing, foreign-exchange difference, offline transaction, and buffer interaction is issuer/network-specific.

## 10.6 Hidden buffer

**[VERIFIED]**

```text
buffer_amount = fund_limit * buffer_percent / 100
```

Range can be configured up to the documented maximum supported by the product. The UI should preview the equivalent currency value.

Buffer should not necessarily be shown as ordinary employee-visible budget; it is an authorization tolerance.

## 10.7 Decline engine

A transaction may be declined when:
- fund/card locked
- fund terminated
- user inactive
- insufficient remaining limit
- category blocked/not allowed
- merchant restriction
- fraud/risk control
- issuer/network rule
- invalid card details
- entity/currency/card capability restriction

**[VERIFIED]** Users can receive SMS/push information explaining certain declines and request exceptions/increases.

### Authorization decision

```text
authorize(txn):
  assert user.active
  assert card.active
  assert fund.active
  assert amount <= available_authorization_capacity
  assert merchant passes merchant rules
  assert category passes category rules
  assert time/location controls pass
  assert risk engine passes
  return APPROVE or DECLINE(reason_code)
```

---

# 11. Spend Programs

## 11.1 Definition

A Spend Program is a reusable package of:

- request form
- amount logic
- currency/frequency
- card/fund behavior
- controls
- approval workflow
- reimbursement allowance
- PO/procurement behavior
- contract-tracking behavior
- accounting defaults
- distribution method

## 11.2 Programs page

Tabs/filters:
- issuing
- requestable
- procurement-enabled
- archived

Columns:
- program name
- purpose
- default amount / custom amount
- frequency
- currency
- requestable vs admin-issued
- users/issued funds count
- workflow
- entity
- status

Actions:
- create
- edit
- duplicate
- archive
- issue
- view requests
- view associated cards/funds
- configure workflow forms
- manage automations

## 11.3 Program creation

Steps:

1. Name and purpose
2. Amount model
3. Frequency/currency
4. Physical-card eligibility
5. Reimbursements allowed?
6. Merchant/category restrictions
7. Buffer
8. Request/issue method
9. Request form fields
10. Approval workflow
11. Accounting rules
12. Optional PO generation
13. Optional contract tracking
14. Publish

---

# 12. Spend Requests

## 12.1 User flow

```text
Home/New/Request Spend
  → choose General Funds / Virtual Card / Spend Program
  → enter request information
  → AI recommendation / policy context
  → submit
  → approval workflow
  → approved output:
       Fund and/or Virtual Card
       optionally PO
  → notification
```

## 12.2 Fields

- requested amount
- currency
- frequency
- business purpose
- vendor
- start/end date
- Spend Program
- entity
- accounting dimensions
- attachments/quote/contract
- custom questions

## 12.3 Approval conditions

Common conditions:
- annualized requested amount
- user role
- entity
- department
- location
- program
- vendor/category
- budget context
- custom field

**[VERIFIED]** For at least some Ramp spend-request approval rules, periodic spend can be annualized for amount-threshold evaluation.

Example:

```text
annualized_amount(monthly request) = monthly_amount * 12
```

Never compare recurring monthly spend to an annual threshold using only one month unless the rule specifically says so.

## 12.4 Separation of duties

If enabled, a requester who would otherwise be part of the approval chain must not approve their own request. Replace/skip that approver according to configured fallback rules.

## 12.5 Request state machine

```text
DRAFT
  → SUBMITTED / PENDING_APPROVAL
      → APPROVED
      → REJECTED
REJECTED
  → EDITED + RESUBMITTED → new approval attempt
```

Additional internal states may include:
- canceled
- expired
- withdrawn

---

# 13. Spend Request AI

**[VERIFIED]** Ramp exposes AI recommendations for spend requests.

Inputs:
- fund/request name
- amount
- currency
- frequency
- memo/purpose
- request type
- policy
- possible overlap with existing funds
- Spend Program fit
- contextual risk

Outputs:
- Approval recommended
- Review recommended
- Rejection recommended
- rationale
- policy citations/references

**Design requirement:** recommendation must never silently replace deterministic permissions or required approval authority.

---

# 14. Card Transaction Lifecycle

## 14.1 State flow

```text
Merchant authorization
  → authorization accepted
      → PENDING
          → CLEARED/SETTLED
          → REVERSED/EXPIRED
  → authorization rejected
      → DECLINED
```

Subsequent flows:
- merchant refund → separate credit transaction
- personal/accidental spend → repayment
- dispute → dispute workflow
- fraud → card/fund lock + confirmation workflow

## 14.2 Pending behavior

**[VERIFIED]**
- pending means authorized but not fully settled;
- most pending charges resolve within a documented time window;
- travel holds can take longer;
- cleared transactions cannot simply be deleted;
- refunds generally appear as separate credits.

## 14.3 Transaction detail page

Fields:
- merchant
- normalized merchant
- transaction date
- clearing date
- amount
- original currency
- settlement currency
- exchange rate
- card/fund
- cardholder
- entity
- category/MCC
- receipt
- memo
- accounting coding
- approval status
- policy status
- transaction status
- dispute/repayment status
- activity
- comments
- vendor record
- trip linkage
- budget linkage

Actions:
- upload/match receipt
- edit memo
- edit coding
- mark personal/request repayment
- dispute
- report merchant/category issue
- comment
- approve/reject if reviewer
- request changes
- remind employee
- view policy reference

---

# 15. Expense Requirements & Receipt Automation

## 15.1 Submission policy

A submission policy defines which evidence/fields are required after spend.

Conditions can be based on:
- amount
- category
- merchant
- user/department/location/entity
- card/program
- transaction type

Requirements:
- receipt
- memo
- accounting field(s)
- attendees
- trip
- purpose
- custom fields

## 15.2 Receipt capture channels

- mobile camera
- upload
- SMS/MMS
- email forwarding
- connected email
- browser/merchant receipt retrieval where supported
- travel integrations

## 15.3 Matching

```text
Receipt
  → OCR/extraction
  → candidate transactions
  → match score
  → auto-match when confidence >= threshold
  → otherwise user selection/review
```

Candidate signals:
- merchant
- amount
- currency
- date
- cardholder
- last digits/card context
- invoice/order number

**[REQUIRES VERIFICATION]** Exact match scoring threshold is proprietary.

## 15.4 Expense auto-population

When confidence is sufficient:
- attach receipt
- infer memo/purpose
- suggest accounting category
- apply deterministic accounting rule where one exists

Missing or ambiguous data should still be requested from the user.

---

# 16. Policy Agent

## 16.1 Purpose

AI reviews the semantic meaning of expenses against an agent-friendly policy rather than relying only on hard-coded deterministic flags.

## 16.2 Policy ingestion

Inputs:
- uploaded/written expense policy
- entity exceptions
- department/location exceptions
- admin notes
- structured policy edits

Recommended pipeline:

```text
Policy document
 → parser
 → sections/rules
 → normalized policy representation
 → embedding/index
 → versioned published policy
```

Draft and published versions must be separate. Only published policy affects production assessments.

## 16.3 Expense evaluation context

**[VERIFIED]** Context includes information such as:
- merchant
- amount/date/currency
- receipt OCR/itemization
- memo
- attendees
- trip
- location
- custom fields
- fund/card context
- Spend Program

## 16.4 Decision outputs

```text
APPROVAL_RECOMMENDED
REQUIRES_REVIEW
REJECTION_RECOMMENDED
```

The agent must provide:
- decision
- rationale
- supporting policy text/reference
- policy version
- confidence/internal safety signals
- timestamp
- evaluation inputs snapshot

## 16.5 Auto-approval

A recommendation can trigger automatic approval only when the deterministic workflow allows it.

```text
auto_approve =
  policy_decision == APPROVAL_RECOMMENDED
  AND workflow_allows_agent_approval
  AND amount <= configured_agent_limit
  AND all_required_fields_complete
  AND no_blocking_risk_flag
```

Human reviewers retain override authority.

## 16.6 Policy Agent review UI

**[VIDEO]** Tour showed:
- AI recommendation at top
- reviewer still has Reject/Approve
- policy rationale
- policy references
- reference drawer with sections such as Air Travel Standards, Rail Standards, Lodging Standards

---

# 17. Expense Review / Approval

## 17.1 Page behavior

Queue:
- approval recommended
- review recommended
- all needing review

Detail:
- receipt image/document
- extracted data
- merchant/category
- memo
- accounting coding
- policy recommendation
- policy references
- activity
- comments
- approval chain

Actions:
- approve
- reject
- request changes
- repayment
- comment
- edit coding if permitted

## 17.2 Review state model

```text
WAITING_FOR_REQUIREMENTS
  → READY_FOR_REVIEW
      → APPROVED
      → REJECTED
      → CHANGES_REQUESTED
      → REPAYMENT_REQUIRED
```

`REJECTED` does not necessarily undo the network card charge. Financial correction may require repayment, refund, or accounting treatment.

---

# 18. Reimbursements

## 18.1 Employee flow

```text
New → Reimbursement
  → choose expense type
  → amount/currency/date
  → receipt
  → memo/business purpose
  → accounting fields
  → mileage/per-diem if applicable
  → submit
  → approval
  → payment
  → accounting sync
```

## 18.2 Reimbursement types

- standard cash expense
- mileage
- per diem
- foreign-currency reimbursement
- off-platform/manual payout

## 18.3 Mileage

Recommended formula:

```text
reimbursable_distance =
  route_distance
  - configured_commute_deduction

mileage_reimbursement =
  max(0, reimbursable_distance) * applicable_rate
```

Inputs:
- origin/destination
- route distance
- business date
- employee jurisdiction
- company/department override
- government/custom rate

**[VERIFIED]** Ramp supports map-based mileage and configurable mileage-rate behavior.  
**[REQUIRES VERIFICATION]** Exact routing provider behavior and every jurisdictional rate table should be separately specified for your target countries.

## 18.4 Per diem

Modes:
- flat company amount
- jurisdiction/location-based reference amount

Recommended daily computation:

```text
employee_eligible_share =
  expense_amount / attendee_count
  # when policy says expense is shared among attendees

remaining_daily_allowance =
  daily_limit - sum(eligible_employee_share_for_day)
```

Ground transportation should remain separate when policy excludes it from per-diem categories.

## 18.5 Reimbursement batching

Payments may be grouped for an employee where allowed, but every individual reimbursement record must retain its audit/accounting identity.

---

# 19. Travel

## 19.1 Employee My Travel

Capabilities:
- search flights
- search hotels
- search rental cars
- filters
- policy indicators
- select payment/funds
- approval if required
- booking confirmation
- cancel/manage according to fare rules
- view all trips/requests
- loyalty/traveler profile

## 19.2 Travel policy

Policy dimensions:
- route/destination
- cabin
- airline
- hotel nightly threshold
- advance booking
- refundable/nonrefundable
- car type
- trip duration
- entity
- employee level
- department
- exceptions

## 19.3 Pre-spend travel enforcement

```text
search result
  → evaluate travel policy
  → in policy / approval required / blocked or warning
  → optional approval
  → booking
  → create/update Trip
  → attach booking receipt
  → match card transaction
  → code expense
```

## 19.4 Trip entity

A Trip aggregates:
- flights
- hotels
- cars
- rail
- ground transport
- per diem
- related expenses
- travelers
- destination
- dates
- approval state

## 19.5 Travel admin surfaces

Travel Overview:
- travel spend
- category breakdown
- off-platform spend
- outliers
- biggest trip
- top spender
- policy flags

Trip Management:
- live/current travelers where permitted
- all trips
- booking requests
- filters
- export

---

# 20. Bill Pay / Accounts Payable

## 20.1 AP lifecycle

```text
Invoice intake
  → OCR / AP inbox agent
  → Draft Bill
  → vendor match/create draft vendor
  → line items + accounting coding
  → duplicate/fraud/AP policy checks
  → Create Bill
  → Approval workflow
  → Payment scheduling
  → optional payment release
  → optional payment run
  → execute payment
  → Paid / Failed
  → accounting sync
```

## 20.2 Bill Pay pages

### Bills
Tabs:
- Drafts
- Needs approval
- Approved / ready
- Scheduled
- In progress
- Paid
- Failed
- Rejected
- Archived

Columns:
- vendor
- bill/invoice #
- amount
- due date
- payment date
- entity
- status
- approver
- payment method
- PO match
- accounting sync
- created source

### Bill detail
- invoice image
- extracted header fields
- line items
- vendor
- PO
- payment details
- payment schedule
- coding
- approval timeline
- AP Agent result
- fraud flags
- comments
- activity/history
- supporting documents

### Payments
- payment ID
- bill
- vendor
- amount
- method
- release status
- scheduled date
- sent/settled date
- payment failure
- fees
- bank/card source

### Payment Runs
- name
- bills/payments
- total amount
- fees
- payment dates
- validation errors
- release

## 20.3 Invoice intake

Channels:
- upload
- AP forwarding email
- connected AP Gmail/inbox
- API/integration

OCR extracts:
- vendor
- invoice #
- invoice date
- due date
- terms
- currency
- total
- tax
- PO #
- line items
- payment instructions

Only the invoice source should drive invoice OCR; supporting attachments should retain document identity.

## 20.4 AP Agent

AI capabilities:
- invoice extraction
- vendor match
- line-item coding
- duplicate detection
- suspicious vendor/payment detection
- AP-policy checks
- approval recommendation
- draft vendor-response generation
- automatic bill creation when all configured checks pass
- automatic exact-amount card payment for eligible vendor portals

Important separation:

```text
AI may create a Bill
≠
AI automatically bypasses approval
```

A created bill still enters configured approval workflow.

## 20.5 Approval workflow

Conditions:
- amount
- vendor
- entity
- department
- accounting category
- PO presence/match
- requester
- custom fields

Actions:
- approve
- reject with reason
- request edit
- comment
- resubmit
- archive

## 20.6 Payment release

Separate:
1. Bill approval
2. Authority to release company funds

A Payer role should be able to release only payments allowed by policy and entity/bank permissions.

## 20.7 Payment methods

Depending on geography/partner:
- ACH
- check
- wire
- international transfer
- card
- other supported rails

Do not tightly couple payment workflow to one processor. Use a rail adapter interface.

## 20.8 Partial payments

Recommended model:

```text
invoice_total = bill.total

paid_amount =
  Σ(settled_payment.amount)
  + Σ(applied_credit.amount)

remaining_balance =
  max(0, invoice_total - paid_amount)

bill_status = PAID iff remaining_balance == 0
```

Each partial payment is an independent payment record with its own:
- method
- schedule
- release
- status
- accounting event

## 20.9 PO match

Two-way:
`PO ↔ Invoice`

Three-way when receiving is implemented:
`PO ↔ Receipt/Goods Received ↔ Invoice`

Match:
- vendor
- PO #
- line description/SKU
- quantity
- unit price
- total
- tax
- tolerance

Mismatch must trigger review based on tolerance rules.

---

# 21. Procurement / Intake-to-Pay

## 21.1 Core flow

```text
Employee
  → Request
  → choose Procurement Program
  → form / contract / quote intake
  → AI autofill
  → approval workflow
  → vendor onboarding / security / legal / finance checks
  → sourcing if applicable
  → final approval
  → PO and/or virtual card
  → invoice/card spend
  → PO match
  → Bill Pay / payment
  → accounting
```

## 21.2 Procurement Program

Bundle:
- request form
- conditional questions
- approval chain
- workflow integrations
- procurement agents
- vendor onboarding
- payment outcome
- PO creation
- card creation
- contract creation
- accounting dimensions

## 21.3 Requests page

Columns:
- request
- requester
- vendor
- amount
- status
- current step
- submitted
- entity
- program
- PO
- card
- contract

## 21.4 Workflow builder

Node types:

```text
Start
Form
Condition / Split
Approval
Agent Review
Vendor Onboarding
Security Review
Legal Review
Finance Review
Custom API
Jira/Linear/Asana Task
E-signature
PO Creation
Card Creation
Contract Creation
Notification
End
```

Every workflow execution must be versioned so an in-flight request keeps the rules it began with unless explicitly migrated.

## 21.5 Procurement AI agents

Recommended pattern:

```text
Agent instructions
 + request data
 + uploaded docs
 + vendor data
 + permitted web/research tools
 → structured report
 → findings/citations
 → output fields
 → workflow routing
```

**[REQUIRES VERIFICATION]** Ramp public material has evolved around whether particular procurement agents only advise/escalate or can automatically advance/approve in certain workflow configurations. Your replica should make autonomy an explicit configurable capability and preserve human/SoD constraints.

---

# 22. Purchase Orders

## 22.1 Creation

Standard:
`approved procurement request → PO auto-created`

## 22.2 PO data

- PO number
- entity
- vendor
- requester
- owner
- approved total
- currency
- dates
- terms
- line items
- accounting coding
- contract
- linked card
- approval source
- invoices
- paid/committed/remaining
- sync status

## 22.3 PO actions

- view
- download PDF
- send vendor
- sync ERP
- amend/change order
- close
- link bill
- link card transaction
- create contract
- view matched spend

## 22.4 Commitment calculation

Recommended:

```text
po_committed_remaining =
  max(
    0,
    approved_po_total
    + approved_change_orders
    - matched_finalized_spend
    - closed/canceled_amount
  )
```

Exact commitment behavior must account for invoice state, partial delivery, tax, FX, and accounting configuration.

---

# 23. Vendors

## 23.1 Vendor master

Central record:
- canonical vendor name
- aliases/merchant mappings
- owner
- department
- entity relationships
- contacts
- payment details
- tax info
- status
- risk
- total spend
- card spend
- Bill Pay spend
- contracts
- POs
- bills
- documents
- approval history

**[VERIFIED]** Ramp can surface vendors from payment/spend activity even when a transaction/payment fails, making vendor identity broader than "paid vendors only."

## 23.2 Vendor detail

Tabs:
- Overview
- Spend
- Cards/funds
- Bills/payments
- Purchase orders
- Contracts
- Documents
- Activity

## 23.3 Vendor change approval

Sensitive changes such as payment/tax details should route through vendor policy.

```text
VendorChange
 → classify field sensitivity
 → approval workflow
 → optional verification
 → apply change
 → audit
```

## 23.4 Vendor onboarding

Request:
- legal name
- address
- tax ID/forms
- payment method
- bank details
- contacts
- documents
- security/legal questionnaires

Use secure vendor portal links rather than collecting sensitive bank details through ordinary email.

---

# 24. Contracts & Renewals

## 24.1 Contract record

Fields:
- vendor
- contract name
- description
- amount
- currency
- start date
- end date
- last date to action
- auto-renew
- owner
- source
- linked PO
- linked request
- documents
- renewal status
- reminder settings

## 24.2 AI extraction

From uploaded contract:
- amount
- term
- renewal language
- termination/action date
- payment terms
- key clauses
- line items

Always show source evidence and require review for critical legal/financial fields.

## 24.3 Renewal workflow

```text
Contract approaches milestone
 → reminder
 → Request renewal
 → AI suggests program + prefills context
 → edit/submit
 → approval workflow
 → approved
 → new contract version/record
 → link previous contract
 → configure next reminders
```

Other actions:
- snooze
- mark renewed
- won't renew
- reopen
- expansion request
- merge related contracts

## 24.4 Expansion

Example:

```text
current_contract_amount = 10,000
approved_expansion = 5,000
new_contract_total = 15,000
```

Maintain the expansion PO/request as a linked event, not only overwrite history.

---

# 25. Vendor Sourcing

## 25.1 Event types

- RFI
- RFP
- RFQ

## 25.2 Workflow

```text
Create sourcing event
 → requirements/questionnaire
 → invite vendors
 → NDA/e-sign if needed
 → vendor portal response
 → AI extract pricing
 → weighted scoring
 → grader review
 → negotiate
 → award
 → convert winner into procurement request/vendor/contract
 → notify non-winners
```

## 25.3 Scoring

```text
weighted_section_score =
  Σ(section_score * section_weight)

final_vendor_score =
  weighted_section_score
  + optional commercial adjustment
```

Weights must sum to 100% if using normalized weighted scoring.

AI-generated pricing summaries must be labeled as estimates when interpretation is involved; source vendor pricing remains authoritative.

---

# 26. Bill Pay ↔ Procurement ↔ Vendor ↔ Accounting Synchronization

A core parity requirement is cross-module linkage.

Example:

```text
Approved Procurement Request
  ↓
Purchase Order
  ↓
Vendor relationship
  ↓
Invoice received
  ↓
Bill
  ↓
PO Match
  ↓
Approval
  ↓
Payment
  ↓
Accounting sync
  ↓
Budget actual + vendor spend + report metrics
```

If one object changes:
- vendor name update propagates display references;
- PO changes update match/commitment;
- bill payment updates vendor/payment/reporting;
- coding updates accounting/report dimensions;
- contract link updates renewal and procurement context.

---

# 27. Banking / Treasury

## 27.1 Accounts page

Account types may include:
- operating/checking
- reserve
- investment
- linked external accounts
- additional supported treasury accounts

Fields:
- account
- entity
- available balance
- ledger balance
- yield/rate where relevant
- pending inflow/outflow
- last sync
- status

## 27.2 Banking transactions

Filters:
- date
- account
- entity
- amount
- transfer/payment type
- status
- counterparty

## 27.3 Transfers

- internal account transfer
- external ACH/wire
- recurring transfer
- bill/statement related cash movement

## 27.4 Target-balance automation

Two conceptual modes:
- reactive minimum balance
- predictive/forecasted shortfall

Recommended math:

```text
top_up =
  max(0, target_balance - projected_balance)

excess =
  max(0, projected_balance - target_balance)
```

Actions:
- move money from funding account/investment when below target;
- optionally sweep excess to investment/reserve.

**[REQUIRES VERIFICATION]** Forecast horizon, minimum transfer, settlement windows, and optimization algorithm are treasury-provider specific.

## 27.5 Cash forecast

Inputs:
- current balances
- scheduled bills
- statement payments
- payroll where integrated
- recurring transfers
- known receivables
- historical cash-flow patterns

Outputs:
- projected daily balance
- shortfall risk
- surplus
- recommended transfer

---

# 28. Accounting Automation

## 28.1 Core workflow

```text
Connect accounting/ERP
 → import chart of accounts / dimensions
 → configure mapping/sync
 → configure coding rules + automation
 → transactions arrive
 → employee requirements
 → coding
 → review
 → Ready
 → sync/export
 → sync result/error
```

## 28.2 Primary queues

**[VERIFIED]**

```text
Waiting for Cardholder
Needs Review
Ready to Sync
Synced
```

## 28.3 Accounting fields

Examples:
- GL category/account
- department
- location
- class
- project
- subsidiary/entity
- customer/job
- vendor
- tax code
- amortization fields
- custom dimensions

Imported dimensions need stable external IDs.

## 28.4 Coding rule hierarchy

Recommended precedence matching public behavior:

1. Card/Spend-Program-specific rule
2. Advanced conditional rule (more specific wins)
3. Standard merchant/category/default mapping
4. AI suggestion where no authoritative user/rule value exists

Never let AI overwrite a user-confirmed or deterministic-rule value without explicit permission.

## 28.5 Advanced rule example

```text
IF
  merchant == "Zoom"
  AND department == "Engineering"
THEN
  GL = Software
  Department = Engineering
  MarkReady = true IF receipt_present AND requirements_complete
```

## 28.6 Splits

Support:
- percentage split
- fixed amount split

Validation:

```text
percentage_split:
  Σ(percent) == 100%

amount_split:
  Σ(split_amount) == transaction_amount
```

## 28.7 Accounting Agent

Capabilities:
- AI-code eligible fields
- suggest review actions
- smart groups
- auto-mark low-risk complete transactions Ready
- feedback learning
- preserve deterministic/user-entered data

Eligibility example:

```text
AI_MarkReady =
  cleared
  AND all_receipt_memo_requirements_met
  AND required_fields_complete
  AND in_policy
  AND coding_confidence_high
  AND amount <= configured_limit
```

## 28.8 Auto-sync

**[VERIFIED]** Ramp documents a nightly auto-sync process for eligible Ready card transactions.

Replica:

```text
nightly_sync_job:
  for tx in READY:
    if cleared
       and nonzero
       and unsynced
       and coding_complete
       and entity_mappings_complete:
         enqueueSync(tx)
```

Use per-entity idempotency keys and retries.

## 28.9 Journal effect examples

### Card purchase

```text
Debit  Expense/Asset
Credit Card Liability
```

### Statement payment

```text
Debit  Card Liability
Credit Cash/Bank
```

### Reimbursement

Model as payable + payment or provider-specific equivalent.

---

# 29. ERP / Accounting Integration Architecture

Connector interface:

```text
AccountingConnector:
  authenticate()
  import_dimensions()
  import_vendors()
  validate_mapping()
  sync_transaction()
  sync_bill()
  sync_payment()
  sync_statement_payment()
  sync_purchase_order()
  get_sync_status()
  retry()
```

Requirements:
- idempotency
- dependency ordering
- external IDs
- rate-limit handling
- retry/backoff
- sync audit
- failed-sync queue
- mapping version history

---

# 30. Reports / Insights

## 30.1 Real-time reporting

Unified spend should support:
- cards
- reimbursements
- bills
- POs/commitments where selected
- vendor
- department
- location
- entity
- category
- employee
- period
- policy status

## 30.2 Report builder

Components:
- metric
- dimensions/group-by
- filters
- date range
- chart/table
- sort
- drill-down
- export
- save
- dashboard
- share

## 30.3 Dashboard model

```text
Dashboard
  → SavedReport[]
      → QueryDefinition
      → Visualization
      → AccessMode
```

Access mode must support:
- viewer's own access
- delegated/shared data snapshot/access mode only when explicitly allowed

Sharing a report must not silently grant unrelated system permissions.

## 30.4 Reporting Agent

Natural-language query:

```text
"How much did Marketing spend this quarter vs last quarter?"
  → intent/schema selection
  → permission-scoped query plan
  → SQL/semantic-layer query
  → chart/table
  → natural-language insight
  → follow-up chat
```

The agent must:
- constrain queries to authorized rows/fields;
- show filters/date range;
- expose generated chart/table;
- let user save a normal report;
- support follow-ups.

---

# 31. Budgets

## 31.1 Budget dimensions

Budget can be organized by:
- department
- location
- entity
- project
- accounting field
- custom rollup

## 31.2 Budget record

- budget name
- period
- hierarchy
- dimension path
- owner
- amount
- currency
- thresholds
- notification recipients

## 31.3 Budget calculations

Recommended:

```text
actual_spend =
  Σ(eligible realized spend in period)

committed_spend =
  Σ(open approved commitments included by policy)

remaining_budget =
  budget_amount - actual_spend - committed_spend

actual_utilization_pct =
  actual_spend / budget_amount * 100

forecast_utilization_pct =
  (actual_spend + committed_spend + forecast_additions)
  / budget_amount * 100
```

**[REQUIRES VERIFICATION]** Exact Ramp inclusion/exclusion rules for each budget view and commitment state are product configuration dependent. Your clone must make this explicit and visible in metric definitions.

## 31.4 Budget-aware approval

At request time:

```text
projected_remaining =
  current_remaining_budget - requested_commitment
```

Workflow condition:
- no issue
- warning
- additional approval
- hard stop

---

# 32. Savings / Price Intelligence

Potential insight classes:
- duplicate SaaS/vendor spend
- overlapping subscriptions
- underused contracts/licenses
- missed rewards
- price benchmark opportunity
- contract renewal risk
- vendor consolidation
- out-of-policy leakage

Each insight should store:
- source facts
- calculation
- estimated savings
- confidence
- owner
- status
- accepted/dismissed outcome

Avoid showing estimated savings as realized savings until an actual outcome is recorded.

---

# 33. Receivables / Accounts Receivable

## 33.1 Current product scope

**[VERIFIED]** Ramp's current Receivables product is described as beta for eligible customers and includes:
- invoices
- customers
- products/services
- incoming payments
- collections agent
- cash application
- QBO synchronization

## 33.2 Onboarding

1. Check eligibility/role
2. Connect accounting where required
3. Import customers/products/open invoices
4. Configure payment methods
5. Configure invoice branding/template
6. Map AR/income/cash/holding accounts
7. Complete onboarding

## 33.3 Invoices page

States:
- Draft
- Processing
- Scheduled
- Open
- Partially Paid
- Paid
- Overdue
- Void

Columns:
- invoice #
- customer
- amount
- open balance
- issue date
- due date
- status
- delivery status
- payment method
- accounting sync
- created source

## 33.4 Create invoice manually

Fields:
- customer
- invoice #
- PO #
- payment terms
- invoice date
- due date
- payment methods
- line items
- memo
- footer
- recipients
- attachments

Invoice number must be unique within the business scope.

## 33.5 Receivables Intake Agent

Input:
- uploaded PO/document
- forwarded email/thread
- invoice/order source document

AI:
- match/create customer
- match/create product/service according to permissions
- extract line items
- infer terms from configured terms
- create draft

Critical rule:
**AI produces a draft; a human reviews before finalizing/sending.**

## 33.6 Delivery

Options:
- send now
- schedule for later
- finalize without sending

Payment methods can include configured rails such as:
- card through processor
- ACH debit
- ACH credit
- check

## 33.7 Collections Agent

```text
daily job
 → find open invoices with positive overdue balance
 → group by customer
 → create/update active Collection Case
 → apply Collections Policy cadence
 → prepare AI draft
 → user reviews/edits
 → user sends
```

Case fields:
- customer
- overdue invoice count
- total overdue balance
- days overdue
- state
- last update
- thread

Current default cadence publicly documented:
- 3 days overdue
- 10
- 17
- 24
- 31

Business can configure its own collection policy.

### Promise to pay

```text
promise.amount > 0
promise.date >= today

case.pause_until = promise.date
```

If not fulfilled, collection can resume.

## 33.8 Invoice reminders vs Collections

Pre-due reminder automation is separate from collection-case drafts. Preserve separate engines:
- invoice reminder scheduler
- overdue collections case engine

## 33.9 Cash Application AI

For newly observed positive bank transactions:

```text
Candidate payment
 → search open invoices
 → exact single-invoice balance match
 OR same-customer invoice combination whose balances exactly equal payment
 → if unique reliable match: create payment/application
 → else leave for manual review
```

Application constraint:

```text
apply_amount <= min(invoice_open_balance, payment_unapplied_amount)
```

Do not auto-process uncertain:
- partial allocations
- reversals
- chargebacks
- NSF
- refunds

## 33.10 AR accounting sync

Dependency order:

```text
Customer/Product
  → Invoice
      → Payment
      → Credit note/application
      → Deposit
```

Sync states:
- Not synced
- Sync in progress
- Synced
- Unable to sync
- Do not sync

Asynchronous, retriable, dependency-aware synchronization is required.

---

# 34. AI Token Spend Management

## 34.1 Purpose

Consolidate AI-provider usage/cost into finance visibility.

Potential provider connections include:
- OpenAI API
- ChatGPT enterprise usage
- Anthropic API / Claude enterprise usage
- Cursor
- Google Cloud Gemini/Vertex billing
- AWS Bedrock
- Fireworks
- additional providers through connector adapters

## 34.2 Pages

### Company AI Spend
Metrics:
- total token spend
- usage
- model
- provider
- API key
- user
- team/project
- cost per unit/tokens
- trend
- anomalies

### My AI Spend
Employee-scoped usage.

### Provider Connections
- provider
- credential status
- last sync
- permissions/scopes
- errors

### Spend Limits
- target API key/user/workspace
- threshold
- notification recipients
- hard/soft capability
- current spend

### Router
Optional centralized LLM routing/optimization layer.

## 34.3 Data sync

**[VERIFIED]** Current Ramp docs describe daily synchronization with T-1 freshness for AI Token Spend.

Pipeline:

```text
Provider API/Billing Export
 → normalized usage records
 → identity mapping
 → price/cost normalization
 → aggregates
 → limits/anomaly detection
 → reporting
```

## 34.4 Cost caveat

Do not assume estimated token consumption cost equals actual provider invoice cost.

Store both:
- `provider_reported_cost`
- `estimated_cost`
- `pricing_basis`
- `invoice_reconciled_cost`

## 34.5 Soft vs hard limits

Connector must expose capability:

```text
can_enforce_hard_limit(provider, product)
```

If provider API cannot stop usage:
- send alert
- optionally lock key only when provider supports it
- never display a soft notification threshold as guaranteed spending prevention

---

# 35. Ask AI / Ask Ramp Equivalent

## 35.1 Purpose

Persistent finance assistant available globally.

Functions:
- answer product-help questions
- answer account-specific questions
- find objects
- explain policy
- explain transaction
- approve a request when user is authorized
- update transaction fields when authorized
- create/request spend
- navigate user to relevant page

## 35.2 Conversation model

Every conversation:
- belongs to one user
- has title/date/latest message
- contains tool actions and outputs
- must not be visible to other users unless explicitly shared

## 35.3 Agent action safety

Before an action:

```text
1. Resolve user identity and effective permission
2. Resolve target resource
3. Validate current state
4. Produce action plan
5. Require confirmation for high-risk action if policy says so
6. Execute idempotently
7. Append audit event
8. Return result
```

Never grant the AI broader authority than the acting human.

---

# 36. Unified AI Agent Architecture

## 36.1 Agent catalog

| Agent | Primary job |
|---|---|
| Ask AI | Conversational search + authorized actions |
| Policy Agent | Expense-policy semantic review |
| Spend Request Agent | Request recommendation |
| AP Agent | Invoice/OCR/coding/fraud/AP policy/payment assistance |
| Accounting Agent | Coding + ready/sync recommendations |
| Reporting Agent | Natural-language analytics |
| Procurement Agent | Research/review/routing in procurement |
| Contract Agent | Extract/compare/summarize terms |
| AR Intake Agent | Convert documents/emails into invoice drafts |
| Collections Agent | Draft customer collection responses |
| Cash Application Agent | Match deposits to invoices |
| AI Spend Anomaly Agent | Detect token-spend anomalies |

## 36.2 Shared agent contract

```json
{
  "agent_run_id": "...",
  "agent_type": "...",
  "business_id": "...",
  "actor_user_id": "...",
  "resource_type": "...",
  "resource_id": "...",
  "policy_version": "...",
  "input_snapshot": {},
  "decision": "...",
  "confidence": null,
  "rationale": "...",
  "evidence": [],
  "recommended_actions": [],
  "executed_actions": [],
  "status": "...",
  "created_at": "..."
}
```

## 36.3 Grounding rules

Agents must be grounded in:
- organization policies
- current object data
- accounting schema
- permissions
- approved external knowledge sources
- relevant uploaded documents

Agent outputs should cite the exact policy/document/source section used.

## 36.4 Deterministic vs AI responsibilities

Use deterministic code for:
- arithmetic
- permissions
- money movement
- spend-limit enforcement
- workflow state transitions
- accounting balancing
- duplicate idempotency
- entitlement checks

Use AI for:
- extraction
- classification
- semantic policy interpretation
- summarization
- recommendation
- natural-language analytics
- document understanding
- low-risk prefill

This separation is critical for a reliable finance product.

---

# 37. Policy Center

## 37.1 Policy categories

Recommended:
- Travel & expenses
- Expense requirements
- Expense reviews
- Spend requests
- Reimbursements
- Travel
- Bill Pay
- Vendor management
- Procurement
- Receivables collections
- AI agent autonomy

## 37.2 Policy versioning

Every policy must have:
- draft
- published
- archived
- author
- published by
- published at
- diff
- effective period

Every decision should reference the policy version used at decision time.

---

# 38. Approval Workflow Engine

## 38.1 Why a shared engine is necessary

Do not implement separate hard-coded approvals inside Cards, AP, Procurement, Reimbursements, etc.

One workflow engine should serve all products.

## 38.2 Node schema

```text
Workflow
  id
  object_type
  version
  status

Node:
  type:
    CONDITION
    APPROVAL
    AGENT
    NOTIFY
    FORM
    WEBHOOK
    ACTION
  config
  next_edges
```

## 38.3 Approval selectors

Approver may resolve to:
- direct manager
- manager chain
- named user
- role
- finance admin
- entity owner
- department owner
- budget owner
- vendor owner
- requester's manager
- dynamic custom-field owner

## 38.4 Parallel / sequential approval

Support:
- sequential
- parallel all-must-approve
- any-one
- threshold/quorum
- conditional skip

## 38.5 Re-evaluation

If money/vendor/entity materially changes after approval, define whether:
- existing approvals remain valid,
- downstream steps reset,
- full workflow restarts.

This must be explicit per workflow.

---

# 39. Notifications

## 39.1 Channels

- in-app
- email
- SMS
- push
- Slack
- Microsoft Teams where integrated
- webhook

## 39.2 Notification classes

- transaction/receipt request
- missing item
- approval required
- approval reminder
- approved/rejected
- bill/payment failure
- card decline
- fraud alert
- budget threshold
- bank balance
- renewal reminder
- AI spend threshold
- collection draft/case
- sync failure

## 39.3 Preference model

Some legally/operationally mandatory messages cannot be turned off. Others are user-configurable.

```text
NotificationPreference(
  user,
  event_type,
  channel,
  enabled
)
```

---

# 40. Slack / Collaboration Integration

Supported finance actions should include:
- business alerts
- transaction feed
- request funds
- issue funds
- approve/edit/reject spend requests
- approve reimbursements
- approve/reject bills

All actions executed externally must:
- authenticate Slack identity → platform user
- re-run permissions
- store full audit event
- update the exact same workflow instance as web/mobile

No "separate Slack workflow state."

---

# 41. People / Identity / Provisioning

## 41.1 People page

Fields:
- name
- email
- status
- manager
- department
- location
- entity
- base role
- additional roles
- start date
- termination date
- cards/funds
- spend profile

Actions:
- invite
- edit
- suspend
- terminate
- resend invite
- issue spend
- reset/revoke sessions
- manage role
- transfer manager

## 41.2 Identity sources

- manual
- HRIS
- SCIM / IdP
- Slack import/draft
- API

## 41.3 Provisioning sync

Recommended ownership model:

```text
SourceOfTruth(user.field)
```

Examples:
- SCIM owns name/department/location/manager/role if configured.
- Finance app owns cards/funds/policies/accounting coding.

Conflicts must be resolved based on field ownership, not last-write-wins globally.

---

# 42. Security

Core:
- SSO
- SAML
- Google sign-in
- MFA
- session management
- role-based permissions
- encryption
- secure secret storage
- audit log
- entity/resource scope
- webhook signing
- integration credential vault

High-risk actions should support step-up authentication:
- bank detail changes
- tax document export
- payment release
- role elevation
- security setting changes
- sensitive bulk export

---

# 43. Audit Log

## 43.1 Event schema

```json
{
  "event_id": "...",
  "business_id": "...",
  "actor_type": "USER|SYSTEM|AGENT|INTEGRATION",
  "actor_id": "...",
  "affected_user_id": null,
  "resource_type": "...",
  "resource_id": "...",
  "action": "...",
  "old_value": {},
  "new_value": {},
  "metadata": {},
  "ip": null,
  "auth_method": null,
  "timestamp": "..."
}
```

## 43.2 Audit filters

- actor
- affected user
- object
- action
- date/time
- authentication
- acted-on-own-item
- sensitive changes

Audit events should be append-only and immutable to ordinary users.

---

# 44. Multi-Entity

## 44.1 Model

```text
Business
  ├─ Entity US
  ├─ Entity UK
  └─ Entity CA
```

Each entity may have:
- legal name
- jurisdiction
- currency
- bank accounts
- card issuing configuration
- payment rails
- tax info
- accounting mapping
- users/locations

## 44.2 Shared vs entity-scoped

Shared:
- business identity
- users
- global vendor identity
- policies where inherited
- reporting

Entity-scoped:
- legal/payment settings
- bank accounts
- issuing currency
- accounting mappings
- payment execution
- tax/legal information

Every transaction-like object must have an `entity_id`.

---

# 45. Multi-Currency / FX

Store at minimum:

```text
original_amount
original_currency
settled_amount
settled_currency
fx_rate
fx_rate_source
fx_rate_timestamp
```

Never overwrite original amount after conversion.

For policy checks involving base-currency thresholds:

```text
policy_base_amount =
  original_amount * historical_rate_at_spend_date
```

The exact rate source/rounding convention must be documented.

---

# 46. Statements & Card Payments

## 46.1 Statement

Contains card transactions belonging to the statement period.

Do not mix unrelated reimbursements/Bill Pay records into card statement calculation.

Fields:
- period start/end
- previous balance
- transactions
- credits
- statement balance
- due date
- payment status

## 46.2 Payment

Methods:
- linked bank/autopay
- manual allowed rail
- wire where supported
- early autopay

## 46.3 Early autopay

Trigger when configured capacity/utilization threshold is reached, subject to payment-state constraints.

**[REQUIRES VERIFICATION]** Credit underwriting, card capacity, account-review models, and exact risk formulas are private regulated financial infrastructure and cannot be cloned from public observation.

---

# 47. Disputes & Repayments

## 47.1 Dispute

Flow:

```text
Transaction
 → user selects dispute reason
 → eligibility validation
 → evidence
 → submit network/issuer dispute
 → status/event updates
 → outcome
```

## 47.2 Repayment

For accidental/personal company-card spend:

```text
Expense
 → repay full/partial
 → collect employee funds
 → settlement
 → link repayment to original transaction
 → accounting adjustment
```

Pending transaction repayment may be queued until final settlement.

---

# 48. Vendor Portal

Vendor-facing surface:

- invitation-based account
- profile/company info
- payment/tax details
- payment tracking
- bill/payment comments
- multiple payer visibility when supported
- account switcher

Vendor must not have access to payer's internal finance data beyond explicitly shared objects.

---

# 49. Advisor Console

For accounting/advisory firms managing multiple client books.

Recommended:
- client switcher
- client task status
- accounting queue
- close progress
- issue alerts
- restricted client-level permissions

**[REQUIRES VERIFICATION]** A complete Ramp Advisor Console page-by-page parity spec requires account access to that specific surface; public taxonomy confirms its existence but not every current screen.

---

# 50. Settings / Company Administration

Recommended sections:

```text
My settings
  Profile
  Notifications
  Security

Company
  Business profile
  People
  Departments
  Locations
  Entities
  Roles
  Custom fields
  Policies
  Approval workflows
  Cards & statements
  Bill Pay
  Accounting
  Banking
  Travel
  Receivables
  AI Token Spend
  Integrations
  Developer API
  Security
  Audit log
  Billing / plans
```

---

# 51. Integrations

## 51.1 Categories

Accounting/ERP:
- QBO
- Xero
- NetSuite
- Sage Intacct
- Workday
- Oracle
- Dynamics
- others

Identity:
- Okta
- Entra
- Google
- JumpCloud
- SCIM

Workflow:
- Slack
- Teams
- Jira
- Asana
- Linear

Security/procurement:
- Vanta
- Drata
- OneTrust
- e-signature

Travel:
- supported travel partners

Bank/data:
- bank aggregators/open banking providers

AI:
- AI usage providers

## 51.2 Integration connection

Every integration needs:
- provider
- auth method
- scopes
- owner
- status
- last sync
- last error
- sync cursor
- webhook subscriptions
- reconnect action
- disconnect behavior

---

# 52. Developer API

Provide OAuth2/client-credential apps with explicit scopes.

Example scopes:

```text
users:read
users:write
cards:read
funds:read
funds:write
transactions:read
vendors:read
bills:read
bills:write
payments:read
accounting:read
webhooks:manage
```

Requirements:
- scoped tokens
- secret rotation
- idempotency keys
- rate limits
- webhook signing
- audit
- pagination
- stable external IDs
- sandbox environment

---

# 53. Core Calculations Catalog

## CALC-001 Fund Buffer

```text
buffer_amount = configured_limit * buffer_percent / 100
```

Status: **[VERIFIED concept]**

## CALC-002 Fund Available Capacity

```text
available =
  base_period_limit
  + active_temporary_increase
  + applicable_buffer
  - cleared_period_spend
  - applicable_pending_holds
  + applicable_reversals
```

Status: **[REPLICA DESIGN / network details require verification]**

## CALC-003 Annualized Recurring Spend for Approval

```text
monthly → amount * 12
quarterly → amount * 4
weekly → amount * 52
```

Status: monthly annualization is **[VERIFIED]** in Ramp approval-rule documentation; extend other cadences only after product decision/testing.

## CALC-004 Mileage

```text
reimbursement =
  max(0, route_distance - commute_deduction)
  * applicable_rate
```

Status: **[REPLICA DESIGN based on supported behavior]**

## CALC-005 Per-Diem Remaining

```text
remaining = daily_limit - eligible_daily_spend
```

Status: **[REPLICA DESIGN]**

## CALC-006 Bill Remaining

```text
remaining =
  bill_total
  - settled_payments
  - applied_credits
```

Status: **[VERIFIED concept]**

## CALC-007 PO Remaining Commitment

```text
remaining_commitment =
  approved_po_total
  + approved_change_orders
  - matched_realized_spend
```

Status: **[REPLICA DESIGN]**

## CALC-008 Budget Remaining

```text
remaining_budget =
  budget
  - actual
  - included_commitments
```

Status: **[REPLICA DESIGN; exact inclusion policy configurable]**

## CALC-009 Budget Utilization

```text
utilization_pct = actual / budget * 100
```

Optionally expose forecast utilization separately.

## CALC-010 AR Invoice Open Balance

```text
open_balance =
  invoice_total
  - applied_payments
  - applied_credits
  + reversed_payments
```

## CALC-011 AR Payment Unapplied

```text
unapplied =
  payment_amount
  - Σ(active_invoice_applications)
```

## CALC-012 Collection Days Overdue

```text
days_overdue =
  max(0, current_local_date - due_date)
```

## CALC-013 FX Conversion

```text
converted =
  original_amount * fx_rate
```

Persist rate/source/time and rounding.

## CALC-014 Sourcing Weighted Score

```text
score = Σ(section_score * normalized_weight)
```

## CALC-015 AI Token Estimated Cost

```text
estimated_cost =
  Σ(input_tokens * input_rate
   + output_tokens * output_rate
   + provider_specific_usage_costs)
```

Use provider-reported actual cost when available and label estimates.

---

# 54. State Machine Catalog

## 54.1 Card Transaction

```text
AUTHORIZED/PENDING → CLEARED
AUTHORIZED/PENDING → REVERSED
ATTEMPT → DECLINED
CLEARED → DISPUTED
CLEARED → REFUND_CREDIT_LINKED
CLEARED → REPAYMENT
```

## 54.2 Expense

```text
MISSING_ITEMS
 → READY_FOR_REVIEW
 → APPROVED | REJECTED | CHANGES_REQUESTED | REPAYMENT_REQUIRED
```

## 54.3 Spend Request

```text
DRAFT → PENDING_APPROVAL → APPROVED | REJECTED
REJECTED → RESUBMITTED → PENDING_APPROVAL
```

## 54.4 Procurement Request

```text
DRAFT
 → PENDING_APPROVAL
 → APPROVED → OUTPUTS_CREATED
 → REJECTED → EDIT/RESUBMIT
```

## 54.5 Bill

```text
DRAFT
 → PENDING_APPROVAL
 → APPROVED
 → SCHEDULED
 → PROCESSING
 → PAID

PENDING_APPROVAL → REJECTED
PROCESSING → PAYMENT_FAILED
DRAFT/REJECTED → ARCHIVED
```

## 54.6 Payment

```text
UNSCHEDULED → SCHEDULED → RELEASE_REQUIRED → RELEASED
 → PROCESSING → SETTLED
                    ↘ FAILED
```

## 54.7 Accounting

```text
WAITING_FOR_CARDHOLDER
 → NEEDS_REVIEW
 → READY_TO_SYNC
 → SYNCING
 → SYNCED
     ↘ SYNC_FAILED → retry
```

## 54.8 Contract

```text
DRAFT → ACTIVE → RENEWAL_DUE
ACTIVE → EXPANSION_IN_PROGRESS
RENEWAL_DUE → RENEWED | WILL_NOT_RENEW
RENEWED → successor ACTIVE contract
```

## 54.9 AR Invoice

```text
DRAFT/PROCESSING
 → SCHEDULED or OPEN
OPEN → PARTIALLY_PAID → PAID
OPEN → OVERDUE
OPEN/PARTIALLY_PAID → VOID (when allowed)
```

## 54.10 Collection Case

```text
ACTIVE_NEEDS_ATTENTION
 ↔ WAITING_ON_CUSTOMER
 → PAUSED
 → CLOSED

PROMISE_TO_PAY → PAUSED_UNTIL_DATE
```

---

# 55. Cross-Module Synchronization Matrix

| Trigger | Source | Downstream effects |
|---|---|---|
| User added | People | role access, manager hierarchy, card eligibility, approval resolution |
| Fund issued | Manage Spend | Home wallet, card authorization, expense policy, reporting |
| Card transaction authorized | Card network | fund availability, transaction page, notifications |
| Transaction clears | Cards | expense requirements, policy agent, accounting, vendor spend, reporting, budget |
| Receipt matched | Expenses | requirement completion, Policy Agent re-evaluation, accounting readiness |
| Expense approved | Expense | accounting/review completion, audit/reporting |
| Spend request approved | Requests | fund/card creation and/or PO, notifications, commitment |
| Procurement request approved | Procurement | PO/card/contract/vendor outputs |
| Vendor payment detail changed | Vendors | Bill Pay routing after approval/verification |
| Bill approved | AP | payment scheduling/release eligibility, budget/reporting |
| Payment settled | AP | Bill status, vendor spend, accounting, cash position |
| PO matched to bill | Procurement/AP | commitment reduction, variance, approval context |
| Contract renewal approved | Contracts | successor contract, linked PO/request, reminders |
| Travel booking made | Travel | Trip, receipt, expense, policy, card linkage |
| Reimbursement approved | Expenses | payout, accounting, budget/reporting |
| Accounting sync succeeds | Accounting | synced status, audit |
| Budget upload | Budgets | request-time budget checks and reports |
| Bank feed transaction arrives | Banking/AR | cash balance, cash application candidate |
| AR payment applied | Receivables | invoice balance/status, collections state, accounting |
| AI usage sync | Token Spend | dashboard, anomaly/limit checks |
| Policy published | Policy | new evaluations/use by future workflows; version link |
| Entity config changed | Company | payment/currency/accounting scope validation |

---

# 56. Event-Driven Backbone

Recommended event types:

```text
user.created
user.updated
fund.created
fund.limit.changed
card.authorization.created
card.transaction.cleared
receipt.matched
expense.requirements.completed
expense.policy.assessed
expense.approved
spend_request.submitted
spend_request.approved
procurement_request.approved
po.created
vendor.created
vendor.payment_details.changed
bill.created
bill.approved
payment.released
payment.settled
contract.renewal_due
travel.booking.created
reimbursement.approved
accounting.ready
accounting.synced
bank_transaction.created
ar_invoice.sent
ar_invoice.overdue
ar_payment.received
ar_payment.applied
ai_usage.synced
policy.published
```

Consumers must be idempotent.

---

# 57. Suggested Technical Architecture

## 57.1 Frontend

- Next.js / React
- TypeScript
- server-rendered navigation where useful
- query caching
- virtualized data tables
- command palette/global search
- document/receipt viewer
- workflow builder
- analytics charts
- mobile-responsive employee flows

## 57.2 Backend services

```text
API Gateway / BFF
Auth & Identity Service
Organization / RBAC Service
Spend & Card Service
Transaction Service
Expense Service
Policy Service
Workflow/Approval Service
Reimbursement Service
Travel Service
Procurement Service
Vendor Service
Contract Service
Bill Pay Service
Payment Orchestration Service
Receivables Service
Banking/Treasury Service
Accounting Service
Reporting/Budget Service
AI Token Spend Service
AI Agent Orchestrator
Document/OCR Service
Search Service
Notification Service
Integration Service
Audit Service
```

## 57.3 Infrastructure

- PostgreSQL for transactional domain data
- event broker (Kafka/Pulsar/SNS+SQS/Rabbit depending scale)
- Redis for cache/locks/job leases
- object storage for documents
- warehouse/lakehouse for analytics
- search index for global search
- vector store/index for policy/document grounding where needed
- durable workflow engine such as Temporal or equivalent
- secret manager/KMS
- observability stack
- feature-flag service

## 57.4 Finance correctness rule

Never treat an LLM response as a financial ledger update by itself.

Money/state writes must pass deterministic service validation.

---

# 58. Suggested Database Boundaries

Do not put the entire product into one giant polymorphic table.

Recommended domains/schemas:

```text
identity.*
org.*
spend.*
cards.*
expenses.*
policy.*
workflow.*
travel.*
procurement.*
vendors.*
ap.*
ar.*
banking.*
accounting.*
analytics.*
ai.*
integrations.*
audit.*
```

Use UUIDs and immutable external-provider IDs.

Money:
- use decimal/numeric, never float
- store currency with amount
- define precision per currency/rail

---

# 59. Core APIs for an MVP-to-Full Replica

## Identity
```text
POST /users
PATCH /users/:id
POST /roles
POST /users/:id/roles
GET  /permissions/effective
```

## Spend
```text
POST /funds
PATCH /funds/:id
POST /funds/:id/lock
POST /funds/:id/increase-requests
POST /spend-programs
POST /spend-requests
POST /spend-requests/:id/submit
```

## Expense
```text
GET  /transactions
GET  /transactions/:id
POST /transactions/:id/receipts
PATCH /transactions/:id/coding
POST /expenses/:id/approve
POST /expenses/:id/reject
POST /expenses/:id/repay
```

## Policy
```text
POST /policies
POST /policies/:id/publish
POST /policy-assessments
```

## Procurement
```text
POST /procurement/requests
POST /procurement/programs
GET  /purchase-orders
POST /purchase-orders/:id/change-orders
```

## AP
```text
POST /bills/intake
POST /bills
POST /bills/:id/approve
POST /bills/:id/payments
POST /payment-runs
POST /payments/:id/release
```

## Vendor/Contract
```text
POST /vendors
POST /vendor-requests
POST /contracts
POST /contracts/:id/renewal-request
```

## Accounting
```text
POST /accounting/connections
POST /accounting/rules
POST /accounting/records/:id/ready
POST /accounting/sync
```

## AR
```text
POST /ar/invoices
POST /ar/invoices/:id/send
POST /ar/payments
POST /ar/payments/:id/applications
GET  /ar/collections/cases
```

## AI
```text
POST /ai/chat
POST /ai/agents/:agent/run
POST /ai/decisions/:id/feedback
```

---

# 60. Page-by-Page Master Inventory

The following is the recommended complete replica surface inferred from current public Ramp product scope.

| Area | Page | Primary job |
|---|---|---|
| Setup | Setup Guide | Track onboarding/configuration progress |
| Home | Overview | Metrics, tasks, cards/funds, notices |
| Home | Inbox | Cross-product approval queue |
| Home | My Expenses | Employee expense list/actions |
| Home | My Travel | Employee trips/search/bookings |
| Home | My AI Spend | Personal AI usage/spend |
| Insights | Reports | Build/filter/share/export reports |
| Insights | Dashboards | Saved collections of reports |
| Insights | Budgets | Budget vs actual/commitment |
| Insights | Savings | Savings opportunities |
| Manage Spend | Funds & Cards | Issue/control cards and funds |
| Manage Spend | Programs | Spend/procurement templates |
| Manage Spend | Requests | Spend/procurement requests |
| Manage Spend | Purchase Orders | Manage approved POs |
| Manage Spend | Tokens | AI provider spend |
| Expenses | Card Transactions | Company/team transactions |
| Expenses | Reimbursements | Submit/review/pay reimbursements |
| Travel | Overview | Travel analytics |
| Travel | Trip Management | Trips, requests, travelers |
| Travel | Search/Booking | Flights/hotels/cars |
| Bill Pay | Bills | Draft→approval→payment lifecycle |
| Bill Pay | Payments | Payment-level execution |
| Bill Pay | Payment Runs | Batch release |
| Bill Pay | AP Inbox | Connected invoice email workflow |
| Receivables | Invoices | Create/send/manage invoices |
| Receivables | Customers | Customer master |
| Receivables | Products & Services | Sellable lines/catalog |
| Receivables | Payments | Incoming/cash application |
| Receivables | Collections | Overdue cases + AI drafts |
| Banking | Accounts | Cash accounts/balances |
| Banking | Transactions | Bank activity |
| Banking | Transfers | Move cash |
| Banking | Automations | Recurring/target-balance rules |
| Banking | Investment | Managed idle-cash investment |
| Accounting | Overview/Queues | Close workflow |
| Accounting | Coding Rules | Deterministic coding |
| Accounting | Automation | AI coding/ready/sync |
| Accounting | Sync Settings | ERP mappings |
| Accounting | Accounting Fields | COA/dimensions |
| Vendors | Vendor List | Vendor master |
| Vendors | Vendor Detail | Spend/bills/contracts/docs |
| Vendors | Vendor Requests | Onboarding/change approvals |
| Vendors | Contracts & Renewals | Lifecycle/reminders |
| Vendors/Procurement | Sourcing | RFI/RFP/RFQ |
| Policy | T&E Policy | Expense semantic/deterministic policy |
| Policy | Expense Requirements | Receipt/memo/field requirements |
| Policy | Expense Reviews | Approval workflow |
| Policy | Spend Request Approval | Pre-spend approval |
| Policy | Vendor Policy | Vendor creation/change rules |
| Policy | Procurement Workflows | Intake workflow |
| Policy | AP Policy | Invoice/bill checks |
| Ask AI | Conversations | Conversational finance assistant |
| Company | People | User lifecycle |
| Company | Departments | Org dimension |
| Company | Locations | Org dimension |
| Company | Entities | Legal/business entities |
| Company | Roles | RBAC |
| Company | Integrations | Connected systems |
| Company | Security | SSO/MFA/session |
| Company | Developer API | OAuth/apps/API |
| Company | Audit Log | Action/history log |
| Company | Notifications | Preferences |
| Vendor Portal | Portal | Vendor profile/payment tracking |
| Advisor | Console | Multi-client accounting workflow |

Some pages/tabs are entitlement-, role-, geography-, or product-version-specific.

---

# 61. Screen / Component Design Language Observed

**[VIDEO]** Product tour indicates a dense but restrained finance UI:

- light neutral background
- compact left navigation
- small typography
- high information density
- cards with thin borders
- right-side contextual drawers
- split-pane approval/review experiences
- high-visibility action color for primary CTA
- status chips
- compact tables
- tooltips/product-tour overlays
- embedded AI recommendation cards
- document preview beside structured fields
- activity timelines

For your replica:
- retain interaction efficiency and density;
- do not copy Ramp's trademarked visual assets/copy;
- create your own design system.

---

# 62. UX Rules

1. User should rarely lose context when opening detail — prefer drawers/split panes.
2. Approval actions must stay visible.
3. AI recommendation must be adjacent to the human decision.
4. Explain exactly why a deterministic rule or AI decision fired.
5. Every money state must show status and timestamps.
6. Every background sync must expose status/error/retry.
7. Tables must support filtering, sorting, export where permission allows.
8. Current user scope must be obvious.
9. Critical fields need audit history.
10. Bulk actions need selection count and confirmation.
11. Destructive actions need reversible patterns where possible; otherwise explicit irreversible warning.
12. Empty states should include setup path.

---

# 63. Entitlements / Packaging

Model product access via capabilities rather than scattered plan-name checks.

Example:

```text
capability.policy_agent
capability.advanced_workflows
capability.budgets
capability.audit_log
capability.procurement
capability.contract_renewal_workflows
capability.accounting_agent
capability.payment_runs
capability.ai_token_limits
capability.multi_entity
capability.custom_roles
```

Plan definitions map to capabilities.

This lets pricing/package evolve without rewriting product logic.

---

# 64. Background Jobs

Minimum durable jobs:

- transaction settlement ingest
- receipt match
- OCR
- Policy Agent assessment
- missing-item reminders
- approval reminders
- statement generation
- payment scheduling/execution
- AP email ingestion
- bill OCR/coding/fraud checks
- accounting auto-sync
- contract renewal reminders
- travel itinerary ingestion
- bank transaction sync
- cash forecast
- AR invoice delivery
- AR pre-due reminders
- AR collections daily check
- AR cash application
- AI provider usage sync
- anomaly detection
- report materialization
- integration reconciliation
- audit retention/export

Every job must support:
- idempotency
- retry
- dead-letter handling
- observability
- business/entity scoping

---

# 65. Data Freshness Requirements

Suggested SLAs:

| Data | Target |
|---|---|
| Card authorization | seconds |
| Card transaction visibility | near real time |
| Spend limit effect | seconds |
| Approval state | near real time |
| Receipt upload | seconds |
| OCR | seconds to minutes |
| Policy assessment | seconds/minutes |
| AP OCR | seconds/minutes |
| Bank feed | provider dependent |
| ERP sync | near real time/asynchronous |
| Analytics | seconds/minutes |
| AI Token Spend | provider sync cadence; current Ramp docs describe T-1 daily |
| Collections scan | daily |
| Contract reminders | scheduled |

---

# 66. Error & Edge-Case Matrix

## Spend/cards
- card locked during authorization
- fund reaches limit
- overlapping recurring periods
- reversed authorization
- partial settlement
- duplicate network event
- incorrect merchant category
- FX final amount differs from authorization

## Expense
- receipt duplicated
- receipt unreadable
- transaction never clears
- employee terminated with missing items
- policy changes during review
- approver is requester
- reviewer unavailable

## AP
- duplicate invoice
- changed vendor bank details
- bill amount changes after approval
- payment fails
- partial payment
- payment sent twice
- PO overbilling
- closed accounting period

## Procurement
- workflow edited in flight
- vendor already exists
- request duplicates contract renewal
- amount changes after legal/security approval
- PO currency differs from invoice

## Travel
- fare changes during approval
- cancellation/refund
- off-platform booking
- traveler changes entity
- itinerary changes

## AR
- duplicate invoice #
- partial payment
- overpayment
- payment matches multiple invoices
- chargeback/refund
- imported invoice dependency missing
- customer without email
- disconnected collection inbox

## Accounting
- missing mapping
- deleted dimension
- duplicate sync
- provider outage
- closed period
- stale OAuth
- external object modified

---

# 67. Non-Functional Requirements

## Reliability
- payment/card critical paths designed for high availability
- exactly-once business effect via idempotency, not assumption of exactly-once messaging

## Security
- least privilege
- immutable audit
- encryption in transit/at rest
- secrets in vault
- step-up auth

## Performance
- navigation under ~2s target under normal conditions
- table query pagination/virtualization
- async long-running work
- cached aggregate metrics

## Accessibility
- keyboard navigation
- focus management
- WCAG-oriented contrast/labels
- screen-reader labels

## Internationalization
- locale
- timezone
- currency
- decimal/date format
- entity jurisdiction

## Observability
- distributed tracing
- correlation IDs across event/workflow/payment/integration
- business-visible operational status

---

# 68. Compliance / Regulated Infrastructure Boundary

To reproduce the product commercially, software alone is not enough.

You will need separate regulated/partner work for:
- card issuing
- card network sponsorship
- KYC/KYB
- sanctions screening
- AML obligations as applicable
- money transmission/payment orchestration
- ACH/wire/check rails
- bank accounts/treasury products
- investment products
- fraud/dispute handling
- PCI DSS scope
- data/security compliance
- privacy/retention
- country-by-country financial regulation

**Do not implement a fake "bank" or "card network" ledger and treat it as real money movement.** Use licensed partners and provider adapters.

---

# 69. Recommended Build Order

## Phase 1 — Platform Foundation
- auth
- organization
- user/roles
- entities
- departments/locations
- audit
- notifications
- workflow engine
- policy model
- integration framework

## Phase 2 — Spend & Expense Core
- funds/cards abstraction
- Spend Programs
- requests
- transactions
- receipts
- expense requirements
- approvals
- reimbursements
- Policy Agent

## Phase 3 — Accounting
- dimensions
- coding
- rules
- ERP connectors
- accounting queues
- Accounting Agent

## Phase 4 — AP + Vendors
- vendors
- documents
- bills
- OCR/AP Agent
- approvals
- payments
- payment release/runs

## Phase 5 — Procurement & Contracts
- procurement requests
- workflow builder
- PO
- sourcing
- contracts/renewals
- vendor onboarding

## Phase 6 — Travel
- policies
- booking-provider integration
- trips
- travel admin/reporting
- per diem

## Phase 7 — Reporting/Budget
- semantic data model
- real-time reports
- dashboards
- budgets
- Reporting Agent
- savings

## Phase 8 — Treasury
- accounts
- cash movement
- automations
- forecasting
- investment partner integration

## Phase 9 — Receivables
- invoices
- customers/products
- Intake Agent
- payments/cash application
- Collections Agent
- QBO/ERP sync

## Phase 10 — AI Spend + Global Assistant
- provider usage connections
- limits/anomalies
- Ask AI
- action tools
- agent governance

---

# 70. "Exact Replica" Gap Register

The following cannot be truthfully reconstructed exactly from public observation and require your own product/partner specification.

## Critical gaps

### Proprietary card underwriting / credit limits
Exact risk formula is not public.

### Fraud/risk scoring
Public behavior is visible; model features/weights/thresholds are private.

### Card-network authorization internals
Depends on issuer/network processor.

### Bank/treasury partner behavior
Settlement/funds-availability rules depend on partners.

### AI prompts/model routing/confidence thresholds
Product behavior is visible; internal prompts/model stack are not public.

### Travel inventory/pricing contracts
Requires GDS/TMC/travel provider commercial integrations.

### Accounting connector edge cases
Provider/version/customer configuration affects exact sync behavior.

## Important gaps requiring authenticated product access for pixel-level parity

- every current admin setting subpage
- every plan/geography-specific tab
- every role-specific empty/error state
- full Advisor Console
- all enterprise-only workflows
- all mobile-only screens
- issuer-specific disputes and statement variants
- all 200+ integration-specific settings

For these areas, this document defines the target system behavior but not a claim of hidden Ramp internals.

---

# 71. QA Acceptance Strategy

For each module build:

1. happy-path E2E
2. permission tests
3. state-transition tests
4. formula tests
5. integration failure tests
6. concurrent update tests
7. idempotency tests
8. audit tests
9. AI-grounding tests
10. downstream synchronization tests

## Example: expense approval

```gherkin
Given a cleared card transaction
And the receipt requirement is satisfied
And all required accounting fields are present
And Policy Agent recommends approval
And the workflow allows agent auto-approval below the configured threshold
When the policy assessment completes
Then the expense may move to Approved
And the Policy Agent rationale and policy version are stored
And an audit event is written
And the transaction becomes eligible for accounting Ready evaluation
And dashboard/reporting state updates
```

## Example: spend request

```gherkin
Given an employee requests recurring monthly spend
When the workflow contains an annualized amount threshold
Then the request must be evaluated using the configured annualization logic
And a requester must not approve their own request when separation of duties is enabled
And approval must create only the configured outputs
```

## Example: AR cash application

```gherkin
Given a positive bank transaction of 1,000
And one open invoice for the same customer has exactly 1,000 remaining
When cash application runs
Then it may create/apply the payment
But if multiple ambiguous invoice combinations match
Then it must leave the transaction for manual review
```

---

# 72. Replication Readiness Score

Based on current public research + supplied video:

| Area | Confidence |
|---|---:|
| Product/module map | 95% |
| Main web navigation/concepts | 90% |
| Cards/funds/spend workflows | 95% |
| Expenses/policy/receipt flows | 95% |
| Bill Pay/AP flow | 95% |
| Procurement/PO/vendor flow | 92% |
| Accounting flow | 95% |
| Reporting/budgets | 90% |
| Travel | 88% |
| Contracts/vendor management | 92% |
| Receivables current beta flow | 93% |
| AI Token Spend | 93% |
| AI agent behavior at product level | 92% |
| Treasury/banking product-level flow | 85% |
| Role/permission concepts | 92% |
| Exact hidden financial/risk algorithms | 20% |
| Exact proprietary AI internals | 20% |
| Pixel-perfect all authenticated pages | 65% without access to every entitlement/role |

**Overall functional-replica product understanding:** approximately **90%+ at product/workflow level**, with the major uncertainty concentrated in private regulated infrastructure, private AI/risk internals, and authenticated/entitlement-specific screens.

---

# 73. Master End-to-End Flow

The product can be summarized as one connected operating cycle:

```text
COMPANY SETUP
  Business
  → Entities
  → People/Roles
  → Departments/Locations
  → Policies
  → Approval Workflows
  → Accounting
  → Bank/Payment Connections
  → Integrations

PRE-SPEND
  Employee need
  → Request / Spend Program / Procurement Program
  → Policy + Budget + AI context
  → Approval
  → Card/Fund/PO/Contract/Vendor outcome

SPEND
  Card authorization / Travel / Reimbursement / Invoice
  → transaction/document captured
  → receipt/OCR
  → vendor identity
  → policy check
  → accounting coding
  → human/AI review

PAY
  Card statement / Reimbursement / Bill
  → approval
  → payment authorization/release
  → rail execution
  → settlement

ACCOUNT
  coding
  → Ready
  → ERP sync
  → reconcile
  → close

ANALYZE
  reports
  → budgets
  → savings
  → token spend
  → cash/treasury
  → AI insights

ORDER-TO-CASH
  customer
  → invoice
  → reminder/collections
  → incoming payment
  → cash application
  → accounting

CONTINUOUS GOVERNANCE
  audit
  + permissions
  + policies
  + notifications
  + integrations
  + AI evidence
```

This is the architecture that makes a Ramp-style product coherent rather than a collection of independent finance pages.

---

# 74. Recommended Definition of Done for Your Product

Do **not** call the replica complete just because all pages exist.

A module is complete only when:

- UI exists;
- all role states work;
- create/edit/delete/approve flows work;
- state machine is enforced;
- formulas are covered by tests;
- downstream events synchronize;
- audit is written;
- notifications fire;
- permission checks exist server-side;
- accounting impact is defined;
- AI decisions are grounded and explainable;
- background jobs are idempotent;
- integration failures are visible and retryable;
- reporting reflects the correct data;
- edge cases are tested.

---

# 75. Source Notes — Official Ramp Material Reviewed

This blueprint was synthesized from current Ramp public material, including:

- Ramp homepage — https://ramp.com/
- Products — https://ramp.com/products
- Product releases — https://ramp.com/product-releases
- Product demo — https://ramp.com/view-demo
- Expense management — https://ramp.com/expense-management
- Travel — https://ramp.com/travel
- Ramp Help Center — https://support.ramp.com/
- Ramp overview — https://support.ramp.com/ramp-overview/
- Cards / controls / statements documentation
- Spend Programs documentation
- Spend-request approvals documentation
- Expense requirements/review documentation
- Policy Agent documentation
- Reporting Agent documentation
- Accounting and Accounting Agent documentation
- Bill Pay / AP Agent / payment-runs / partial-payment documentation
- Procurement quick-start, purchase-order, sourcing, and agent documentation
- Vendor management / contracts & renewals documentation
- Banking / treasury / automation documentation
- Receivables invoice, Collections Agent, cash application, and QBO synchronization documentation
- AI Token Spend Management documentation
- Roles, audit log, security, identity, Slack, API, and integration documentation
- Uploaded Ramp product-tour screen recording supplied by the user

Because Ramp ships frequently, feature names, packaging, eligibility, and exact navigation can change. Treat this document as a **2026-09-14 research snapshot** and version future implementation against a dated source baseline.

---

# 76. Final Product Principle

If you want your SaaS to feel like Ramp, the most important thing is **not copying a dashboard**.

The real system is:

```text
A shared graph of finance objects
+ pre-spend controls
+ workflow automation
+ deterministic accounting/payment rules
+ deeply linked operational data
+ permission-aware AI agents
+ real-time auditability
```

Build that platform layer first. Once that foundation is correct, the individual pages become views and workflows over one coherent financial operating system.

