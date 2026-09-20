# AI-Powered Financial Operations SaaS
## Complete Product Design Specification — Verified V3: Product, UX, Workflows, RBAC, AI & Platform Architecture

**Document type:** Product Design Specification (PDS) + UX Information Architecture + Functional PRD  
**Product model:** Ramp-style AI-powered financial operations SaaS  
**Primary surfaces:** Responsive Web Portal + iOS/Android Mobile App  
**Audience:** Product, UX/UI, Frontend, Backend, Mobile, QA, DevOps, Security, Data, AI/ML  
**Status:** Verified V3 / research-corrected / product-design optimized implementation blueprint  
**Verification date:** 2026-09-15  
**Verification basis:** Uploaded Ramp product videos + current Ramp Help Center + current Ramp product pages + current Ramp product releases  
**Source precedence:** Current official Help Center/product documentation overrides older/demo video behavior where the two differ.

> **Important:** This document describes a Ramp-style replica based on externally observable and publicly documented behavior. It must not claim undocumented internal underwriting formulas, fraud-model weights, card-network internals, proprietary AI prompts, or private issuer/bank rules as exact Ramp behavior. Those items are represented as implementation-equivalent requirements and must remain configurable.

---

# 1. Product Definition

## 1.1 What this product is

This product is an **AI-powered financial operations platform for businesses**, modeled on the current externally observable Ramp product suite.

The platform unifies the financial workflows that otherwise live in separate tools:

- corporate physical and virtual cards;
- Spend Programs / Funds / spend limits;
- pre-spend requests;
- employee expenses and receipt collection;
- reimbursements;
- accounts payable / Bill Pay;
- procurement and purchase orders;
- vendor onboarding and vendor management;
- contracts, renewals, expansions, and sourcing;
- travel booking and travel policy enforcement;
- accounting automation and ERP synchronization;
- budgets, reporting, savings, Price Intelligence, and license intelligence;
- business banking / treasury;
- accounts receivable / Receivables;
- AI Token Spend Management;
- AI model routing / Router;
- company rewards / cashback;
- multi-entity and global operations;
- integrations;
- users, permissions, policies, approvals, security, and audit;
- Ramp-style AI / Intelligence agents embedded throughout workflows;
- AI spreadsheet / financial-model workspace equivalent to Ramp Sheets;
- AI-agent identities and agent-native payments equivalent to Ramp for Agents;
- staged/draft employee onboarding and publishing;
- tax operations including 1099 preparation, filing, delivery, and corrections where legally applicable;
- developer platform including OAuth, API scopes, webhooks, sandbox, and developer diagnostics;
- disputes, chargeback evidence, provisional credits, repayments, and card-risk operations;
- country-by-country capability controls for cards, reimbursements, Bill Pay, treasury, accounting, and taxes.

### Additional Ramp product surfaces that were missing or under-specified in the previous draft

The replica scope should also account for these current Ramp surfaces where relevant:

1. **Vendor Portal** — an external vendor-facing experience for payment/tax information, bill communication, and payment tracking.
2. **Advisor Console** — an accounting-firm/partner console for managing multiple Ramp clients, staff access, reporting, close projects/checklists, billing, Price Intelligence, and related partner workflows.
3. **Stack** — Ramp's AI accounting operating system for bookkeeping, month-end close, reconciliations, reusable accounting skills/instructions, and financial-statement generation. Current public documentation states Stack currently focuses on QuickBooks Online and straightforward bookkeeping workflows.
4. **AI Token Spend Management + Router** — visibility and controls over provider/model/user/API-key AI usage, plus an OpenAI-compatible model-routing gateway that can route across models/providers based on cost, quality, latency, and availability.
5. **Rewards / Cashback** — company-level cashback and partner rewards, with redemption paths such as card balance reduction, Ramp Checking, subscription/fee payment, loyalty points, gift cards, and charities where supported.

6. **Ramp Sheets / Financial Modeling Workspace** — an AI-native spreadsheet editor that can ingest Excel/CSV/PDF/bank-statement-style data, create and repair formulas, build financial models, perform web research, answer questions over workbook data, and apply professional formatting. Current public material supports file download/sharing; do **not** assume Google-Sheets-style real-time collaboration unless separately enabled and verified.
7. **Ramp for Agents / Agent Finance** — durable AI-agent identities with a human owner, budgets, merchant/policy restrictions, approved payment capabilities, and a complete audit trail. Current Ramp public material advertises card, ACH, wire, check, agent-native rails, and API/MCP/CLI connectivity.
8. **Draft User Onboarding** — staged employee creation before invitation, including manager chains, groups, Spend Programs, approval workflows, org attributes, and approval matrices.
9. **Tax Operations / 1099** — vendor eligibility, W-9/TIN collection, TIN checks, 1099-NEC/MISC mapping, e-delivery consent, filing, mail/electronic delivery, corrections, and state-filing support boundaries.
10. **Developer Platform** — OAuth 2.0 apps, scoped API access, sandbox tenants, OpenAPI, pagination/rate limits, signed webhooks, retries, developer logs, and trace IDs.
11. **Dispute & Repayment Operations** — dispute initiation, evidence, network-review lifecycle, provisional credit handling, card lock/reissue, repayment, refunds, and accounting impact.

## 1.2 Core design principle

The system must **not** be implemented as disconnected finance modules.

Every major financial event should share the same organizational and control graph:

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

This shared model is the fundamental reason the product behaves as one financial operating system rather than separate card, AP, travel, and procurement tools.

## 1.3 Source-status labels used in this document

Where a feature is important for parity, use one of these labels:

- **VERIFIED-CURRENT** — supported by current official Ramp documentation.
- **VIDEO-OBSERVED** — visibly demonstrated in an uploaded Ramp video.
- **PLAN/ADD-ON** — available only on specific plans/add-ons according to current Ramp documentation.
- **BETA / ALPHA / EARLY ACCESS** — current Ramp documentation identifies the feature as limited-release.
- **ROADMAP / DEMO ONLY** — shown or discussed in a demo but not established as generally available in current documentation.
- **IMPLEMENTATION EQUIVALENT** — required in our replica architecture, but Ramp's private implementation is not publicly documented.

---

# 2. Product Mental Model

The main company money flow is:

```text
Company
  ↓
Bank / Treasury / Credit Capacity
  ↓
Budget
  ↓
Spend Program
  ↓
Employee / Team / Vendor Spend Authority
  ↓
Physical Card / Virtual Card / Bill / Reimbursement / Travel / PO
  ↓
Transaction or Payment
  ↓
Receipt / Invoice / Supporting Document
  ↓
Policy Check
  ↓
Approval
  ↓
Accounting Coding
  ↓
ERP Sync
  ↓
Dashboard / Reporting / Audit
```

The product therefore manages three major financial phases:

### Before Money Is Spent
- budgets;
- spend programs;
- spend requests;
- procurement;
- approvals;
- card/fund limits;
- policy controls.

### While Money Is Being Spent
- physical cards;
- virtual cards;
- vendor payments;
- travel booking;
- purchase orders;
- banking transfers.

### After Money Is Spent
- receipts;
- expense review;
- reimbursements;
- policy verification;
- accounting coding;
- reconciliation;
- reporting;
- audit.

---

# 3. Product Surfaces

The system will have two primary user-facing applications.

## 3.1 Web Portal

The Web Portal is the **administrative and financial control center**.

Best suited for:

- Finance;
- Accounting;
- Accounts Payable;
- Procurement;
- Treasury;
- AR;
- Admin;
- IT;
- HR;
- senior managers;
- reporting users.

The Web Portal contains the full product.

## 3.2 Mobile App

The Mobile App is the **employee action and approval application**.

Best suited for:

- cardholders;
- employees;
- managers;
- approvers;
- travelers;
- executives;
- finance approvers.

Primary mobile jobs:

- see available funds;
- view card;
- freeze/unfreeze card;
- capture receipts;
- submit expenses;
- create spend requests;
- submit reimbursements;
- approve/reject items;
- manage travel;
- receive notifications;
- use the AI assistant.

Complex configuration remains primarily web-based.

---

# 4. User Types / Personas

The product should use **additive roles plus data scopes**, not one fixed role per user.

A person may be:

```text
Finance Admin
+ AP Approver
+ Manager
+ Entity A access
```

at the same time.

---

## 4.1 Business Owner / Account Owner

Highest business authority.

Responsibilities:

- company setup;
- legal entity setup;
- administrators;
- bank/payment setup;
- card program;
- security;
- company-wide policy;
- billing;
- highest-risk approval actions.

Typical access:

- all entities;
- all finance modules;
- admin;
- security;
- audit;
- integrations.

---

## 4.2 Platform / Business Admin

General administrative user.

Responsibilities:

- users;
- departments;
- locations;
- policies;
- spend configuration;
- cards;
- settings;
- operational administration.

Does not automatically need unrestricted access to highly sensitive treasury or security actions unless granted.

---

## 4.3 Finance Admin

Primary finance operations persona.

Responsibilities:

- spending controls;
- cards/funds;
- expenses;
- approvals;
- budgets;
- vendors;
- bills;
- reporting;
- finance policy.

Usually has broad financial visibility.

---

## 4.4 Controller / Accounting Admin

Owns accounting correctness.

Responsibilities:

- transaction review;
- coding rules;
- chart-of-account mappings;
- dimensions;
- reconciliation;
- accounting close;
- ERP synchronization;
- exception management.

---

## 4.5 Accountant

Operational accounting role.

Responsibilities:

- code expenses;
- review accounting fields;
- resolve sync errors;
- prepare transactions for ERP;
- reconcile data.

May be restricted to assigned entities.

---

## 4.6 Accounts Payable Admin

Owns supplier invoices and payments.

Responsibilities:

- bill intake;
- invoice validation;
- vendor details;
- approval routing;
- payment scheduling;
- payment runs;
- AP exception handling.

---

## 4.7 Procurement Admin

Owns purchasing workflows.

Responsibilities:

- purchase request forms;
- procurement workflows;
- sourcing;
- vendor onboarding;
- purchase orders;
- contract intake;
- renewals.

---

## 4.8 Treasury Admin

Owns cash and bank movement.

Responsibilities:

- bank accounts;
- balances;
- transfers;
- treasury rules;
- cash forecasting;
- statement payments;
- funding.

This role should be strongly separated from normal expense administration.

---

## 4.9 Accounts Receivable Admin

Owns customer invoicing and collections.

Responsibilities:

- customers;
- invoices;
- collections;
- received payments;
- cash application;
- AR reporting.

---

## 4.10 Travel Admin

Owns travel policy and travel operations.

Responsibilities:

- travel policy;
- travel limits;
- trip administration;
- travel analytics;
- travel approvals.

---

## 4.11 IT / Security Admin

Owns identity and platform security.

Responsibilities:

- SSO;
- SCIM;
- identity provider;
- login security;
- device/session administration;
- integrations;
- API applications.

Should not automatically get unrestricted access to confidential financial data.

---

## 4.12 HR / People Admin

Owns employee organizational data.

Responsibilities:

- people;
- manager hierarchy;
- departments;
- locations;
- employment state;
- HRIS sync.

Does not automatically control payments.

---

## 4.13 Manager / Approver

Team leader.

Responsibilities:

- approve team requests;
- approve expenses;
- approve reimbursements;
- approve bills/purchases if assigned;
- view team spend;
- view team budgets if granted.

Data scope should normally be:

```text
Self + Direct Reports + Optional Descendants
```

---

## 4.14 Employee / Cardholder

Normal employee.

Responsibilities:

- use physical/virtual cards;
- view personal funds;
- create spend requests;
- submit receipts;
- complete expenses;
- submit reimbursements;
- manage own travel;
- view own history.

Access is primarily self-scoped.

---

## 4.15 Executive Approver

Senior executive who needs fast visibility and approval actions.

Primary experience:

- mobile approvals;
- executive dashboard;
- high-value purchase approvals;
- budget exceptions;
- treasury/payment approvals.

---

## 4.16 Assistant / Delegate

Acts on behalf of another user for selected tasks.

Examples:

- prepare expense;
- upload receipt;
- arrange travel;
- prepare request.

Delegation must not automatically transfer approval authority.

---

## 4.17 Auditor / View-Only User

Read-only access.

Use cases:

- external audit;
- internal audit;
- finance review;
- investor/controller review.

Cannot mutate financial state.

---

## 4.18 Contractor / Guest

Limited external or temporary user.

Possible abilities:

- submit reimbursement;
- use assigned virtual card;
- submit procurement request;
- upload supporting documentation.

No broad organization visibility.

---

## 4.19 Vendor User

External vendor portal user.

Possible abilities:

- maintain vendor profile;
- securely provide payment details;
- submit invoice;
- view invoice/payment status;
- upload tax/compliance documents.

Vendor users never access internal company-wide finance data.

---

# 5. RBAC Architecture

## 5.1 Permission Model

Permissions must be based on:

```text
Permission =
Role
+ Action
+ Resource
+ Scope
+ Approval Authority
+ Delegation
+ Entity Access
+ Explicit Restriction
```

Never implement permissions only as:

```text
if role == "admin":
    allow
```

---

## 5.2 Permission Scopes

Every permission may have one of these scopes:

- SELF
- ASSIGNED
- DIRECT_REPORTS
- TEAM
- DEPARTMENT
- LOCATION
- ENTITY
- MULTI_ENTITY
- ORGANIZATION
- VENDOR_SCOPED
- CUSTOM_SCOPE

Examples:

```text
expense.read:self
expense.approve:direct_reports
bill.approve:entity:US
report.read:department:Marketing
treasury.transfer:entity:UK
```

---

## 5.3 Permission Categories

### People
- people.read
- people.invite
- people.edit
- people.suspend
- people.terminate
- roles.assign
- hierarchy.manage

### Cards & Spend
- card.read
- card.issue
- card.freeze
- card.terminate
- card.limit.edit
- fund.create
- fund.edit
- spend_program.manage
- spend_request.create
- spend_request.approve

### Expenses
- expense.read
- expense.edit
- expense.approve
- expense.reject
- receipt.manage
- policy_override

### Reimbursements
- reimbursement.create
- reimbursement.approve
- reimbursement.pay

### Travel
- travel.book
- travel.approve
- travel.policy.manage
- travel.admin

### AP
- bill.create
- bill.edit
- bill.approve
- bill.schedule
- payment.release
- payment_run.manage

### Procurement
- procurement.request
- procurement.review
- procurement.admin
- sourcing.manage
- po.create
- po.approve

### Vendors
- vendor.read
- vendor.create
- vendor.edit
- vendor.bank_details.manage
- vendor.approve

### Contracts
- contract.read
- contract.create
- contract.edit
- contract.approve
- renewal.manage

### Accounting
- accounting.read
- accounting.code
- accounting.rule.manage
- accounting.sync
- accounting.configuration.manage

### Treasury
- bank.read
- bank.connect
- transfer.create
- transfer.approve
- transfer.release
- treasury.rule.manage

### Reporting
- report.read
- report.build
- report.export
- dashboard.manage
- budget.read
- budget.manage

### AR
- customer.manage
- invoice.create
- invoice.send
- collection.manage
- cash_application.manage

### Security
- sso.manage
- scim.manage
- api.manage
- session.revoke
- audit.read
- security.manage

---

# 6. Separation of Duties Rules

High-risk flows must support separation of duties.

Examples:

### Vendor Bank Details
The user who changes vendor bank information should not be the only user who approves a high-value payment to that vendor.

### Bill Payments

```text
Bill Creator
≠
Final Payment Releaser
```

where company policy requires segregation.

### Treasury Transfer

```text
Transfer Creator
→ Treasury Approver
→ Transfer Release
```

### Role Elevation

A user must not silently grant themselves Owner-level permissions unless explicitly permitted by a higher authority.

### Spend Request

Requester cannot satisfy their own approval step.

### Accounting Override

High-risk accounting overrides should be logged and optionally require Controller approval.

---

# 7. High-Level Information Architecture — Web

Ramp's navigation and labels have changed over time, and the uploaded videos show more than one product-generation UI. Therefore, the replica should preserve **current functional parity** while keeping navigation configurable.

## 7.1 Ramp-aligned primary navigation

Recommended product navigation:

```text
HOME
  Home / Overview
  Inbox / Tasks
  Search

MY WORK
  My Cards & Funds
  My Expenses
  My Requests
  My Reimbursements
  My Travel

EXPENSES & SPEND
  Transactions
  Disputes & Repayments
  Reimbursements
  Travel
  Cards
  Funds / Spend Limits
  Spend Programs
  Spend Requests

PROCUREMENT
  Requests
  Programs / Intake Configuration
  Purchase Orders
  Receiving
  Sourcing
  Vendors
  Contracts & Renewals

VENDORS
  Overview
  Renewals
  Migrate Payments / Move Spend
  Price Intelligence
  Seat / License Intelligence
  Tax & 1099

BILL PAY / ACCOUNTS PAYABLE
  Bills
  Drafts
  Approvals
  Payments
  Payment Runs
  Recurring Bills
  Settings

ACCOUNTING
  Overview
  Ramp Card / Card Transactions
  Reimbursements
  Bill Pay / Payments
  Banking
  Needs Review
  Ready to Sync
  Synced
  Sync Errors
  Rules / Automations
  ERP Integration
  Reconciliation

BANKING / TREASURY
  Accounts
  Transactions
  Transfers
  Automations
  Forecast / Cash Position
  Statements

INSIGHTS
  Executive Dashboard
  Reporting
  Budgets
  Savings
  Price Intelligence
  License Intelligence
  Vendor Spend
  Department Spend
  AI Spend

RECEIVABLES
  Customers
  Invoices
  Collections
  Incoming Payments
  Cash Application

AI / INTELLIGENCE
  Ask AI / Assistant
  Policy Agent
  Reporting Agent
  Accounting Agent
  AP Agents
  Procurement / Contract Intelligence
  AI Token Spend
  Router
  Agent Identities / Agent Finance
  Agent Activity / Audit
  Sheets / Modeling Workspace

COMPANY / ADMIN
  People
  Departments
  Locations
  Legal Entities
  Roles & Permissions
  Policy
  Approval Workflows
  Vendors
  Rewards
  Integrations
  Developer Platform
  Tax Operations
  Security
  Audit Log
  Billing / Plan
  Company Settings
```

## 7.2 External / specialized portals

These should not be forced into the normal employee finance navigation:

```text
VENDOR PORTAL
  Vendor Profile
  Payment & Tax Details
  Bills / Payment Status
  Comments
  Documents

ADVISOR CONSOLE
  Clients
  People
  Reporting
  Projects / Close Checklist
  Knowledge
  Billing
  Price Intelligence
  Academy
  Referrals & Rewards

STACK
  Client / Company Workspaces
  Close Projects
  Reconciliations
  Bookkeeping Tasks
  Skills / Instructions
  Financial Reports
  Usage
```

## 7.3 Navigation rules

- Items must be permission-aware.
- Legal-entity context must be visible for sensitive financial actions.
- Add-on or beta products should only appear when enabled.
- Old/demo navigation names from the videos should not be hard-coded into the data model.
- Route names can differ from Ramp as long as user flows and functionality remain equivalent; if visual replica fidelity is required, maintain a UI-label configuration layer.

---

# 8. Global Web Shell

Every authenticated Web page should use the same shell.

## 8.1 Left Navigation

Contains:

- company logo;
- workspace/entity switcher;
- navigation;
- unread/task counters;
- collapsed/expanded mode;
- setup progress for new accounts.

## 8.2 Top Bar

Contains:

- global search;
- Ask AI shortcut;
- quick create button;
- notifications;
- help;
- profile;
- entity context indicator.

## 8.3 Quick Create

Context-aware global actions:

```text
New Spend Request
New Virtual Card
New Reimbursement
New Bill
New Purchase Request
New Vendor
New Transfer
New Invoice
```

Only display authorized actions.

## 8.4 Global Search

Search:

- people;
- cards;
- transactions;
- expenses;
- reimbursements;
- vendors;
- bills;
- payments;
- POs;
- contracts;
- trips;
- invoices;
- customers;
- reports.

Search result must respect RBAC.

---

# 9. WEB — Home / Overview

## Purpose

Personalized financial command center.

The dashboard changes according to role.

---

## 9.1 Finance Admin Dashboard

Widgets:

- current company/card balance;
- available business limit;
- total spend this period;
- spend vs previous period;
- pending approvals;
- uncategorized expenses;
- missing receipts;
- bills due;
- upcoming payments;
- budget variance;
- cash balance;
- vendor concentration;
- AI-detected anomalies;
- savings opportunities.

Sections:

### Action Required
- overdue expense requirements;
- bills waiting for approval;
- payment exceptions;
- sync errors;
- policy exceptions;
- vendor bank detail changes.

### Recent Activity
- cards issued;
- requests approved;
- large transactions;
- payments released;
- bank transfers;
- integrations changed.

### Financial Snapshot
Charts:
- spend trend;
- spend by department;
- spend by vendor;
- spend by category.

---

## 9.2 Employee Dashboard

Widgets:

- physical card status;
- available funds;
- current monthly spend;
- missing receipts;
- incomplete expenses;
- pending requests;
- upcoming trips;
- recent reimbursements.

Primary actions:

- view card;
- request funds;
- add receipt;
- submit reimbursement;
- book travel.

---

## 9.3 Manager Dashboard

Widgets:

- approvals waiting;
- team spend;
- team budget usage;
- team missing receipts;
- large team expenses;
- upcoming team travel.

---

# 10. WEB — Inbox / Tasks

## Purpose

Unified action queue.

The Inbox is role-aware.

Queue types:

- spend approvals;
- expense approvals;
- reimbursement approvals;
- procurement approvals;
- bill approvals;
- PO approvals;
- vendor approvals;
- payment approvals;
- treasury approvals;
- accounting exceptions;
- AI review recommendations.

Layout:

```text
Left: queues / filters
Center: item list
Right: review drawer / detail
```

Filters:

- type;
- status;
- amount;
- requester;
- department;
- vendor;
- entity;
- due date;
- policy status.

Actions:

- approve;
- reject;
- request changes;
- comment;
- assign;
- escalate;
- open full record.

---

# 11. WEB — My Cards & Funds

## Purpose

Employee self-service card center.

Display:

- physical card;
- virtual cards;
- active funds;
- remaining amount;
- reset date;
- merchant restrictions;
- category restrictions;
- expiration;
- recent spend.

Actions:

- reveal virtual card details;
- freeze card;
- unfreeze card;
- report lost/stolen;
- request replacement;
- request limit increase;
- request new fund.

Sensitive card data requires step-up verification.

---

# 12. WEB — Cards & Funds Administration

## Purpose

Create and control corporate spending instruments.

Tabs:

- People;
- Cards;
- Funds;
- Requests;
- Expiring Soon;
- Suspended.

Card table:

- cardholder;
- card type;
- last four;
- status;
- linked fund/program;
- spend this period;
- available amount;
- entity;
- department.

Actions:

- issue physical card;
- issue virtual card;
- assign fund;
- edit limit;
- freeze;
- terminate;
- replace;
- view transactions.

---

## 12.1 Issue Card Form

Fields:

- employee;
- card type;
- entity;
- linked spend program;
- fund amount;
- frequency;
- start date;
- expiry date;
- merchant restriction;
- category restriction;
- per-transaction limit;
- physical card shipping address;
- approver requirement.

---

# 13. WEB — Spend Programs

## Purpose

Reusable templates for automated spending permissions.

Examples:

- New Employee;
- Sales Travel;
- Engineering Software;
- Executive Travel;
- Home Office;
- Marketing Ads.

Program fields:

- name;
- eligibility;
- amount;
- frequency;
- allowed merchants;
- allowed categories;
- card type;
- auto-issue setting;
- approval rule;
- start/expiry behavior;
- entity;
- department.

Eligibility can use:

- department;
- location;
- entity;
- job level;
- employment type;
- manager;
- custom employee field.

---

# 14. WEB — Spend Requests

## Purpose

A Spend Request is the pre-spend entry point for an employee or requester who needs permission or spend authority before a purchase.

Current Ramp behavior is centered on **Programs / Spend Programs**: the requester selects the appropriate published program, completes its request form, and the request is routed through the approval workflow configured for that program.

## Request list

Recommended columns:

- requester;
- program;
- request title;
- vendor;
- one-time or recurring amount;
- frequency;
- annualized / total committed value where applicable;
- department;
- legal entity;
- status;
- current approver / current workflow step;
- requested date;
- linked fund/card/PO/contract after approval.

## Request states

```text
Draft
Submitted
In Review
Needs Information
Approved
Rejected
Cancelled
Expired
Fulfilled / Issued
```

## Request form

Program-configurable fields may include:

- business purpose;
- vendor / proposed vendor;
- amount;
- one-time / recurring;
- frequency;
- start/end date;
- line items;
- category;
- accounting dimensions;
- contract / quote / order form upload;
- security questions;
- legal questions;
- custom questions;
- comments.

AI/document extraction may prefill request details from uploaded quotes, order forms, contracts, or screenshots when supported.

## Approval outcome

An approved request may result in one or more of:

- a Fund / Spend Limit;
- a virtual card;
- a purchase order;
- a procurement request/PO lifecycle;
- a contract record;
- a budget commitment;
- vendor onboarding.

The exact output depends on the Program configuration.

## Important implementation rule

Do not model every request as "create a card." The request is the control object; fulfillment may be card-based, PO-based, bill-based, or approval-only.

---

# 15. WEB — Transactions

## Purpose

The transaction ledger is the canonical view of card spend and its post-authorization lifecycle.

## Primary states

```text
Authorized / Pending
Cleared
Declined
Reversed
Refunded
Disputed
```

## Recommended list columns

- transaction date/time;
- cardholder;
- merchant/vendor;
- original amount/currency;
- settlement amount/currency;
- card / last four;
- matched Fund / Spend Limit;
- entity;
- department;
- receipt state;
- memo state;
- policy/review state;
- accounting state.

## Transaction detail

The detail surface should connect:

- merchant information;
- authorization and clearing timeline;
- card;
- matched Fund;
- receipt(s);
- receipt verification;
- memo/business purpose;
- attendees/custom fields when required;
- policy flags;
- approval/review history;
- accounting coding;
- splits;
- vendor profile;
- comments;
- dispute/personal-spend handling;
- audit history.

## Receipt verification

Ramp currently auto-verifies receipt matching using transaction/receipt data. Public documentation describes verification using amount plus date or merchant matching. The replica should implement a configurable deterministic matching layer and retain confidence/evidence.

## Expense relationship

A card transaction automatically participates in expense management. Do not create a disconnected "expense report" object unless a business workflow requires one. The card transaction, receipt, requirements, policy, review, and accounting state should remain linked.

---

# 16. WEB — Expense Management

## Purpose

Expense Management handles **post-spend completion, compliance, review, and accounting readiness** for card transactions and reimbursements.

This section was verified against the uploaded Expense Tracking video and current Ramp documentation.

## 16.1 Employee experience

The uploaded video visibly demonstrates:

- Home surfacing items that need attention;
- transactions requiring a receipt and/or memo;
- transaction detail in a side drawer;
- receipt upload;
- memo entry;
- accounting/category selection;
- reimbursement and request-funds entry points.

Current Ramp documentation also supports receipt submission through multiple channels such as app/web, email/connected inboxes, and SMS where available.

## 16.2 Expense requirements

Submission policies can require:

- receipt;
- memo;
- business purpose;
- accounting category;
- department;
- location;
- class;
- project;
- customer/client;
- attendees;
- custom user/accounting fields.

Requirements may vary based on:

- amount;
- person/role;
- department;
- merchant;
- category;
- legal entity;
- HR attributes;
- other configured conditions.

## 16.3 Receipt automation

The expense engine should support:

```text
Card Transaction
      ↓
Receipt Source
      ↓
Receipt Capture / OCR
      ↓
Candidate Matching
      ↓
Verification
      ↓
Attach to Transaction
      ↓
Populate Memo / Coding if High Confidence
```

Receipt sources should include:

- camera/upload;
- email forwarding;
- connected Gmail / Outlook;
- SMS where supported;
- merchant/direct integrations where available;
- auto-generated receipt sources where legally/operationally supported.

If confidence is insufficient, ask the employee for only the unresolved fields.

## 16.4 Review queues

Exact UI labels may change, so use queue semantics rather than hard-coding one historic tab set:

```text
Needs Employee Action
Awaiting Review
Policy Exceptions
Ready for Accounting
Completed
Declined / Failed / Special Cases
```

The uploaded video also shows an Inbox with multiple action queues and an Accounting > Ramp Card review surface.

## 16.5 Policy Agent

Policy Agent should be represented as an AI-assisted reviewer, not an unrestricted auto-approver.

Outputs:

```text
Approval Recommended
Requires Review
Rejection Recommended
```

The recommendation should include:

- policy/evidence used;
- reasoning summary;
- detected anomaly / missing requirement;
- confidence;
- suggested next action.

Configured workflows may auto-approve clearly in-policy expenses when permitted, but the reviewer and deterministic policy controls remain authoritative.

## 16.6 Full expense checks / risk checks

Where enabled, expense review should be able to flag:

- duplicate receipts;
- illegible receipts;
- receipt/transaction mismatch;
- suspicious receipts;
- possible personal spend;
- unusual spend;
- policy violations;
- missing business purpose.

Release-state differences must be feature-flagged if the source capability is beta/limited.

## 16.7 Splits

Allow transactions/reimbursements to be split across accounting dimensions.

Validation:

```text
SUM(Split Amounts) = Original Expense Amount
```

Each split may carry different:

- GL/category;
- department;
- class;
- location;
- project;
- client/customer;
- custom dimensions.

## 16.8 Card lock for incomplete requirements

Where the company enables enforcement, future card/fund access may be restricted when required expense items remain incomplete beyond a configured grace period.

This must be a configurable policy, not a universal hard-coded behavior.

## 16.9 Accounting handoff

Once requirements and review are complete:

```text
Transaction
→ Coding Complete
→ Review Complete
→ Ready to Sync
→ ERP Sync
```

The video visibly demonstrates both Ramp accounting queues and an external NetSuite result, which is consistent with the current accounting integration model.

---

# 17. WEB — Reimbursements

## Purpose

Reimbursements cover business spend paid personally rather than through a Ramp card.

## Supported reimbursement types

- standard expense reimbursement;
- mileage;
- per diem where configured.

## Submission

Employees/eligible guests should be able to submit:

- amount;
- currency;
- date;
- merchant;
- purpose;
- receipt;
- accounting fields;
- source Fund / Spend Limit where the company requires it.

The selected reimbursement source can influence the applicable policy and approval route.

## Mileage

Recommended model:

```text
Eligible Mileage Reimbursement =
Eligible Distance × Approved Rate
```

Support:

- map-assisted route calculation;
- company/custom mileage rates;
- commute deduction where configured;
- department/user-specific rates where required.

## Per diem

Recommended model:

```text
Eligible Per Diem =
Eligible Day/Meal Units × Applicable Policy Rate
```

The policy must define location/rate/eligible categories and pre-trip/post-trip handling.

## Workflow

```text
Draft
→ Submitted
→ Policy / Requirements Check
→ Approval
→ Payment Preparation
→ Scheduled / Processing
→ Paid
```

Also support Rejected, Cancelled, Failed, and Paid Outside Platform where applicable.

## Accounting

Current Ramp documentation states reimbursements can be coded in Accounting and are synced to accounting providers as bills / bill payments for supported integrations. The replica accounting adapter should preserve provider-specific mapping rules.

## International

The data model must support foreign currencies, cross-border reimbursement eligibility, entity-specific reimbursement methods, and tax-compliant reimbursement statements where required.

---

# 18. WEB — Procurement

## Purpose

Procurement is the **intake-to-purchase / procure-to-pay control layer**.

The previous draft was directionally correct but needs one important Ramp-specific correction:

> **The normal procurement entry point is a Request through a published Program. A Purchase Order is normally created after final approval when the Program is configured to create one.**

Do not design "Create PO" as the primary employee procurement flow.

## Standard procurement lifecycle

```text
Employee Chooses Program
        ↓
Purchase Request
        ↓
Document / AI Prefill
        ↓
Manager / Budget / Finance Review
        ↓
Security / IT / Legal / Procurement Review as Required
        ↓
Vendor Onboarding as Required
        ↓
Final Approval
        ↓
PO Automatically Created when Configured
        ↓
Send / Sync PO
        ↓
Receive Goods / Services
        ↓
Match Bill or Card Spend
        ↓
2-Way / 3-Way Match
        ↓
Payment
        ↓
Accounting
```

## Verified from uploaded Procurement video

The video visibly shows:

- request purchase;
- Manager, IT, Security, and Legal review branches;
- purchase order output;
- upfront coding;
- PO document/activity view;
- comments and options;
- bill/card-spend sections;
- receiving status;
- invoice line validation / variance checking;
- purchase-order overview and receiving queues.

## Submodules

- Requests;
- Programs / Intake Forms;
- Workflow Builder;
- Purchase Orders;
- Receiving;
- PO Matching;
- Vendor Onboarding;
- Contracts;
- Renewals / Expansions;
- Sourcing;
- Price Intelligence;
- License / Seat Intelligence where enabled.

## Add-on status

Some procurement, contract, renewal, sourcing, and advanced matching capabilities are plan/add-on dependent in Ramp. Build them as entitlements/feature flags rather than assuming every tenant owns every function.

---

# 19. WEB — Procurement Request Detail

## Request header

- requester;
- Program;
- status;
- vendor;
- department;
- entity;
- amount/currency;
- one-time/recurring;
- request owner;
- current approval step.

## Request content

- product/service;
- business justification;
- line items;
- quantity/unit rate;
- start/end dates;
- frequency;
- accounting coding;
- budget impact;
- vendor status;
- contract/quote/order-form attachments;
- security questionnaire;
- IT review;
- legal review;
- finance/procurement review;
- comments.

## AI/document prefill

When supported, uploaded documents may prefill:

- vendor;
- frequency;
- dates;
- line items;
- amounts;
- contract metadata.

All extracted fields must remain reviewable.

## Approval timeline

Support sequential and parallel review.

Example:

```text
Manager
   ├─→ IT
   ├─→ Security
   └─→ Legal
        ↓
Procurement / Finance
        ↓
Final Approval
```

## Fulfillment / linked objects

After approval the request may link to:

- PO;
- virtual card;
- Fund/Spend Limit;
- vendor onboarding;
- contract;
- renewal/expansion;
- Bill Pay;
- budget commitment.

## Actions

Role-dependent:

- approve;
- reject;
- request more information;
- comment;
- reassign;
- cancel;
- create/change order;
- start vendor onboarding;
- view linked PO/card/bill/contract.

---

# 20. WEB — Procurement / Approval Workflow Builder

## Purpose

Reusable visual workflow builder for procurement and other finance approvals.

## Node types

- requester manager;
- manager's manager;
- named approver;
- role/group approver;
- budget owner;
- finance;
- procurement;
- IT;
- security;
- legal;
- vendor onboarding;
- condition;
- parallel branch;
- notification;
- AI review / recommendation;
- webhook/integration task.

## Conditions

Examples:

```text
amount > threshold
vendor is new
vendor changed
category = software
department = engineering
entity = UK
renewal = true
sensitive data = true
contract attached = true
```

## Capabilities

- sequential approvals;
- parallel approvals;
- any-of / all-of approver rules;
- fallback approver;
- escalation;
- delegation;
- SLA;
- reminder;
- amount authority;
- entity restrictions;
- approval history.

## Safety

AI review may summarize or recommend but cannot silently bypass required reviewers.

---

# 21. WEB — Purchase Orders

## Important creation rule

Standard flow:

```text
Published Program
→ Request
→ Approval
→ Purchase Order
```

Current Ramp documentation explicitly states that the Purchase Orders page is normally for managing POs **after they exist**, not the standard place where an employee starts a procurement request.

Admins may be allowed to skip approvals / issue a PO directly in specific permitted cases. Treat that as a privileged exception.

## PO list

Views:

- Overview;
- Receiving;
- Open;
- Partially Received;
- Fully Received;
- Closed / Archived;
- attention/variance filters.

Recommended columns:

- PO number;
- vendor;
- requester/owner;
- entity;
- approved amount;
- remaining commitment;
- receiving status;
- billed amount;
- payment/spend status;
- contract;
- last activity.

## PO detail

Tabs/sections:

- Overview;
- PO information;
- Accounting;
- Documents;
- Activity / Comments;
- Bills;
- Card Spend;
- Receiving.

Actions may include:

- edit/change order;
- change owner;
- archive;
- match card transaction;
- send to vendor;
- download PDF;
- sync to accounting/ERP;
- create contract where supported.

## Line items

Each line should track:

- description;
- quantity;
- unit price;
- approved amount;
- received quantity/amount;
- billed quantity/amount;
- remaining amount;
- variance.

## PO matching

Support:

### 2-way match
```text
Invoice
↔
PO
```

Validate vendor and amount/line-item compatibility.

### 3-way match
```text
Invoice
↔
PO
↔
Receipt / Goods Received
```

Use for physical goods and receiving-dependent procurement.

## Commitment formula

Basic implementation:

```text
Remaining PO Commitment =
Approved PO Amount - Recognized/Matched Bill or Spend Amount
```

When accrual accounting is enabled, distinguish unbilled commitment, received-not-billed, and accrued amounts rather than relying on one balance.

## Advanced PO accruals

Current Ramp has limited-release/plan-dependent PO accrual functionality. Keep this behind entitlement and do not make it mandatory for MVP.

---

# 22. WEB — Vendor Management

## Purpose

Vendor Management is a shared master-data layer across card spend, Bill Pay, procurement, contracts, and reporting.

Ramp currently creates/maintains vendor records across card and bill activity; the replica should normalize merchant/card data and AP vendors into a shared vendor graph while retaining source identities.

## Vendor list

Recommended columns:

- vendor;
- owner;
- department;
- entity;
- lifecycle status;
- category;
- total spend;
- card spend;
- Bill Pay spend;
- open bills;
- contracts;
- renewal status;
- payment method;
- tax-status completeness;
- risk/verification status.

## Vendor detail

Sections:

- Overview;
- Cards & Funds;
- Spend;
- Bills;
- Payments;
- Purchase Orders;
- Contracts;
- Documents;
- Payment & Tax Details;
- Activity;
- AI / Intelligence where enabled.

## Onboarding

Vendor onboarding may collect:

- legal name;
- addresses;
- contacts;
- bank/payment details;
- W-9/W-8 or local tax forms;
- TIN/tax ID;
- security/compliance documents;
- custom questions;
- contract documents.

Procurement workflows may start vendor onboarding before final purchase approval.

## Vendor approvals

New vendors and changes to existing vendors may require configured approval workflows.

Sensitive changes such as payment/bank details should trigger stronger review and audit.

## Verification

Support provider-appropriate vendor verification methods, for example:

- bank account ownership checks;
- linked-bank verification;
- microdeposits;
- supporting bank statement;
- TIN/tax verification.

## Vendor lifecycle and administration

Support:

- active/inactive or lifecycle states;
- provisional/draft vendor;
- merge vendors;
- custom groups;
- document management;
- 1099-related workflows where in scope;
- ERP vendor import/sync;
- payment hold/pause controls where allowed.

## AI Vendor Intelligence

Advanced AI may:

- summarize contracts;
- extract key commercial terms;
- surface renewal risks;
- provide pricing benchmark context;
- draft negotiation guidance.

AI analysis informs humans; it must not approve vendor changes or contracts autonomously.

---

# 23. WEB — Contracts, Renewals & Expansions

## Purpose

Create, import, store, analyze, and act on vendor contracts.

## Contract ingestion

Support:

- manual creation;
- document upload;
- bulk upload;
- email forwarding;
- linked procurement requests;
- creation from an existing PO;
- external contract-system import through adapters.

## Contract record

- contract name;
- vendor;
- entity;
- owner;
- department;
- value/currency;
- start date;
- end date;
- last date to action;
- auto-renewal;
- renewal terms;
- notice period;
- documents;
- linked PO;
- linked request;
- linked spend/bills.

## Automatic contract detection

When a spend request includes contract-like documents, the system may suggest/enable contract creation. User overrides should be respected.

## AI extraction

AI may extract:

- dates;
- pricing;
- line items;
- payment terms;
- renewal language;
- termination/cancellation terms;
- overage/usage-based pricing;
- data rights/privacy;
- liability caps;
- SLA terms.

Each extracted term should retain source evidence.

## Renewals

```text
Contract Nears Action Date
→ Reminder
→ Request Renewal
→ AI Suggests Program + Prefills Request
→ Approval / Negotiation
→ Renew / Do Not Renew
→ Update Contract
```

## Expansions

Support a linked expansion request that can increase the existing contract value and link resulting approvals/POs.

## Intelligence

Where enabled:

- price benchmarks;
- market-position labels;
- renewal summary;
- negotiation chat/draft;
- prioritized findings.

Current public docs identify some advanced contract intelligence as Alpha; protect with feature flags.

---

# 24. WEB — Sourcing & Price Intelligence

## 24.1 Sourcing

Sourcing supports competitive vendor evaluation before commitment.

Functions:

- create sourcing/RFP event;
- define requirements;
- identify/invite vendors;
- collect proposals;
- normalize bids;
- compare prices/terms;
- score vendors;
- negotiate;
- select winner;
- feed result into procurement/vendor/contract/PO workflow.

AI-assisted sourcing may prefill evaluations and summarize proposals, but decision authority remains human.

## 24.2 Price Intelligence

Current Ramp exposes Price Intelligence under Insights.

Purpose:

- benchmark software/vendor pricing;
- compare a quote/contract against anonymized market data;
- identify below/typical/above-market pricing;
- support negotiation.

Replica surface:

```text
Insights
→ Price Intelligence
→ Vendor
→ Product / Plan / Billing Frequency
→ Benchmark
→ Upload Contract / Quote
→ Comparison
```

Display:

- reference vendor/product;
- billing frequency;
- benchmark statistics;
- sample/business count when available;
- customer's current/quoted price;
- market position;
- evidence/limitations.

Price Intelligence data should always be labeled as benchmark/estimated intelligence, not guaranteed market truth.

## 24.3 License / Seat Intelligence

If enabled, connect application/license data to vendor spend to identify:

- unused seats;
- low-utilization licenses;
- renewal optimization;
- duplicate tools;
- potential consolidation.

This belongs under Savings/Insights and may feed renewal workflows.

---

# 25. WEB — Bill Pay / Accounts Payable

## Purpose

Bill Pay is the AP lifecycle:

```text
Invoice Intake
→ OCR / Draft
→ Vendor
→ Coding / PO Match / Risk Checks
→ Bill Creation
→ Bill Approval
→ Payment Setup
→ Payment Release Approval
→ Payment Processing
→ Settlement
→ Accounting Sync
```

The uploaded Payable video visibly demonstrates this flow and current Ramp documentation adds newer capabilities such as Payment Runs, partial payments, and AP Agents.

## 25.1 Bills navigation

The uploaded video shows views including:

- Overview;
- Drafts;
- For approval;
- For payment;
- History;
- saved/custom views.

The replica should implement these as configurable/saved bill views rather than relying on one fixed historic tab set.

## 25.2 Invoice intake

Methods:

- upload invoice;
- drag/drop;
- AP email forwarding;
- connected Gmail/AP inbox automation where enabled;
- import from accounting system;
- manual bill entry.

Supported files and exact limits must be configurable.

## 25.3 OCR and draft bill

OCR should extract:

- vendor;
- invoice number;
- invoice date;
- due date;
- total;
- currency;
- line items;
- taxes;
- payment terms;
- payment instructions where allowed.

Important behavior:
- supporting attachments must not be blindly treated as invoice documents;
- extraction confidence must be reviewable;
- duplicate detection should run before payment.

## 25.4 Bill detail

Sections:

- invoice preview;
- vendor;
- invoice metadata;
- line items;
- accounting coding;
- PO match;
- receiving/3-way match where relevant;
- policy/submission checks;
- fraud/risk findings;
- approvals;
- payment details;
- comments;
- audit timeline.

## 25.5 Bill lifecycle

Recommended states:

```text
Draft
Needs Review
Created / Submitted
Awaiting Approval
Approved
Payment Not Scheduled
Scheduled
Partially Paid
Paid
Rejected
Cancelled / Void
```

Keep **bill state** separate from **payment state**.

## 25.6 AP Agents

Current Ramp documentation describes AI AP capabilities including:

- line-item auto-coding;
- fraud checks;
- duplicate detection;
- approval intelligence/summaries;
- AP inbox automation;
- automatic bill creation from eligible drafts;
- automatic card-payment automation for eligible invoices.

Important:
- approval intelligence provides recommendations; it does not bypass configured bill approvers;
- limited/beta functions must be feature-flagged.

## 25.7 Bill approval vs payment release

These are two separate controls:

```text
Bill Approval
≠
Payment Release Approval
```

A bill may be approved for payment while the actual release of funds still requires a payer/releaser.

This separation is mandatory in the replica RBAC/workflow model.

## 25.8 Accounting synchronization

Bill creation/update/payment events should map to the connected accounting provider according to its supported sync behavior.

Never hard-code one provider's journal behavior as universal.

---

# 26. WEB — Payments

## Purpose

A Payment represents one outgoing settlement attempt against one or more payable obligations depending on supported batching.

One bill may have multiple payments; therefore:

```text
Bill
1 → many Payments
```

## Payment methods

The current Ramp Bill Pay documentation includes payment methods such as:

- Ramp card;
- standard ACH;
- same-day ACH;
- real-time payment (RTP) where supported;
- domestic wire;
- mailed check;
- overnight check;
- SWIFT USD transfer;
- cross-border FX;
- outside-Ramp/manual-paid tracking where applicable.

Availability depends on business, geography, vendor, source account, plan, and banking eligibility.

## Payment record

- vendor;
- source bill(s);
- amount/currency;
- payment method;
- source account/card;
- scheduled date;
- estimated arrival;
- initiated date;
- delivered date;
- remittance;
- release approval;
- status;
- failure/return reason.

## Status model

```text
Draft
Awaiting Release Approval
Scheduled
Processing
Sent
Delivered / Completed
Failed
Returned
Cancelled
```

Use provider-specific sub-statuses internally without exposing unnecessary complexity to end users.

## Partial payments

Current Ramp supports splitting an eligible bill into multiple payments.

Replica requirement:

- up to configurable maximum number of splits;
- each split > 0;
- sum of splits must not exceed the bill balance;
- track remaining balance separately;
- each partial payment has independent schedule/method/status;
- bill becomes Paid only when remaining balance reaches zero.

## Card payments

Support single-use/virtual-card or existing-card payment paths where provider capabilities allow, and match the cleared transaction back to the bill/payment.

## Safety

Payment execution must enforce:

- permission;
- payment release policy;
- vendor/payment-detail validation;
- idempotency;
- duplicate-payment protection;
- sufficient source capacity/balance where applicable;
- audit.

---

# 27. WEB — Payment Runs

## Purpose

Payment Runs group pending-release payments for **batch review and release**.

Current Ramp documentation identifies Payment Runs as a Ramp Plus feature built on payment-step approvals.

## Workflow

```text
Eligible Payments
→ Create Named Payment Run
→ Review Payments
→ Review Total Cash Impact
→ Fix / Remove Exceptions
→ Payer Approval / Release
→ Process Individually
→ Track Run + Payment Statuses
```

## Run detail

Display:

- run name;
- creator;
- source accounts;
- payment count;
- total by currency;
- vendor count;
- scheduled dates;
- warnings;
- failed validation;
- release status;
- payer/releaser;
- timestamps.

## Important semantics

- a run is a review/release grouping, not a new bill;
- payments still retain individual payment records and settlement statuses;
- Payment Runs are optional even when enabled;
- individual release can still exist if company policy permits.

## RBAC

Suggested permissions:

- payment_run.create;
- payment_run.edit;
- payment_run.review;
- payment_run.release.

Run creator and final releaser can be separated through policy.

---

# 28. WEB — Travel

## Purpose

Ramp Travel combines travel search/booking, pre-spend policy enforcement, trip management, corporate-card expense automation, and travel reporting.

The uploaded Travel video and current Ramp documentation together confirm the major workflow, but the video also contains an **Employee Rewards demo that should not be treated as a baseline live feature** because current official webinar material describes it as upcoming/roadmap.

## 28.1 Main travel surfaces

- My Travel / Search & Book;
- Upcoming Trips;
- Past Trips;
- Travel Requests / Approvals;
- Travel Admin Dashboard;
- Travel Policy;
- Traveler Profiles;
- Reporting;
- Guest / Delegate booking where enabled.

## 28.2 Booking inventory

Current Ramp documentation supports direct booking for:

- flights;
- hotels;
- rental cars.

Do **not** document rail/train as a direct Ramp Travel booking capability unless later verified. Rail may appear in reporting or off-platform spend.

## 28.3 Employee booking flow

```text
Open My Travel
→ Choose Traveler / Destination / Dates
→ Search Flight / Hotel / Car
→ Filter Results
→ Compare Policy / Market Guidance
→ Select Option
→ In-Policy?
     ├─ Yes → Book
     └─ No  → Submit Request / Approval
→ Payment with Eligible Ramp Card/Fund
→ Booking Confirmation
→ Trip Created / Updated
→ Expense Automation
```

## 28.4 Pre-purchase policy enforcement

Travel should enforce configurable controls at booking, including:

- airfare/market-rate or price ceiling;
- cabin class;
- flight-duration conditions;
- advance booking requirement;
- hotel nightly cap / market-rate rule;
- refundable-only hotel rule;
- per diem;
- preferred providers;
- out-of-policy approval.

When an option violates policy, the booking action can be replaced by a request/approval flow.

## 28.5 Search UX

The uploaded video visibly shows hotel search with:

- map;
- policy filter;
- stars;
- price;
- refundable filter;
- reward indicator;
- in-policy vs out-of-policy presentation;
- "Request to book" behavior for an option that is not directly bookable.

## 28.6 Traveler profile

Store:

- legal/contact information;
- airline loyalty numbers;
- known-traveler / trusted-traveler identifiers;
- travel preferences where supported.

Sensitive travel identity data requires appropriate security.

## 28.7 Trips

Bookings should automatically create or attach to a Trip.

Trip connects:

- traveler;
- destination;
- date range;
- flight;
- hotel;
- car;
- itinerary;
- card/fund;
- related transactions;
- per diem;
- total spend;
- policy status.

## 28.8 Expense automation

Booking and card data should automatically:

- attach booking/receipt evidence;
- classify travel spend;
- suggest/generate memo;
- associate transactions to trip;
- feed Accounting and reporting.

## 28.9 Off-platform travel

Support an off-Ramp booking workflow where an employee uses an eligible Ramp Fund/Card elsewhere and sends booking confirmations so the platform can build itinerary/trip context and link spend.

## 28.10 Guest and delegate booking

Current Ramp documentation supports:

- guest booking for flights/hotels subject to permissions;
- delegate booking through Assistant Role;
- guest-specific restrictions (for example, rental-car support can differ).

These capabilities should be permission- and policy-driven.

## 28.11 Hotel Price Drop

Current Ramp documentation describes automated price-drop monitoring for eligible refundable hotel reservations, with rebooking only after the lower-priced replacement reservation is confirmed.

Treat this as a distinct travel-savings automation.

## 28.12 Employee Rewards shown in uploaded video

The uploaded video clearly shows a Travel Policy panel containing:

- Enable employee rewards;
- split savings between employee and business;
- annual employee reward maximum;
- use cashback to fund savings;
- linked checking account.

However, current Ramp webinar content describes **Employee Rewards as upcoming/on the roadmap**.

Therefore:

```text
Status in replica:
ROADMAP / FEATURE FLAG
```

Do not make it a baseline requirement until current general availability is independently confirmed.

## 28.13 Admin reporting

Travel admin dashboard should support:

- travelers;
- trips;
- spend by type;
- policy compliance;
- destination/location;
- out-of-policy requests;
- export;
- accounting sync status.

The uploaded video visibly shows a Travel dashboard and a CSV / QuickBooks sync workflow.

---

# 29. WEB — Trip Detail

## Header

- trip name;
- traveler;
- trip status;
- destination(s);
- start/end date;
- policy state;
- total travel spend.

## Itinerary

- flights;
- hotel;
- rental car;
- confirmation IDs;
- support/modification links;
- cancellations;
- credits/refunds when applicable.

## Finance context

- Fund / Spend Limit used;
- transactions;
- receipts;
- per diem;
- reimbursement;
- accounting categories;
- policy exceptions;
- approval history.

## Actions

Role/booking dependent:

- modify supported flight;
- cancel/refund eligible booking;
- rebook;
- request exception;
- add/forward off-platform booking;
- download/share itinerary;
- contact travel support.

## Automation

On trip/date windows, eligible card spend may be linked to the trip and categorized according to configured travel/accounting rules.

---

# 30. WEB — Business Banking / Treasury

## Purpose

Business Banking/Treasury is broader than "linked bank balances."

Current Ramp public documentation includes:

- Ramp Checking;
- Operating Account;
- Reserve Account;
- Managed Investment Account;
- Self-Directed Investment Account / migration path;
- Stablecoin Account where eligible;
- bank feeds and accounting;
- payments and checks;
- transfers;
- treasury controls and automations.

The replica may implement only the products that match its licensed banking/payment-provider capabilities.

## Pages

```text
Banking Overview
Accounts
Transactions
Transfers
Payments
Checks / Deposits
Automations
Cash Forecast / Liquidity
Statements
Accounting / Bank Feed
```

## Account card

- account type;
- bank/provider;
- entity;
- mask;
- available balance;
- current/ledger balance;
- yield where relevant;
- last sync;
- status.

## Transfers

Support:

- one-time internal/external transfers;
- recurring transfers;
- approval flow;
- creator/approver separation;
- audit.

## Automations

Examples from current Ramp banking documentation:

- target-balance automation;
- recurring transfers;
- forecasted-shortfall handling;
- low-balance notifications;
- external-debit approval controls.

## Accounting

Banking transactions should be exposed to accounting/reconciliation and provider bank-feed integrations.

## Compliance boundary

Actual bank accounts, yield, deposit insurance, investment products, stablecoins, wires, and payment rails require appropriate regulated providers and jurisdiction-specific legal/compliance work. The replica must never simulate a regulated product as real money movement without a licensed/provider-backed implementation.

---

# 31. WEB — Statements & Card Repayment

Pages:

- Statements;
- Statement Detail;
- Repayment Settings.

Statement detail:

- statement period;
- opening balance;
- purchases;
- refunds;
- payments;
- closing balance;
- due date;
- status.

Payment settings:

- autopay;
- payment source;
- payment date;
- early payment.

---

# 32. WEB — Accounting Automation

## Purpose

Accounting converts operational spend/payment data into reviewed accounting data and synchronizes it to the connected ERP/accounting provider.

## Core workflow

```text
Source Transaction / Reimbursement / Bill / Banking Event
        ↓
Requirements Complete?
        ↓
Coding / Rules / AI Suggestion
        ↓
Needs Review
        ↓
Ready to Sync
        ↓
Sync Queue
        ↓
ERP
        ↓
Synced / Error
```

## Sources

Accounting must support, depending on integration:

- card transactions;
- reimbursements;
- bills/payments;
- card statement payments;
- cashback/redemptions;
- banking;
- procurement/PO context;
- receivables;
- entity-level data.

## Accounting fields

Provider-dependent:

- GL account;
- department;
- class;
- location;
- project/job;
- customer;
- tax;
- entity;
- custom dimensions.

## Rules + AI

Use deterministic rules first, then AI/historical suggestions where appropriate.

Current Ramp documentation also supports AI/rules that can auto-mark eligible transactions Ready, plus nightly auto-sync when configured and eligibility checks pass.

Eligibility should include:

- cleared/nonzero where required;
- unsynced;
- complete required accounting fields;
- valid entity mappings;
- policy/requirements state;
- amount automation threshold.

## Provider mappings

Do not assume every ERP has identical object types. Each accounting adapter owns:

- chart-of-account mapping;
- dimensions;
- vendors/customers;
- bills;
- card liability handling;
- payments;
- bank feeds;
- supported sync direction.

## Stack relationship

Ramp now also offers **Stack**, a separate AI accounting operating system for bookkeeping/month-end-close workflows. Stack should not be confused with the normal Accounting transaction-sync module. See the dedicated Stack section later in this document.

---

# 33. WEB — Accounting Transaction Detail

Fields:

- source type;
- transaction;
- vendor;
- amount;
- receipt;
- memo;
- GL account;
- department;
- location;
- class;
- project;
- customer;
- tax;
- entity;
- custom dimensions;
- accounting period;
- sync state.

Actions:

- edit coding;
- split;
- apply rule;
- exclude;
- sync;
- retry sync.

---

# 34. WEB — Accounting Rules

Rule example:

```text
IF Vendor = OpenAI
AND Department = Engineering
THEN
GL Account = Software Subscriptions
Cost Center = Engineering
```

Rule builder supports:

- vendor;
- merchant category;
- user;
- department;
- entity;
- amount;
- card;
- custom field.

Priority/order must be configurable.

---

# 35. WEB — ERP Integration

Configuration pages:

- connection;
- account mappings;
- dimension mappings;
- vendor mappings;
- tax mappings;
- sync policy;
- auto-sync schedule;
- error handling.

Sync states:

```text
Not Ready
Ready
Queued
Syncing
Synced
Failed
```

---

# 36. WEB — Insights / Executive Dashboard

## Purpose

Unified financial visibility across spend, commitments, AP, travel, vendors, treasury, AR, savings, and AI spend.

## KPI families

### Spend
- total spend;
- card spend;
- Bill Pay spend;
- reimbursements;
- spend growth;
- recurring spend.

### Budget
- budget;
- actual;
- committed;
- forecast;
- variance.

### AP
- open bills;
- due soon;
- overdue;
- scheduled payments;
- payment failures.

### Procurement
- request cycle time;
- approved commitments;
- open POs;
- receiving status;
- renewal exposure.

### Vendor / Savings
- top vendors;
- vendor concentration;
- Price Intelligence opportunities;
- duplicate/unused licenses;
- renewal opportunities.

### Travel
- trip spend;
- policy compliance;
- flight/hotel/car spend;
- out-of-policy requests;
- savings.

### Treasury
- cash position;
- upcoming outflows;
- target-balance alerts.

### AR
- open receivables;
- overdue invoices;
- collections status.

### AI
- token spend;
- provider/model/user/project breakdown;
- anomalies;
- limits.

Every summary metric must drill down to source records and must state time range, currency basis, and sync freshness.

---

# 37. WEB — Reports & Reporting Agent

## Report builder

Dimensions can include:

- date;
- employee;
- manager;
- department;
- location;
- entity;
- vendor;
- merchant/category;
- GL/accounting dimensions;
- card;
- Fund / Spend Limit;
- transaction type;
- policy state;
- bill/payment status;
- procurement/PO;
- travel/trip;
- customer/invoice where AR data is enabled.

Measures:

- total spend;
- transaction count;
- average transaction;
- budget;
- variance;
- committed spend;
- outstanding AP;
- outstanding AR;
- savings;
- compliance.

## Capabilities

- filters;
- advanced filtering;
- grouping;
- sorting;
- saved report;
- share;
- export;
- scheduled delivery;
- dashboard pinning;
- drill-down.

## Reporting Agent

Provide natural-language report creation:

```text
"Show software spend by department for Q3"
→ Resolve dimensions/filters
→ Generate report
→ Show chart/table
→ Allow drilldown
→ Save / Share / Export
```

Agent output must respect RBAC/entity scope and show the applied filters/calculation logic.

---

# 38. WEB — Budgets

Budget hierarchy:

```text
Organization
→ Entity
→ Department
→ Team / Cost Center
→ Category / Project
```

Budget record:

- owner;
- period;
- amount;
- actual spend;
- committed spend;
- available;
- forecast.

Formula:

```text
Available Budget =
Budget - Actual Spend - Committed Spend
```

Budget pages:

- Overview;
- Budget List;
- Budget Detail;
- Forecast;
- Variance.

---

# 39. WEB — Savings, Price Intelligence & License Intelligence

## Savings

Surface opportunities such as:

- duplicate subscriptions;
- unused/underused licenses;
- redundant tools;
- upcoming renewals;
- vendor consolidation;
- unusual price increases;
- card-policy opportunities;
- partner rewards;
- negotiated savings.

## Price Intelligence

Dedicated page under Insights.

Capabilities:

- search vendors/products;
- show benchmark price data;
- compare contract/quote;
- market position;
- negotiation context;
- source/coverage limitations.

## License Intelligence

Where connected/supported:

- seats purchased;
- seats assigned;
- seats active;
- utilization;
- unit economics;
- renewal date;
- recommended right-sizing.

## Savings workflow

```text
Opportunity
→ Evidence
→ Owner
→ Action
→ Negotiation / Cancel / Right-size
→ Result
→ Realized Savings
```

AI recommendations must show evidence and should not claim guaranteed savings.

---

# 40. WEB — Receivables / Accounts Receivable

## Purpose

Receivables manages the opposite side of Bill Pay:

```text
Bill Pay = money going to vendors
Receivables = money coming from customers
```

Current Ramp Help taxonomy describes Receivables as:

- send invoices;
- collect overdue balances;
- apply incoming payments.

## Subpages

- Customers;
- Products / Services where needed;
- Invoices;
- Collections;
- Incoming Payments;
- Cash Application;
- AR Policy / Settings;
- Reporting.

## Customers

- company;
- contacts;
- billing email;
- billing address;
- payment terms;
- currency;
- tax information;
- outstanding balance;
- aging.

## Invoices

Fields:

- customer;
- invoice number;
- entity;
- line items;
- quantity;
- unit price;
- discounts;
- tax;
- due date;
- payment terms;
- currency;
- memo;
- attachments.

Statuses:

```text
Draft
Sent
Viewed
Partially Paid
Paid
Overdue
Void / Cancelled
```

## Collections

- reminder rules;
- overdue queue;
- collection sequence;
- customer communication;
- promise-to-pay;
- escalation;
- AI-assisted drafting where enabled.

## Incoming Payments

Track:

- payer;
- received amount;
- currency;
- received date;
- payment method;
- reference;
- unapplied balance.

## Cash Application

```text
Incoming Payment
→ Candidate Customer
→ Candidate Invoice(s)
→ Confidence / Evidence
→ Auto-Apply if Policy Allows
or
Human Review
→ Applied
```

Support partial payment, overpayment, multi-invoice allocation, and unapplied cash.

## Accounting

AR sync behavior must be provider-specific.

---

# 41. WEB — AI Token Spend Management

## Purpose

Consolidate AI usage and cost data so Finance/IT can understand:

- provider;
- model;
- user;
- API key;
- project/application;
- token usage;
- estimated/actual cost;
- trend;
- anomaly;
- configured limit.

## Navigation

Current Ramp documentation places the feature at:

```text
Manage Spend
→ Tokens
```

The replica may expose it under AI/Insights while preserving the underlying capability.

## Provider connections

Design adapters for:

- OpenAI;
- Anthropic;
- Google/Gemini/GCP billing;
- Cursor or other eligible providers;
- future provider integrations.

Provider eligibility and available dimensions vary.

## Sync

Current public Ramp documentation describes approximately T-1 daily freshness for token-spend data. Store:

- provider event date;
- ingestion date;
- latest successful sync;
- source cost;
- normalized cost.

## Controls

Support:

- API-key limit;
- user limit where provider supports;
- alerts;
- anomaly detection;
- ownership/attribution;
- threshold notifications.

Do not claim a hard enforcement capability for every provider. Some integrations can only alert because the underlying provider does not expose enforcement controls.

## Agent-spend attribution

Track agent usage when the connected provider exposes sufficient identifiers.

## Relationship to normal spend

AI Token Spend should be analyzable alongside:

- AI SaaS subscriptions paid by card;
- provider invoices in AP;
- procurement/contract commitments;
- API usage.

This gives a more complete AI total-cost view.

---

# 42. WEB — Ask AI / Finance Assistant

## Purpose

Permission-aware natural-language interface across financial data and workflows.

Examples:

- “How much did Marketing spend last month?”
- “Show overdue bills.”
- “Why was this card transaction declined?”
- “Which contracts renew next quarter?”
- “Compare our OpenAI spend with last month.”
- “Build a report of software spend by department.”
- “Draft a $10,000 software spend request.”

## Capabilities

### Read
- search authorized records;
- explain status;
- summarize spend;
- answer policy questions;
- analyze trends.

### Draft
- report;
- spend request;
- approval comment;
- vendor follow-up;
- collection email.

### Low-risk action
Only through explicit tools and normal permissions.

### High-risk action
Payments, transfers, card controls, vendor bank changes, and permission changes require deterministic authorization plus explicit confirmation and, where applicable, workflow approval.

## Required response metadata

For material finance answers show:

- scope;
- period;
- currency;
- filters;
- data freshness;
- linked source records.

---

# 43. WEB — Ramp Intelligence / AI Agent Surfaces

## Important product-design note

Do not assume Ramp exposes one universal "AI Agents" page to every customer. Some agents are embedded directly inside their native workflows.

For our replica, an optional consolidated **AI Operations** page can provide admin visibility, while each agent must still live in its domain.

## Agent families

### Expense / Policy
- Policy Agent;
- expense checks;
- receipt/memo/coding automation.

### Accounting
- Accounting Agent;
- coding suggestions;
- Ready automation;
- sync assistance.

### Accounts Payable
- AP inbox automation;
- invoice OCR;
- auto-coding;
- fraud detection;
- approval intelligence;
- eligible automatic card payments.

### Procurement / Contracts
- intake prefill;
- sourcing/RFP assistance;
- security/legal/vendor evaluations;
- contract analysis;
- price benchmarks;
- negotiation support.

### Reporting
- Reporting Agent;
- natural-language reports;
- drilldown.

### Receivables
- collections assistance;
- cash-application matching.

### AI Spend
- spend anomaly detection;
- provider/user/project attribution;
- Router request/cost intelligence.

## Optional admin AI Operations page

Display:

- agent;
- domain;
- enabled state;
- entitlement;
- tenant/entity scope;
- automation threshold;
- human-review policy;
- recent recommendations/actions;
- exceptions;
- audit events;
- estimated AI usage/cost.

## Safety

Every AI action must use normal application tools and RBAC. AI must never possess a backdoor permission path.

---

# 44. WEB — People

People list columns:

- name;
- email;
- status;
- manager;
- department;
- location;
- entity;
- roles;
- cards;
- active funds;
- identity source.

Actions:

- invite;
- edit;
- suspend;
- terminate;
- change manager;
- assign role;
- assign card/fund;
- reset sessions.

---

# 45. WEB — Person Detail

Tabs:

- Profile;
- Roles;
- Cards & Funds;
- Expenses;
- Requests;
- Travel;
- Activity.

Profile includes:

- name;
- employee ID;
- email;
- manager;
- department;
- location;
- job title;
- entity;
- start date;
- termination date;
- identity source.

---

# 46. WEB — Roles & Permissions

Role list:

- system roles;
- custom roles.

Custom role builder:

```text
Role Name
Description
Module Permissions
Action Permissions
Default Scope
Entity Restrictions
High-Risk Permissions
```

Permission preview:

> “Users with this role can approve bills up to $25,000 in Entity US-East but cannot release payments.”

---

# 47. WEB — Departments / Locations / Entities

Admin master-data pages.

## Departments
- hierarchy;
- manager;
- budget;
- members.

## Locations
- country;
- timezone;
- currency;
- address.

## Entities
- legal name;
- registration;
- country;
- functional currency;
- bank accounts;
- accounting connection;
- policies.

---

# 48. WEB — Policies

Policy categories:

- card spend;
- expense;
- receipt;
- reimbursement;
- travel;
- Bill Pay;
- procurement;
- vendor;
- accounting;
- treasury.

Policy rule builder:

```text
IF
Amount > 500
AND Category = Meals

THEN
Receipt Required
Memo Required
Manager Approval Required
```

Support:

- versioning;
- effective date;
- test mode;
- rule priority;
- audit history.

---

# 49. WEB — Approval Workflows

Reusable approval chains.

Examples:

### Spend Request
```text
Requester
→ Manager
→ Budget Owner if > $5k
→ Finance if > $25k
```

### Bill
```text
AP Review
→ Department Owner
→ Finance
→ CFO if > $100k
```

### Procurement
```text
Manager
→ Finance
→ Security
→ Legal
→ Procurement
```

Workflow page shows:

- trigger;
- conditions;
- steps;
- fallback;
- escalation;
- SLA.

---

# 50. WEB — Integrations

## Purpose

Integrations make Ramp-style finance workflows part of the customer's existing operational stack.

Current Ramp markets 200+ integrations; the replica should use a provider-adapter framework rather than trying to hard-code every provider.

## Categories

### Accounting / ERP
Examples:
- QuickBooks;
- NetSuite;
- Xero;
- Sage Intacct;
- Microsoft Dynamics;
- other accounting systems.

Data:
- chart of accounts;
- dimensions;
- vendors;
- customers;
- transactions;
- bills/payments;
- sync status.

### HRIS / People
Examples:
- Workday;
- ADP;
- BambooHR;
- other HRIS.

Data:
- people;
- manager;
- department;
- location;
- employment state;
- custom employee fields.

### Identity / Security
- SSO/SAML/OIDC;
- SCIM;
- Okta / Entra / other IdP;
- user provisioning/deprovisioning.

### Banking / Financial Data
- external bank accounts;
- balances;
- transactions;
- payment/funding rails;
- bank feeds.

### Collaboration
- Slack;
- Microsoft Teams.

Use:
- approvals;
- action notifications;
- request creation;
- reminders.

### Email / Documents
- Gmail;
- Outlook;
- AP inbox;
- receipt forwarding.

Use:
- receipt capture;
- invoice ingestion;
- vendor correspondence.

### Procurement / Legal / Security
- e-signature;
- contract management;
- security/compliance systems;
- ticketing/project tools.

### Travel
- booking/inventory/support provider;
- travel management integrations;
- calendar.

### AI Providers
- AI usage/billing ingestion;
- token controls;
- Router/model gateway.

### Data / Developer
- Developer API;
- webhooks;
- data warehouse/ETL;
- BI export.

## Connection detail

Every integration should expose:

- provider;
- connection owner;
- entity scope;
- authentication type;
- granted scopes;
- sync direction;
- sync frequency;
- last success;
- next sync;
- health;
- mapping;
- webhook state;
- error history;
- reconnect/disconnect.

## Principle

The domain layer talks to normalized interfaces; provider-specific behavior remains inside adapters.

---

# 51. WEB — Security

Pages:

- Authentication;
- SSO;
- MFA;
- SCIM;
- Sessions;
- API Applications;
- Webhooks;
- Security Events.

High-risk settings require step-up authentication.

---

# 52. WEB — Audit Log

Filters:

- actor;
- action;
- resource;
- date;
- entity;
- module;
- IP/device where available.

Audit record:

```text
Who
Did What
To What
Old Value
New Value
When
Source
Request / Correlation ID
```

Audit data must be immutable.

---

# 53. WEB — Notifications

Notification center.

Types:

- approvals;
- rejected items;
- missing receipts;
- payment failures;
- budget alerts;
- contract renewal;
- accounting sync failures;
- security events.

Channels:

- in-app;
- email;
- push;
- Slack/Teams.

Users can configure preferences subject to mandatory security alerts.

---

# 54. WEB — Company Settings

Sections:

- Business Profile;
- Branding;
- Default Currency;
- Fiscal Year;
- Timezone;
- Number Formats;
- Card Settings;
- Expense Settings;
- Reimbursement Settings;
- Bill Pay;
- Procurement;
- Travel;
- Accounting;
- Banking;
- Receivables;
- AI;
- Integrations;
- Billing.

---

# 55. Mobile App — Product Strategy

The mobile app is not a reduced desktop website.

Its purpose is:

> **Spend, capture, submit, approve, travel, and respond from anywhere.**

Mobile navigation should stay simple.

Recommended bottom navigation:

```text
Home
Cards
Expenses
Approvals
More
```

Floating / contextual actions can expose:

- Scan Receipt;
- Request Spend;
- Reimburse Me;
- Ask AI.

---

# 56. MOBILE — Home

Personalized mobile dashboard.

Employee view:

- card status;
- available funds;
- action required;
- missing receipts;
- pending request;
- next trip;
- recent transactions.

Manager view additionally shows:

- approvals waiting;
- team spend alert;
- urgent requests.

Finance approver additionally shows:

- high-value approvals;
- payment approvals;
- anomaly alerts.

---

# 57. MOBILE — Cards

Card wallet view.

Display:

- physical card;
- virtual cards;
- card status;
- last four;
- active funds;
- available amount;
- reset date.

Actions:

- view card details;
- copy virtual card number;
- freeze/unfreeze;
- report lost;
- request replacement;
- request more funds.

Sensitive details require biometric/PIN verification.

---

# 58. MOBILE — Fund Detail

Display:

- original amount;
- available amount;
- spent;
- period;
- reset;
- purpose;
- merchant/category restrictions;
- recent transactions.

Action:

- request increase.

---

# 59. MOBILE — Transactions

Recent transaction feed.

Each transaction shows:

- merchant;
- amount;
- date;
- card;
- status;
- receipt requirement.

Transaction detail:

- receipt;
- memo;
- accounting fields exposed to employee;
- policy state;
- approval state.

---

# 60. MOBILE — Receipt Capture

Core employee flow.

Methods:

- camera;
- photo library;
- file upload;
- share extension.

Camera flow:

```text
Open Scan
→ Auto-detect receipt
→ Capture
→ Crop/Enhance
→ OCR
→ Match Transaction
→ Confirm
```

AI extraction:

- merchant;
- date;
- amount;
- currency;
- tax.

User confirms before submission when confidence is low.

---

# 61. MOBILE — Expenses

Tabs:

- To Do;
- Submitted;
- Complete.

To Do may show:

- missing receipt;
- missing memo;
- missing category;
- policy issue.

Expense detail supports:

- upload receipt;
- add memo;
- select category;
- add attendees;
- complete custom fields;
- submit.

---

# 62. MOBILE — Reimbursements

Flow:

```text
New Reimbursement
→ Expense / Mileage / Per Diem
→ Enter Details
→ Attach Receipt
→ Submit
→ Track Status
```

Use device location only with explicit consent for optional mileage assistance.

---

# 63. MOBILE — Spend Requests

Flow:

```text
Request Spend
→ Amount
→ One-Time / Recurring
→ Vendor
→ Purpose
→ Date
→ Attachment
→ Submit
```

Status tracking:

- submitted;
- current approver;
- approved;
- rejected;
- fund/card issued.

---

# 64. MOBILE — Approvals

One of the most important mobile pages.

Tabs:

- Pending;
- Completed.

Approval cards show:

- type;
- requester;
- amount;
- vendor;
- reason;
- policy/AI recommendation.

Actions:

- approve;
- reject;
- request info;
- comment.

Swipe actions may be supported but high-value approvals should require deliberate confirmation.

---

# 65. MOBILE — Approval Detail

Context varies by object.

For spend request:

- amount;
- purpose;
- vendor;
- budget impact;
- history;
- AI recommendation.

For expense:

- receipt;
- amount;
- policy result;
- memo.

For bill:

- invoice;
- vendor;
- due date;
- PO match;
- bank change warning.

For payment:

- amount;
- source account;
- vendor;
- payment method.

---

# 66. MOBILE — Travel

Tabs:

- Upcoming;
- Past;
- Book.

Functions:

- search flight;
- search hotel;
- search car;
- see policy;
- trip itinerary;
- booking details;
- cancellation/change entry point;
- receipts/expenses.

---

# 67. MOBILE — Notifications

Push + in-app.

Categories:

- approval assigned;
- request approved;
- request rejected;
- missing receipt;
- card decline;
- suspicious activity;
- trip update;
- reimbursement paid;
- bill/payment approval;
- security alert.

Deep-link every notification to the relevant object.

---

# 68. MOBILE — Ask AI

Mobile conversational assistant.

Common shortcuts:

- “How much can I spend?”
- “Why was my card declined?”
- “Find my hotel booking.”
- “Which receipts am I missing?”
- “Create a $1,000 software request.”
- “Show approvals waiting for me.”

For executable action:

```text
User Request
→ AI Draft
→ Confirmation Screen
→ Execute
→ Audit
```

---

# 69. MOBILE — More

Menu:

- My Profile;
- My Requests;
- Reimbursements;
- Travel;
- Settings;
- Security;
- Support;
- Logout.

For authorized admins, optional:

- Team Spend;
- Payment Approvals;
- Emergency Card Controls.

Do not place complex accounting or system configuration in mobile.

---

# 70. Mobile Security

Required:

- device binding;
- biometric unlock;
- encrypted local storage;
- certificate/TLS enforcement;
- short-lived tokens;
- remote logout;
- device/session management.

Sensitive operations require re-authentication.

Examples:

- reveal full card number;
- approve large treasury payment;
- change payment instruction.

---

# 71. Role-to-Surface Access Matrix

Legend:

- **F** = Full
- **A** = Action/Approval
- **R** = Read
- **S** = Self only
- **T** = Team/Scoped
- **—** = No default access

| Module | Owner | Finance Admin | Accounting | AP | Procurement | Treasury | AR | IT | Manager | Employee | Auditor |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Home | F | F | F | F | F | F | F | R | T | S | R |
| People | F | T | R | R | R | R | R | F | T | S | R |
| Cards/Funds | F | F | R | R | T | R | — | — | T | S | R |
| Spend Requests | F | F | R | R | F | R | — | — | A/T | S | R |
| Expenses | F | F | F | R | R | R | — | — | A/T | S | R |
| Reimbursements | F | F | F | R | R | R | — | — | A/T | S | R |
| Procurement | F | T | R | R | F | R | — | — | A/T | S | R |
| Vendors | F | F | R | F | F | R | R | — | R/T | — | R |
| Contracts | F | F | R | R | F | R | — | — | R/T | — | R |
| Bill Pay | F | F | R | F | R | T | — | — | A/T | — | R |
| Payments | F | F | R | F | R | F | — | — | A/T | — | R |
| Banking | F | T | R | R | — | F | — | — | — | — | R |
| Accounting | F | T | F | R | R | R | — | — | — | — | R |
| Reports | F | F | F | T | T | F | T | — | T | S | R |
| Budgets | F | F | R | R | T | R | — | — | T | S | R |
| AR | F | T | R | — | — | R | F | — | — | — | R |
| AI Spend | F | F | R | — | T | R | — | T | T | S | R |
| Integrations | F | T | T | T | T | T | T | F | — | — | R |
| Security | F | R | — | — | — | — | — | F | — | S | R |
| Audit | F | T | T | T | T | T | T | F | — | — | R |

This is a baseline. Final deployment should support custom roles.

---

# 72. Detailed Approval Authority

Approval permission should not simply be boolean.

Use:

```text
ApprovalAuthority {
  object_type
  max_amount
  currency
  entity_scope
  department_scope
  category_scope
  vendor_scope
}
```

Example:

```text
User: CFO
Bills: up to unlimited
Payments: up to $1,000,000
Entity: US + UK

User: Engineering VP
Spend Requests: up to $25,000
Department: Engineering
```

---

# 73. Web vs Mobile Capability Matrix

| Capability | Web | Mobile |
|---|---:|---:|
| View cards/funds | Yes | Yes |
| Reveal virtual card | Yes | Yes |
| Freeze card | Yes | Yes |
| Issue company-wide cards | Yes | Limited/No |
| Submit receipt | Yes | Yes |
| Scan receipt | Optional webcam | Primary |
| Submit reimbursement | Yes | Yes |
| Spend request | Yes | Yes |
| Approvals | Yes | Yes |
| Full expense admin | Yes | Limited |
| Procurement workflow builder | Yes | No |
| Vendor administration | Yes | Limited |
| Bill entry | Yes | Optional limited |
| Bill approval | Yes | Yes |
| Payment release | Yes | Restricted mobile |
| Treasury transfer creation | Yes | Optional restricted |
| Accounting coding | Yes | No/Minimal |
| ERP setup | Yes | No |
| Reports | Full | Summary |
| Budget administration | Full | Read/approve |
| Travel booking | Yes | Yes |
| Policy builder | Yes | No |
| People admin | Yes | Limited |
| Roles/RBAC | Yes | No |
| Integrations | Yes | No |
| Audit log | Yes | No |
| Ask AI | Yes | Yes |

---

# 74. Shared Object Model

Core entities:

```text
Organization
Workspace
LegalEntity
User
EmploymentProfile
Role
Permission
Department
Location
ManagerHierarchy

BankAccount
BusinessLimit
Budget
SpendProgram
Fund
Card
CardAuthorization
Transaction

Expense
Receipt
Reimbursement
TravelTrip
TravelBooking

Vendor
VendorBankAccount
PurchaseRequest
ApprovalWorkflow
ApprovalStep
PurchaseOrder
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

Customer
Invoice
IncomingPayment
CashApplication

Policy
PolicyRule

IntegrationConnection
Webhook
Notification
Comment
Attachment
AuditEvent

AIConversation
AIDecision
AIRecommendation
AgentRun
```

---

# 75. Shared Workflow Engine

All approval-driven modules should use the same workflow engine.

Objects supported:

- spend request;
- expense;
- reimbursement;
- procurement;
- PO;
- vendor change;
- bill;
- payment;
- transfer;
- contract;
- invoice exception.

Workflow step:

```text
Step {
  type
  assignee_strategy
  conditions
  amount_threshold
  status
  sla
  escalation
}
```

Assignee strategies:

- manager;
- second-level manager;
- budget owner;
- department head;
- finance;
- CFO;
- controller;
- named user;
- role;
- custom group.

---

# 76. Shared Policy Engine

Policy engine should work across:

- card authorization;
- expense;
- reimbursement;
- travel;
- procurement;
- bill pay;
- vendor;
- accounting.

Result:

```text
PASS
WARN
REVIEW
BLOCK
```

Each result includes:

- rule;
- explanation;
- evidence;
- required action.

---

# 77. Card Authorization Architecture

Critical real-time flow:

```text
Card Swipe / Online Charge
        ↓
Card Active?
        ↓
User Active?
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
Approve / Decline
```

Card authorization must be deterministic and low latency.

AI should not be responsible for hard real-time authorization decisions.

---

# 78. Physical Card Model

Physical card:

- assigned to employee;
- one active primary card in common case;
- can access eligible employee funds;
- supports in-person and supported online purchase;
- can be frozen/replaced;
- spend is constrained by policy/fund controls.

The card does not represent an employee bank account.

---

# 79. Virtual Card Model

Virtual card:

- unique card number;
- may be employee-specific;
- may be vendor-specific;
- may be single-purpose;
- may be recurring;
- may be linked to one spend request/program.

Examples:

```text
AWS Card — $20,000/month
OpenAI Card — $5,000/month
Meta Ads Card — $30,000/month
```

Benefits:

- isolated controls;
- easier vendor shutdown;
- subscription ownership;
- lower blast radius.

---

# 80. Budget vs Fund vs Business Limit

These must remain separate.

## Bank Balance
Actual money held in company bank accounts.

## Business Limit / Credit Capacity
Maximum company-wide spend exposure allowed by card/credit arrangement.

## Budget
Planning and management target.

## Fund / Spend Limit
Actual employee or vendor spending permission.

Example:

```text
Bank Balance      = $500,000
Business Limit    = $200,000
Marketing Budget  = $100,000
Ali Ad Fund       = $15,000/month
```

---

# 81. Integration Architecture

Use an adapter-based integration architecture.

```text
Domain Module
    ↓
Normalized Integration Interface
    ↓
Provider Adapter
    ↓
External System
```

## Major adapter families

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
E-SignProvider
AIUsageProvider
LLMProvider
DataExportProvider
```

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

- external ID;
- connection ID;
- sync cursor;
- provider timestamps;
- normalization version;
- last successful sync;
- error;
- retry count.

## Integration examples by business purpose

- HRIS updates a terminated employee → revoke access / freeze or terminate cards based on policy.
- Accounting provider supplies chart/dimensions → coding options become available.
- Gmail/Outlook receipt connection → receipt matched to card transaction.
- AP inbox connection → invoice email becomes draft bill.
- Slack/Teams → approver can act from collaboration surface through secure deep link/action.
- Bank feed → treasury/accounting visibility.
- AI provider → token usage/cost attribution.

---

# 82. AI Architecture

AI is an embedded intelligence layer, not a replacement for deterministic finance controls.

## 82.1 Core AI capabilities

- OCR and document extraction;
- receipt matching;
- memo generation;
- accounting suggestions;
- policy review;
- duplicate/fraud/anomaly signals;
- bill coding;
- procurement intake prefill;
- sourcing summaries;
- contract intelligence;
- reporting;
- collections drafting;
- cash application matching;
- AI spend anomaly analysis.

## 82.2 Agent architecture

```text
User / Event
    ↓
Agent Orchestrator
    ↓
Permission + Scope Context
    ↓
Approved Tools
    ↓
Domain Services
    ↓
Audit
```

Agents do not receive unrestricted database access.

## 82.3 Recommendation contract

Every material recommendation should include:

```text
recommendation
confidence
evidence
source objects
policy/rule references
human review required?
```

## 82.4 Deterministic controls override AI

AI cannot override:

- RBAC;
- approval authority;
- payment release policy;
- card spend controls;
- hard policy blocks;
- entity scope;
- audit requirements.

## 82.5 Router

Current Ramp now exposes Router as a separate AI-model gateway product.

Replica architecture may include:

```text
Application
→ Router-Compatible Endpoint
→ Routing Strategy
→ Provider / Model
```

Router requirements:

- OpenAI-compatible API shape where practical;
- multi-provider/model access;
- request-level usage/cost logging;
- latency;
- fallback attempts;
- routing strategy;
- model evaluation/benchmarking;
- cost/quality/availability rules.

Advanced strategies such as flex-tier selection, shadow traffic, benchmark routing, and difficulty-based routing should be optional later phases rather than MVP requirements.

## 82.6 Stack

Stack is a separate AI accounting operating system surface, not merely an agent inside normal Ramp Accounting.

See dedicated section below.

---

# 83. Notification System

Event-driven notification model.

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

Delivery:

- web in-app;
- mobile push;
- email;
- Slack;
- Teams.

---

# 84. Search and Command Layer

Global search should support both:

### Traditional search
```text
OpenAI
INV-10034
John Smith
$4,500
```

### Natural language
```text
“Show OpenAI spend this year”
“Bills due next week”
“Expenses missing receipts”
```

AI search must only return objects the user is authorized to see.

---

# 85. Multi-Entity Design

Company may have:

```text
Parent Company
├── US LLC
├── UK Ltd
└── UAE Entity
```

Every financial object must carry:

```text
entity_id
currency
accounting_context
```

User access may be:

- one entity;
- selected entities;
- entire organization.

Cross-entity dashboards require currency normalization.

---

# 86. Multi-Currency

Store:

- source currency;
- source amount;
- settlement currency;
- settlement amount;
- FX rate;
- reporting currency amount.

Never overwrite original transaction currency.

---

# 87. Mobile Offline / Poor Network Behavior

Mobile should allow safe temporary capture for:

- receipt photos;
- draft reimbursement;
- draft memo.

Financial approvals and card changes require online confirmation.

---

# 88. Error States

Every page must support:

- loading;
- empty;
- partial data;
- permission denied;
- integration disconnected;
- sync delayed;
- failed;
- retry available.

Examples:

### Accounting Integration Failure
Show:
- failed item count;
- reason;
- retry;
- mapping issue;
- connection issue.

### Bank Sync Failure
Show:
- last successful sync;
- reconnect action;
- whether balances may be stale.

---

# 89. Audit Requirements

Every critical mutation should store:

- actor;
- acting-as/delegated user;
- object;
- object ID;
- old values;
- new values;
- timestamp;
- source;
- device/IP if applicable;
- correlation ID;
- AI agent ID if AI initiated;
- approval reference.

---

# 90. Key End-to-End User Journeys

## Journey 1 — Employee provisioning

```text
HRIS / Admin
→ User
→ Manager + Department + Entity
→ Role / Permission
→ Eligible Spend Program
→ Card / Fund Issuance
→ App Activation
```

## Journey 2 — Card expense

```text
Card Purchase
→ Authorization Controls
→ Pending Transaction
→ Clear
→ Receipt Capture / Match
→ Requirements
→ Policy Agent / Review
→ Accounting Coding
→ Ready to Sync
→ ERP
→ Reporting / Audit
```

## Journey 3 — Spend request

```text
Select Program
→ Request
→ Approval Workflow
→ Approved
→ Fund / Virtual Card / Procurement / PO
→ Purchase
```

## Journey 4 — Reimbursement

```text
Employee Personal Spend
→ Reimbursement
→ Receipt/OCR
→ Requirements/Policy
→ Approval
→ Payment
→ Accounting Sync
```

## Journey 5 — Bill Pay

```text
Invoice Email/Upload
→ OCR Draft
→ Vendor
→ Duplicate/Fraud Check
→ Coding
→ PO Match
→ Bill Approval
→ Payment Setup
→ Payment Release
→ Settlement
→ Accounting
```

## Journey 6 — Partial Bill Pay

```text
Approved Bill
→ Split Payment
→ Payment 1 Scheduled
→ Payment 2 Scheduled / Unscheduled
→ Individual Settlement Tracking
→ Remaining Balance
→ Final Payment
→ Bill Paid
```

## Journey 7 — Procurement

```text
Program
→ Request
→ Manager
→ Parallel IT/Security/Legal as Required
→ Vendor Onboarding
→ Final Approval
→ PO
→ Receive
→ Bill/Card Match
→ 2-Way/3-Way Match
→ Payment
→ Accounting
```

## Journey 8 — Contract renewal

```text
Contract
→ Action Date Approaches
→ Reminder
→ Renewal Request
→ AI Prefill / Benchmark
→ Approval / Negotiation
→ Renewal / Non-Renewal
→ Updated Contract/PO
```

## Journey 9 — Travel booking

```text
Search
→ Policy Evaluation
→ In Policy?
   ├─ Yes → Book
   └─ No → Travel Request
→ Trip
→ Card Spend
→ Auto Expense Context
→ Accounting
```

## Journey 10 — Off-platform travel

```text
Eligible Travel Fund
→ External Booking
→ Confirmation Email
→ Trip / Itinerary
→ Card Transactions
→ Auto Link
→ Expense / Accounting
```

## Journey 11 — Accounting close

```text
Source Transactions
→ Requirements
→ Coding
→ Review
→ Ready
→ Auto/Manual Sync
→ Error Handling
→ Reconciliation
```

## Journey 12 — Treasury transfer

```text
Create Transfer
→ Approval
→ Step-up Auth
→ Release
→ Bank Processing
→ Completion
→ Accounting / Audit
```

## Journey 13 — Receivables

```text
Customer
→ Invoice
→ Send
→ Due
→ Collections
→ Incoming Payment
→ Cash Application
→ Accounting
```

## Journey 14 — AI token spend

```text
Provider Connection
→ Usage Import
→ User/API Key/Model Attribution
→ Cost Normalization
→ Limits / Alerts
→ Anomaly Detection
→ Reporting
```

## Journey 15 — Vendor portal

```text
Payer Invites Vendor
→ Vendor Account
→ Payment/Tax Details
→ Bill Communication
→ Payment Status
→ Secure Updates
```

## Journey 16 — Advisor Console

```text
Accounting Firm
→ Connect Clients
→ Assign Staff
→ Cross-Client Reporting
→ Close Projects
→ AI Coworker / Knowledge
→ Client Billing
```

---

# 91. Recommended MVP vs Full Ramp-Parity Product

This is a very large platform. Build by dependency, not by menu order.

## Phase 1 — Platform Foundation

- organizations;
- legal entities;
- people;
- RBAC + scopes;
- audit;
- policies;
- approval/workflow engine;
- event/outbox;
- integration framework;
- documents.

## Phase 2 — Cards & Spend

- card/provider abstraction;
- physical/virtual cards;
- Funds / Spend Limits;
- Spend Programs;
- requests;
- authorizations;
- transactions.

## Phase 3 — Expense Management

- receipt capture;
- OCR;
- receipt matching/verification;
- submission requirements;
- approvals;
- Policy Agent;
- splits;
- reimbursements;
- mobile expense capture.

## Phase 4 — Accounting

- accounting dimensions;
- coding;
- rules;
- Ready-to-Sync lifecycle;
- ERP adapters;
- sync errors;
- auto-ready/auto-sync controls.

## Phase 5 — AP / Bill Pay

- invoice intake;
- OCR;
- vendor;
- bills;
- approval;
- payment setup;
- payment release;
- payment methods;
- partial payments;
- Payment Runs;
- AP AI.

## Phase 6 — Procurement / Vendor / Contract

- Programs;
- purchase requests;
- multi-branch workflows;
- vendor onboarding;
- PO;
- receiving;
- 2-way/3-way match;
- contracts;
- renewals;
- sourcing;
- Price Intelligence.

## Phase 7 — Travel

- policy;
- flights/hotels/cars integration;
- trip;
- travel request;
- guest/delegate;
- off-platform booking context;
- expense automation;
- reporting;
- Hotel Price Drop equivalent if provider supports.

## Phase 8 — Insights / Budgets / Savings

- reporting;
- Reporting Agent;
- budgets;
- savings;
- Price Intelligence;
- license intelligence.

## Phase 9 — Banking / Treasury

Only after regulated/provider partnerships are defined:

- accounts;
- balance/transactions;
- transfers;
- approvals;
- automations;
- statements;
- cash forecast.

## Phase 10 — Receivables

- customers;
- invoices;
- collections;
- incoming payments;
- cash application.

## Phase 11 — AI Spend + Router

- token provider connections;
- usage/cost attribution;
- limits;
- anomaly;
- model gateway/router;
- request-level observability.

## Phase 12 — External / Specialist Products

- Vendor Portal;
- Advisor Console;
- Stack-like close/bookkeeping OS;
- advanced global/multi-entity;
- rewards/cashback;
- advanced procurement/contract intelligence.

## Phase 13 — Advanced Agents

Add only after deterministic workflows are reliable:

- autonomous draft preparation;
- low-risk automation;
- AP inbox agent;
- procurement sourcing agent;
- collections agent;
- close/accounting coworker.

Human approval remains mandatory for high-risk financial actions.

---

# 92. Recommended Web Route Architecture

Suggested application routes:

```text
/app
  /home
  /inbox
  /search

  /me
    /cards
    /expenses
    /requests
    /reimbursements
    /travel

  /spend
    /cards
    /funds
    /programs
    /requests
    /transactions

  /expenses
    /transactions
    /reimbursements
    /travel

  /procurement
    /requests
    /programs
    /purchase-orders
    /receiving
    /sourcing
    /contracts
    /renewals

  /vendors

  /bill-pay
    /bills
    /payments
    /payment-runs
    /recurring
    /settings

  /travel
    /search
    /requests
    /trips
    /travelers
    /policy
    /reports

  /accounting
    /overview
    /card
    /reimbursements
    /bill-pay
    /banking
    /review
    /ready-to-sync
    /synced
    /errors
    /rules
    /integrations

  /banking
    /accounts
    /transactions
    /transfers
    /automations
    /forecast
    /statements

  /insights
    /dashboard
    /reports
    /budgets
    /savings
    /price-intelligence
    /license-intelligence

  /receivables
    /customers
    /invoices
    /collections
    /payments
    /cash-application

  /ai
    /ask
    /activity
    /token-spend
    /router

  /company
    /people
    /departments
    /locations
    /entities
    /rewards
    /roles
    /policy
    /approvals
    /integrations
    /security
    /audit
    /billing
    /settings
```

Specialized portals:

```text
/vendor-portal
/advisor-console
/stack
```

Actual menu visibility is entitlement + RBAC driven.

---

# 93. Recommended Mobile Route Structure

```text
/(tabs)
  /home
  /cards
  /expenses
  /approvals
  /more

/cards
  /[id]
  /[id]/funds

/transactions
  /[id]

/expenses
  /[id]
  /scan

/reimbursements
  /new
  /[id]

/requests
  /new
  /[id]

/approvals
  /[id]

/travel
  /search
  /trips
  /trips/[id]

/ai
  /ask

/settings
  /profile
  /notifications
  /security
```

---

# 94. Design System Requirements

The uploaded Ramp screenshots confirm that this product should use a **dense, table-first enterprise finance design system**, not a marketing-style dashboard UI.

## 94.1 Core visual tokens

Define and version:

- typography families and weights;
- display, page-title, section-title, body, label, caption, and numeric scales;
- 4/8px spacing scale;
- container widths;
- sidebar expanded/collapsed widths;
- table row heights for comfortable and compact density;
- border radii;
- divider/border tokens;
- surface elevations;
- shadow tokens;
- success/warning/error/info/neutral semantic colors;
- focus-ring token;
- skeleton/loading tokens;
- motion duration/easing;
- breakpoint system.

Recommended density modes:

```text
Comfortable
Compact
High-density accounting
```

## 94.2 Shared components

- Button / IconButton
- Input / Textarea
- Search
- Select / Combobox
- MoneyInput
- Date / DateRange
- StatusBadge
- Avatar / MerchantLogo
- Card
- Tabs
- FilterChip
- DataTable
- ColumnChooser
- SavedViewPicker
- BulkActionBar
- Drawer
- Modal
- Tooltip
- DropdownMenu
- Stepper
- ApprovalProgress
- ApprovalTimeline
- ReceiptViewer
- DocumentViewer
- CommentThread
- AuditTimeline
- EmptyState
- ErrorState
- WarningBanner
- MetricCard
- Chart
- AIRecommendationPanel

## 94.3 Ramp-style table UX

The product is fundamentally table-driven. The uploaded images show this repeatedly across Accounting, Vendors, Bill Pay, and Procurement.

Every major financial table should support, where relevant:

- sticky header;
- sticky first/last action columns;
- column chooser;
- column resizing;
- column reordering;
- horizontal scrolling for finance dimensions;
- sorting;
- server-side filtering;
- filter chips;
- date-range filters;
- saved/custom views;
- inline editing;
- row selection;
- select-all across current result set;
- bulk actions;
- export permission checks;
- pagination or virtualization;
- row expansion;
- right-side detail drawer;
- provider-specific columns;
- totals / selected totals where useful;
- keyboard navigation;
- optimistic inline UI only for low-risk edits.

### Screenshot-derived examples

**Accounting** should dynamically show provider-specific fields such as:

```text
NetSuite Subsidiary
NetSuite Category
QuickBooks Department
QuickBooks Class
QuickBooks Job
Accounting Category
Receipt
Sync / Ready state
```

The exact columns depend on the connected ERP and entity.

**Vendor Management** should support columns such as:

```text
Vendor
Owner
Category
Total Spend
Last 30 Days
Trend
Next Payment
Frequency
Owner Department
Contract/Renewal State
```

**Procurement Requests** should support:

```text
Request Name
Approvals Progress
Request / Fulfillment Type
Amount / Frequency
Next Approver
Request Date
```

**Bill Pay** should expose stage-oriented views such as:

```text
Overview
Drafts
For Approval
For Payment
History
Urgent
International Wires
Payment Failures
```

Actual tabs should be feature-flagged because Ramp changes navigation over time.

## 94.4 Status semantics

Use semantic states consistently:

- success/compliant/ready;
- attention/review;
- blocked/failed;
- pending/in progress;
- informational;
- disabled/not applicable.

Do not rely on color alone. Always include text, icon, or other redundant meaning.

## 94.5 Drawer-first review pattern

For queue-heavy workflows:

```text
List / Table
    ↓
Open Row
    ↓
Right Detail Drawer
    ↓
Review Context
    ↓
Approve / Reject / Edit / Next
```

Use this pattern for:

- Inbox;
- Expenses;
- Accounting;
- AP approvals;
- Procurement approvals;
- Vendor review.

## 94.6 Accessibility target

Target **WCAG 2.2 AA** for Web and equivalent native accessibility behavior for mobile.

Required:

- full keyboard navigation;
- visible focus;
- semantic table markup where possible;
- screen-reader labels;
- accessible modal/drawer focus trapping;
- color contrast compliance;
- reduced-motion preference;
- non-color status meaning;
- chart summaries / accessible data alternatives;
- minimum touch-target sizing;
- error summaries and field-level associations.

---

# 95. UX Principles

1. **Action first** — show what the user needs to do now.
2. **Context beside action** — approvers should not open five pages to understand a request.
3. **One object, one history** — comments, approvals, audit, documents remain attached.
4. **AI explains itself** — recommendation + evidence.
5. **Progressive disclosure** — simple for employees, powerful for finance.
6. **Mobile for speed** — receipts and approvals optimized for one-hand use.
7. **Safe defaults** — dangerous actions require deliberate confirmation.
8. **Permission aware** — never show controls users cannot execute.
9. **Financial precision** — currency, dates, entity, status must always be explicit.
10. **Traceability** — every number should drill down to underlying transactions.

---

# 96. Non-Functional Requirements

## Performance

Initial product targets:

- Web shell interactive target: under 3 seconds on a normal business network.
- Common API reads: p95 under 500 ms where no external provider is required.
- Normal table filtering/sorting should feel immediate after server response.
- Card authorization and other real-time controls require a separate low-latency target defined with the issuing/provider architecture.
- OCR, AI, ERP sync, exports, imports, large reports, and document analysis run asynchronously.

## Reliability

Required:

- idempotency for financial writes;
- retry-safe jobs;
- transactional outbox;
- immutable financial/audit history;
- deterministic state machines;
- reconciliation jobs;
- dead-letter handling;
- duplicate-event protection;
- external-provider timeout and circuit-breaker policy.

## Availability and SLOs

Define explicit service-level objectives before production.

Recommended classes:

```text
Tier A: Card authorization / payment release / treasury controls
Tier B: Transaction, expense, AP, accounting APIs
Tier C: Reporting, AI, exports, non-critical analytics
```

Each tier must define:

- availability target;
- p95/p99 latency;
- error-budget policy;
- escalation policy;
- dependency health.

## Disaster Recovery

Define and test:

- PostgreSQL backup frequency;
- point-in-time recovery where supported;
- file/NAS backup;
- Redis recovery expectations;
- RPO;
- RTO;
- restore drills;
- provider credential recovery;
- incident runbooks.

For on-prem deployment, backups must be copied to physically separate storage.

## Observability

Implement:

- structured application logs;
- immutable audit logs;
- metrics;
- traces / correlation IDs;
- queue health;
- sync health;
- webhook delivery health;
- payment/reconciliation alerts;
- AI latency/cost/failure metrics;
- provider status dashboards.

## Security

- encryption in transit and at rest;
- MFA;
- SSO/SAML/OIDC where required;
- SCIM;
- server-side RBAC;
- entity/data scopes;
- approval authority;
- separation of duties;
- step-up auth for high-risk actions;
- session/device management;
- secrets isolation;
- token rotation;
- card-data tokenization / PCI scope minimization;
- attachment malware scanning;
- immutable audit trail.

## Privacy / Compliance Operations

The product needs explicit workflows for:

- KYB/KYC ownership and review;
- sanctions screening responsibilities;
- privacy requests;
- data export/deletion request handling;
- legal retention schedules;
- consent records;
- vendor tax-document retention;
- country-specific regulatory configuration;
- data residency controls where contractually required;
- privileged-access review.

Do not claim certifications until independently audited.

## AI Governance

Every production AI capability should track:

```text
Agent / Model
Model Version
Prompt / Skill Version
Input Sources
Tool Calls
Confidence / Decision Metadata
Human Override
Cost
Latency
Evaluation Result
Rollback Version
```

Required controls:

- PII/secret redaction where appropriate;
- provider retention configuration;
- allowlisted tools;
- tool-level RBAC;
- financial-action confirmation;
- evaluation suites;
- hallucination/error monitoring;
- spend caps;
- model fallback;
- incident rollback.

## Product Analytics

Track product-health events such as:

- time to first card/fund;
- first successful transaction;
- receipt-compliance rate;
- expense completion time;
- approval latency;
- card decline rate;
- policy violation rate;
- bill cycle time;
- payment failure rate;
- AP straight-through-processing rate;
- accounting auto-code rate;
- auto-ready rate;
- auto-sync success rate;
- sync error rate;
- procurement cycle time;
- vendor onboarding time;
- travel out-of-policy rate;
- budget utilization;
- AI recommendation acceptance/override rate;
- feature adoption by role/module.

---

# 97. Backend Domain Boundaries

Recommended modular-monolith domains:

```text
Identity
Organization
Legal Entity
RBAC
People

Policy
Approval Workflow
Budget

Cards
Funds
Spend Programs
Spend Requests
Authorizations
Transactions

Expenses
Receipts
Reimbursements

Procurement
Purchase Orders
Receiving
Vendor
Contracts
Renewals
Sourcing
Price Intelligence
License Intelligence

Bills
Payments
Payment Runs

Travel

Banking / Treasury

Accounting
Reconciliation
ERP Sync

Receivables
Collections
Cash Application

Rewards

AI Token Spend
Router

Reporting
Search
Documents / OCR
Integrations
Notifications
Audit
AI Orchestration
```

Specialized bounded contexts:

```text
Vendor Portal
Advisor Console
Stack
```

Start as a modular monolith, but keep provider/payment/card/travel integrations behind interfaces so high-load or regulated components can be isolated later.

---

# 98. Event Bus

Important events:

```text
user.created
user.terminated
card.issued
card.frozen
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
payment.completed
vendor.bank_changed
po.created
contract.renewal_due
transfer.created
transfer.completed
accounting.ready
accounting.synced
invoice.sent
invoice.paid
```

Subscribers:

- notifications;
- reporting;
- audit;
- accounting;
- budgets;
- AI;
- integrations.

---

# 99. Core Data Synchronization Rules

Example: cleared card transaction.

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

Example: employee terminated.

```text
HRIS Termination
→ User Status Disabled
→ Login Revoked
→ Cards Frozen/Terminated per Policy
→ Spend Programs Removed
→ Pending Approvals Reassigned
→ Audit Written
```

Example: bill paid.

```text
Payment Completed
→ Bill Balance Reduced
→ AP Aging Updated
→ Cash Balance/Forecast Updated
→ Vendor Payment History Updated
→ Accounting Sync Updated
→ Reporting Updated
```

---

# 100. Minimum Acceptance Criteria

The product is not complete because pages render; each domain must prove the end-to-end behavior.

## Cards & Spend

- physical and virtual card/provider abstractions work;
- Funds/Spend Limits enforce controls;
- Spend Programs produce correct requests/funds/cards;
- authorization is concurrency-safe and idempotent;
- card transaction lifecycle is traceable.

## Expenses

- receipts can be captured;
- matching and verification work;
- missing requirements are tracked;
- Policy Agent recommendations include evidence;
- reviewer action is auditable;
- splits balance exactly;
- transaction/accounting state stays synchronized.

## Reimbursements

- standard, mileage, and per-diem workflows work where enabled;
- policy/approval route is correct;
- payout state and accounting state stay separate;
- international/currency data is preserved.

## Bill Pay

- invoice → OCR draft → bill → approval → payment works;
- duplicate/fraud checks exist;
- bill approval and payment release are separate;
- multiple payment rails are abstracted;
- partial payments maintain remaining balance correctly;
- Payment Runs release batches without losing payment-level status;
- ERP sync is idempotent.

## Procurement

- request starts from Program/intake;
- multi-step/parallel approvals work;
- final approval can create a PO;
- receiving works;
- 2-way and 3-way matching work;
- material change can route through change approval;
- vendor/contract/PO/bill/card links are traceable.

## Vendor / Contract

- vendor onboarding and change approval work;
- sensitive payment-detail changes are strongly controlled;
- contract ingestion/extraction retains source evidence;
- renewals and expansions remain linked to original contract.

## Travel

- flight/hotel/car search/booking provider integration works;
- policy is enforced pre-purchase;
- out-of-policy booking becomes request where configured;
- trips link bookings and card spend;
- guest/delegate permission works;
- cancellations/modifications follow provider capabilities;
- Employee Rewards remains feature-flagged until GA is verified.

## Accounting

- source transactions remain immutable;
- coding/rules are deterministic;
- Ready-to-Sync eligibility is enforced;
- auto-ready/auto-sync can be configured safely;
- sync failures retry without duplicates;
- provider-specific mappings remain isolated.

## Reporting / Insights

- every KPI drills to source records;
- currency/time range/data freshness is explicit;
- Reporting Agent respects permissions.

## Banking / Treasury

- no regulated real-money behavior is enabled without a valid provider;
- transfer approvals and release are separated where configured;
- account balances show freshness/source;
- automations are auditable.

## Receivables

- invoice lifecycle works;
- collections workflow works;
- incoming payments can be partially/multi-invoice applied;
- unapplied cash is represented explicitly.

## AI Token Spend / Router

- provider usage imports idempotently;
- provider/model/key/user/project attribution is retained;
- limits distinguish hard-enforcement vs alert-only;
- Router logs model/provider/tokens/latency/cost/fallback;
- AI cannot bypass financial RBAC.

## Portals

- Vendor Portal exposes only vendor-scoped data;
- Advisor Console separates firm-level and client-level access;
- Stack-like accounting workspace remains separately permissioned.

## Security / RBAC

- no cross-tenant leakage;
- entity/team scopes work;
- server-side enforcement is authoritative;
- high-risk actions require explicit authority;
- all material changes are audited.

---

# 101. Final Product Summary

The verified Ramp-style product is best understood as seven connected layers.

```text
LAYER 1 — ORGANIZATION & CONTROL
People
Entities
Roles
Permissions
Policies
Approvals
Budgets

LAYER 2 — SPEND
Cards
Funds / Spend Limits
Spend Programs
Spend Requests
Transactions
Expenses
Reimbursements

LAYER 3 — PROCURE-TO-PAY
Procurement
Vendor Management
Sourcing
Contracts
Renewals
Purchase Orders
Receiving
Bill Pay
Payments
Payment Runs

LAYER 4 — TRAVEL
Policy
Booking
Trips
Guests / Delegates
Travel Expenses
Travel Reporting

LAYER 5 — FINANCIAL SYSTEM
Accounting
ERP Sync
Banking / Treasury
Receivables
Reporting
Savings
Rewards

LAYER 6 — INTELLIGENCE
Policy Agent
Accounting Agent
AP Agents
Procurement / Contract Intelligence
Reporting Agent
AI Token Spend
Router
Ask AI

LAYER 7 — SPECIALIZED PORTALS
Vendor Portal
Advisor Console
Stack
```

The key architectural principle remains:

> **One company data graph, one permission/policy/approval backbone, many finance workflows.**

A purchase should never become an isolated record. It should remain connected from request and approval through payment, accounting, reporting, and audit.

---

# 102. Recommended Delivery Principle

Do not begin by cloning every screen visually.

Build in this order:

```text
Shared Data Model
→ RBAC
→ Approval Engine
→ Policy Engine
→ Audit/Event Layer
→ People/Entity Master Data
→ Spend/Cards
→ Expenses
→ Accounting
→ AP
→ Procurement
→ Reporting
→ Treasury/AR
→ AI Agents
```

UI development can run in parallel, but business logic should follow this dependency order.

This is the foundation required for a genuine enterprise-grade Ramp-style financial operations product.

---

# 103. Verification Report — Uploaded Videos vs Current Ramp

## 103.1 Expense Tracking video

### Observed in video

- personalized Home with "items need your attention";
- missing receipt/memo prompts;
- transaction detail drawer;
- receipt upload;
- memo entry;
- accounting/category input;
- Inbox with multiple operational queues;
- Accounting > Ramp Card queue/table;
- Expenses > Transactions view;
- Accounting > Payments;
- external NetSuite screens after synchronization.

### Verification result

**MATCHES current Ramp direction.**

The current document should treat Expense Management as the combination of:

```text
Transaction
+ Receipt
+ Requirements
+ Policy
+ Review
+ Accounting
```

rather than a traditional standalone expense-report system.

### Corrections applied

- strengthened receipt verification;
- added connected-inbox/SMS receipt paths;
- added conditional expense requirements;
- added split accounting;
- added Policy Agent/full-expense-check semantics;
- clarified Accounting handoff.

---

## 103.2 Payable video

### Observed in video

Bill Pay screen with:

- Overview;
- Drafts;
- For approval;
- For payment;
- History;
- saved/custom view;
- Recurring bills;
- New bill.

New bill workflow visibly shows:

```text
Forward Invoice Email / Upload
→ Invoice Preview
→ Vendor
→ Invoice Number / Dates
→ Description
→ Line Items
→ Payment Details
→ Schedule or Skip
→ Approval Chain
```

Payment choices demonstrated include ACH/check/card paths.

### Verification result

**CORE FLOW MATCHES current Ramp; current Ramp has expanded beyond the video.**

Current product documentation now adds:

- more payment rails;
- payment release as separate control;
- Payment Runs;
- partial payments;
- AP Agents;
- richer fraud/duplicate/approval intelligence.

### Corrections applied

All of those are now explicitly represented.

---

## 103.3 Procurement video

### Observed in video

```text
Request Purchase
→ Manager
→ IT
→ Security
→ Legal
→ Purchase Order
```

The video also shows:

- upfront accounting coding;
- PO detail;
- document/activity/comments;
- PO options;
- bills and card spend;
- receiving;
- invoice line validation;
- variance checks;
- receiving-oriented PO list.

### Verification result

**STRONG MATCH with one important correction.**

Normal Ramp procurement starts from:

```text
Request + Program
```

and the PO is normally created after final approval.

The old draft's generic "PO Create/Edit" concept could mislead engineering into using the PO as the intake form.

### Corrections applied

- Request + Program made the primary entry point;
- PO creation made an approval outcome;
- 2-way / 3-way matching added;
- receiving added;
- contracts/renewals/expansions strengthened;
- vendor onboarding integrated;
- Price Intelligence / License Intelligence added.

---

## 103.4 Travel video

### Observed in video

Admin:

- Travel policy;
- approvals;
- Employee Rewards configuration;
- savings split;
- annual reward maximum;
- cashback funding;
- checking account;
- Per Diem.

Employee:

- hotel search;
- map;
- policy;
- stars;
- price;
- refundable filter;
- rewards;
- in/out-of-policy behavior.

Post-trip/Admin:

- travel dashboard;
- trip/spend analytics;
- CSV export;
- QuickBooks sync.

### Verification result

**CORE TRAVEL FLOW MATCHES, but Employee Rewards status differs.**

Current Ramp documentation verifies:

- flights;
- hotels;
- rental cars;
- policy enforcement;
- approval flows;
- traveler profile;
- trips;
- guest/delegate booking;
- Hotel Price Drop;
- off-platform travel support.

However, current official webinar content still describes **Employee Rewards as upcoming/on the roadmap**.

### Required handling

Employee Rewards must be:

```text
FEATURE FLAG / ROADMAP
```

until current GA is confirmed.

The video is therefore useful as a UX reference, but not sufficient evidence to classify the feature as generally available.

---

# 104. Additional Current Ramp Surfaces Missing From the Original Draft

## 104.1 Vendor Portal

External vendor-facing portal.

Capabilities:

- invited vendor registration;
- company/profile details;
- payment details;
- tax details;
- payment tracking;
- bill communication/comments;
- secure updates.

Security principle:

```text
Vendor Account
→ Vendor-Scoped Data Only
```

No internal customer finance visibility.

---

## 104.2 Advisor Console

Product for partner accounting firms.

Current core surfaces include:

- Clients;
- People;
- client/staff assignment;
- Reporting;
- Projects / Close Checklist;
- Knowledge;
- Billing;
- Price Intelligence;
- Ramp Academy;
- referrals/rewards.

Role model should distinguish:

```text
Advisor Console Role
+
Client Assignment
+
Client-Level Permission
```

---

## 104.3 Stack

Ramp currently describes Stack as an AI accounting operating system for bookkeeping and close.

Current publicly documented areas include:

- bookkeeping work review;
- month-end close;
- reconciliations;
- reusable skills/instructions;
- AI coworker;
- financial statements;
- client portfolio use for accounting firms;
- usage tracking.

Current public documentation notes that Stack presently focuses on QuickBooks Online and straightforward bookkeeping workflows.

Replica recommendation:

Treat Stack as a **separate accounting workspace**, not as the same page as transaction sync.

---

## 104.4 AI Token Spend + Router

AI Token Spend Management:

```text
Provider
→ Usage
→ Model
→ API Key/User/Project
→ Cost
→ Limits
→ Anomalies
```

Router:

```text
One API Endpoint
→ Routing Strategy
→ Model / Provider
→ Usage + Latency + Cost + Fallback
```

Current Ramp Router documentation additionally discusses:

- flex-tier optimization;
- shadow models;
- benchmark routing;
- difficulty-based routing;
- request-level trace/cost explanation.

These advanced strategies should be later-phase capabilities.

---

## 104.5 Rewards / Cashback

Company rewards are a separate administrative surface.

Possible current Ramp redemption paths include:

- card statement;
- Ramp Checking;
- Ramp subscription/service fees;
- airline/hotel loyalty points;
- gift cards;
- charities.

Keep this separate from the Travel Employee Rewards demo.

---

## 104.6 Price Intelligence and License Intelligence

These should not be hidden as generic "Savings."

Add dedicated Insights surfaces for:

- software price benchmarks;
- contract comparison;
- seat/license utilization;
- renewal right-sizing.

---

# 105. Current vs Demo / Limited-Release Status Matrix

| Capability | Status for Replica Documentation |
|---|---|
| Corporate cards / virtual cards | VERIFIED-CURRENT |
| Funds / Spend Limits / Spend Programs | VERIFIED-CURRENT |
| Receipt automation | VERIFIED-CURRENT |
| Policy Agent | VERIFIED-CURRENT; advanced checks may be limited by plan/release |
| Reimbursements | VERIFIED-CURRENT |
| Bill Pay OCR | VERIFIED-CURRENT |
| Payment release approvals | VERIFIED-CURRENT |
| Payment Runs | VERIFIED-CURRENT / PLAN-DEPENDENT |
| Partial Bill Pay payments | VERIFIED-CURRENT, provider/eligibility dependent |
| AP Agents | VERIFIED-CURRENT; individual capabilities may be Plus/Beta |
| Procurement Requests + Programs | VERIFIED-CURRENT |
| Automatic PO after approval | VERIFIED-CURRENT when Program configured |
| 2-way / 3-way match | VERIFIED-CURRENT / configuration dependent |
| Contracts & renewals | VERIFIED-CURRENT / add-on dependent |
| AI Contract Summary & Vendor Intelligence | ALPHA / LIMITED |
| Price Intelligence | VERIFIED-CURRENT |
| Travel flights/hotels/cars | VERIFIED-CURRENT |
| Guest / delegate booking | VERIFIED-CURRENT, permission dependent |
| Hotel Price Drop | VERIFIED-CURRENT |
| Travel Employee Rewards | ROADMAP / DEMO — do not baseline |
| Business Banking / Treasury | VERIFIED-CURRENT, regulated eligibility dependent |
| Receivables | VERIFIED-CURRENT |
| Vendor Portal | VERIFIED-CURRENT |
| Advisor Console | VERIFIED-CURRENT specialized product |
| Stack | VERIFIED-CURRENT specialized accounting product |
| AI Token Spend Management | VERIFIED-CURRENT |
| Router | VERIFIED-CURRENT new AI gateway product |
| Rewards / Cashback | VERIFIED-CURRENT |
| Exact underwriting / credit-limit formula | NOT PUBLIC — IMPLEMENTATION EQUIVALENT |
| Exact fraud-model weights | NOT PUBLIC — IMPLEMENTATION EQUIVALENT |
| Internal AI prompts/model routing for Ramp core product | NOT PUBLIC |

---

# 106. Implementation Corrections That Engineering Must Follow

1. **Do not use PO as the normal procurement intake object.**
   Use Program → Request → Approval → PO.

2. **Do not merge bill approval and payment release.**
   They are separate approval/control phases.

3. **Do not model one Bill = one Payment.**
   Partial payments require Bill 1:N Payments.

4. **Do not model Expense as a detached report.**
   Card transaction + receipt + requirements + policy + review + accounting are linked.

5. **Do not hard-code one historic tab/navigation set from the videos.**
   Videos show product snapshots. Keep domain state stable and UI labels configurable.

6. **Do not label Travel Employee Rewards as GA.**
   Keep behind a feature flag until independently verified.

7. **Do not assume every Bill Pay rail is available for every tenant.**
   Payment methods are eligibility/provider/geography dependent.

8. **Do not treat all AI spend limits as hard enforcement.**
   Provider capabilities differ.

9. **Do not implement regulated banking as an internal ledger only.**
   Real banking/payment/card movement requires provider-backed regulated infrastructure.

10. **Do not claim Ramp's private formulas are known.**
    Underwriting, proprietary fraud weights, and internal AI prompts remain unspecified.

11. **Do not let AI bypass approval/RBAC.**
    AI uses the same domain tools and policy checks as humans.

12. **Do not compute authoritative finance totals in frontend.**
    Backend/database is the calculation source.

---

# 107. Verification Source Register

Verification date: **2026-09-15**

Primary public sources used:

- Ramp overview — https://support.ramp.com/ramp-overview/
- Ramp Help Center — https://support.ramp.com/
- Ramp products — https://ramp.com/products
- Product releases — https://ramp.com/product-releases
- Expense Management — https://support.ramp.com/expense-management
- Submission policies — https://support.ramp.com/submission-policies/
- Receipt automation — https://support.ramp.com/automate-receipts-and-expense-requirements
- Receipt verification — https://support.ramp.com/receipt-verification
- Bill Pay overview — https://support.ramp.com/bill-pay-overview
- Bill payment methods — https://support.ramp.com/bill-payment-methods-and-timelines
- Partial payments — https://support.ramp.com/partial-payments-on-ramp-bill-pay/
- Payment Runs — https://support.ramp.com/payments-runs-on-ramp-bill-pay
- AP Agents — https://support.ramp.com/ap-agents-available-in-ramp-bill-pay
- Procurement — https://support.ramp.com/get-started-with-procurement/
- Purchase Orders — https://support.ramp.com/purchases-orders-in-ramp/
- Contracts & renewals — https://support.ramp.com/contracts-renewals
- Vendor Management — https://support.ramp.com/vendor-management/
- Price Intelligence — https://support.ramp.com/price-intelligence-on-ramp/
- Travel — https://support.ramp.com/travel/
- Travel employee guide — https://support.ramp.com/booking-travel-on-ramp-employee-guide/
- Hotel Price Drop — https://support.ramp.com/hotel-price-drop
- Travel webinar/demo — https://ramp.com/webinars/intro-to-ramp-travel
- Business Banking — https://support.ramp.com/business-banking/
- AI Token Spend — https://support.ramp.com/ai-token-spend-management/
- Router — https://ramp.com/blog/router-launch
- Vendor Portal — https://support.ramp.com/ramp-vendor-portal/
- Advisor Console — https://support.ramp.com/advisor-console-overview
- Stack — https://support.ramp.com/stack-for-bookkeeping/

Uploaded video evidence reviewed:

- expense tracking.mp4
- payable.mp4
- procurement.mp4
- travel.mp4

These videos were treated as visual workflow evidence. When video behavior and current official documentation conflict, **current official documentation takes precedence**.
---

# 108. V3 Research Verification — New Findings

This section verifies the additional research supplied after V2 and corrects any overstatements.

## 108.1 Verification result summary

| Area | Verification | Product decision |
|---|---|---|
| Ramp Sheets | **VERIFIED-CURRENT** | Add as a separate AI financial-modeling workspace. |
| Ramp Sheets real-time collaboration | **NOT CURRENTLY VERIFIED AS GA** | Do not promise Google-Sheets-style multi-user editing. Current public material says download/share/re-upload is available and real-time collaboration was roadmap. |
| Ramp for Agents | **VERIFIED-CURRENT** | Add agent identity, human owner, policy, budget, payment capability, and audit. |
| Draft users | **VERIFIED-CURRENT** | Add staged onboarding before invites. |
| Slack → draft users | **VERIFIED-CURRENT** | Add as an HR-lite provisioning path. |
| 1099 operations | **VERIFIED-CURRENT** | Add full US tax-operations workflow. |
| Receipt affidavits | **ALPHA / PLUS** | Feature-flag and do not treat as universal baseline. |
| VAT-compliant reimbursement statements | **VERIFIED-CURRENT RELEASE** | Add entity VAT/address statement output for supported international use cases. |
| Treasury investment depth | **VERIFIED-CURRENT** | Add managed investment account concepts, liquidity, strategy, statements, and accounting. |
| DACA / Letters of Credit | **VERIFIED ON CURRENT PRICING** | Add as enterprise/treasury capability flags, not core MVP. |
| Automated accrual/reconciliation/amortization | **VERIFIED ON CURRENT PRICING** | Promote to dedicated accounting objects/workflows. |
| Routine recurring spend auto-approval | **VERIFIED** | Add controlled recurring-series automation with reapproval on material changes. |
| Country capability matrix | **REQUIRED BY VERIFIED INTERNATIONAL VARIATION** | Implement as configuration rather than hard-coded assumptions. |
| Agent-led incorporation | **VERIFIED-CURRENT** | Add as specialized onboarding. US LLC scope must remain explicit. |
| Generic business-loan product | **NOT SUPPORTED BY CURRENT HELP DOCS** | Do not model Ramp as a normal external-loan platform. |
| Disputes / provisional credit | **VERIFIED-CURRENT** | Add complete dispute case lifecycle. |
| Developer platform | **VERIFIED-CURRENT** | Add OAuth, scopes, sandbox, webhooks, OpenAPI, rate limits, trace IDs. |

---

# 109. Ramp Sheets / AI Financial Modeling Workspace

## Status

**VERIFIED-CURRENT**, but currently best treated as a **separate product surface** rather than assuming it is deeply embedded in the core spend application.

## Product purpose

Give finance users an AI-native spreadsheet environment for:

- financial modeling;
- forecasting;
- scenario analysis;
- vendor-spend analysis;
- operating models;
- cash-flow models;
- data cleanup;
- error detection;
- research-driven analysis.

## Required capabilities

### Workbook input

Support:

- blank workbook;
- Excel upload;
- CSV upload;
- PDF/document ingestion;
- bank-statement-style input;
- raw exported finance data.

### AI actions

AI should be able to:

- create sheets/tabs;
- build formulas;
- repair formulas;
- drag/fill formulas;
- explain formulas;
- detect anomalies;
- clean tables;
- normalize dates/currencies;
- create charts;
- build dashboards;
- create financial models from natural language;
- ask questions over workbook data;
- retrieve public web research;
- cite or preserve research provenance;
- format the workbook professionally.

### Formula safety

The agent must preserve:

- cell references;
- named ranges;
- formula dependency chains;
- locked cells/ranges;
- user-entered formulas;
- workbook structure.

Every AI edit should be reversible.

### AI execution model

```text
User Prompt
   ↓
Workbook Retrieval
   ↓
Plan
   ↓
Spreadsheet Actions
   ↓
Formula Recalculation
   ↓
Validation
   ↓
User Review
   ↓
Commit / Undo
```

### Collaboration status

For our product:

```text
V1:
Download
Share file
Version history
Re-upload / continue

Future:
Real-time co-editing
Comments
Presence
Cell-level collaboration
```

Do not represent real-time collaboration as Ramp-current parity unless reverified at implementation time.

### Integration decision

Current public Ramp material has described direct core-Ramp/QuickBooks integration as roadmap rather than baseline.

For our product, integration should be an **intentional differentiator**:

```text
Reports / Budgets / Vendors / AP / Accounting
                    ↓
                Sheets
                    ↓
         Model / Forecast / Analysis
```

This would improve on current public Ramp behavior while preserving a clear product boundary.

---

# 110. Ramp for Agents / Agent Finance

## Status

**VERIFIED-CURRENT**

## Product purpose

Treat an AI agent as a controlled financial actor without pretending it is a human employee.

Each agent requires:

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

## Agent record

Recommended fields:

```text
agent_id
name
description
human_owner_user_id
organization_id
entity_id
status
monthly_budget
per_transaction_limit
allowed_merchants
blocked_merchants
allowed_categories
allowed_payment_methods
approval_threshold
created_by
created_at
last_active_at
```

## Payment capabilities

Depending on provider support:

- virtual card;
- ACH;
- wire;
- check;
- agent-native payment rail.

Every rail must still pass normal:

- policy;
- approval;
- vendor verification;
- risk;
- accounting;
- audit.

## Surfaces

### Web

```text
AI / Agents
  Agent Directory
  Agent Detail
  Budgets
  Payment Methods
  Policy
  Activity
  Accounting
  Audit
```

### Developer

- REST API;
- OAuth scopes;
- MCP;
- CLI;
- webhooks.

## Audit semantics

Every financial event should identify:

```text
Agent
Human Owner
Requested Action
Approved By
Payment Method
Vendor
Amount
Policy Result
Accounting Result
```

Never collapse agent activity into the owner's personal activity.

---

# 111. Draft User & Workforce Onboarding Lifecycle

## Status

**VERIFIED-CURRENT**, with an important modeling note: public Ramp documentation confirms Draft users and publishing/inviting, but our exact internal enum names remain an implementation choice.

## Recommended lifecycle

```text
DRAFT
  ↓ publish
INVITED / PENDING_ONBOARDING
  ↓ completes onboarding
ACTIVE
  ↓
SUSPENDED
or
TERMINATED
```

## Draft user capabilities

Before invitation, admins should be able to configure:

- manager chain;
- department;
- location;
- entity;
- role;
- groups;
- Spend Programs;
- approval workflows;
- approval matrices;
- custom fields.

Draft users cannot:

- sign in;
- spend;
- approve;
- receive normal Ramp-style communications.

## Bulk onboarding

Support:

- CSV import;
- HRIS;
- SCIM;
- Slack import;
- API;
- manual create.

## Publishing

Support:

- one user;
- selected users;
- department cohort;
- entity cohort;
- scheduled rollout.

## Managers-first rollout

Allow management hierarchy to be staged before employees are invited so approval routes can be validated before go-live.

---

# 112. Slack-Based User Provisioning

## Status

**VERIFIED-CURRENT**

## Workflow

```text
Connect Slack
   ↓
Authorize Required User Scopes
   ↓
Read Workspace Members
   ↓
Normalize Email / Profile
   ↓
Match Existing Users
   ↓
Apply Exclusions
   ↓
Create Draft Users
   ↓
Admin Review
   ↓
Publish / Invite
```

Admin UI should show:

- matched existing;
- new draft;
- excluded;
- missing email;
- duplicate/conflict;
- sync errors.

Slack provisioning should create **draft users**, not automatically active financial users.

---

# 113. Tax Operations / 1099 Module

## Status

**VERIFIED-CURRENT for applicable US workflows**

## Navigation

Recommended:

```text
Vendors
  Tax & 1099
    Overview
    Eligible Vendors
    Excluded Vendors
    Missing Tax Details
    Delivery Consent
    Filing
    Filed Forms
    Corrections
    Settings
```

## Core vendor tax fields

- legal name;
- DBA name where relevant;
- TIN type;
- TIN;
- address;
- W-9;
- W-8 documents where applicable;
- tax classification;
- 1099 eligibility;
- digital-delivery consent;
- delivery preference.

## 1099 workflow

```text
Vendor Spend
   ↓
Eligibility Engine
   ↓
Box Mapping
   ↓
Tax Detail Check
   ↓
TIN Check
   ↓
E-Delivery Consent
   ↓
Form Review
   ↓
Cost Review
   ↓
File
   ↓
Electronic / Mail Delivery
   ↓
Corrections if Required
```

## Forms

Support:

- 1099-NEC;
- 1099-MISC.

## Controls

- bulk eligibility update;
- bulk tax-detail requests;
- W-9 upload;
- vendor self-service via Vendor Portal;
- recommended box mappings;
- additional spend adjustments;
- export for external filing.

## State-filing model

State filing must be configuration-driven.

Do not assume every state is fully handled.

Current public Ramp documentation notes:

- support for participating state workflows;
- some states require direct filing;
- corrected state forms may require separate handling.

## Fees

Do not hard-code public filing prices into business logic.

Use:

```text
TaxFilingFeeSchedule
```

because current vendor/platform fees can change over time.

---

# 114. Expense Compliance Additions

## 114.1 Missing-receipt affidavit

**Current public status: Alpha / Ramp Plus.**

Flow:

```text
Draft Reimbursement
   ↓
Receipt Missing
   ↓
Eligible by Policy / Threshold?
   ↓
User selects "I don't have a receipt"
   ↓
Reason + Business Purpose + Legal Name
   ↓
Generate Signed Affidavit PDF
   ↓
Lock Covered Fields
   ↓
Normal Approval Flow
```

Rules:

- affidavit is not a real receipt;
- only eligible when policy allows it;
- threshold is configurable;
- editing requires removing/voiding the signed affidavit first;
- audit all affidavit versions.

## 114.2 VAT-compliant reimbursement statements

For supported international entities, statement generation should support:

- legal entity name;
- legal entity address;
- VAT/tax registration details;
- reimbursement details;
- receipt references;
- employee/payee;
- original currency;
- reimbursement currency;
- FX information.

---

# 115. Treasury & Banking — Advanced Product Depth

## 115.1 Managed Investment Account

Current public Ramp documentation supports a managed investment account model.

Our equivalent should support:

- investment-account onboarding;
- risk/strategy configuration;
- cash target;
- deposits;
- withdrawals;
- investment activity;
- yield/earnings;
- portfolio detail;
- liquidity estimate;
- statements;
- tax documents;
- accounting synchronization.

Do not present investment yield as guaranteed.

## 115.2 Liquidity

Display:

- available cash;
- invested value;
- expected withdrawal settlement;
- pending orders;
- short-term target;
- projected liquidity.

## 115.3 DACA and Letters of Credit

Current Ramp pricing lists DACAs and letters of credit.

Model as optional treasury capabilities:

```text
Treasury Services
  DACA Requests
  Letter of Credit Requests
  Documents
  Status
  Counterparties
  Approvals
```

These require legal/banking provider integration and should not be built into the MVP without a provider.

## 115.4 Verification

Use precise concepts:

- business bank-account verification;
- vendor payment-account verification;
- deposit/micro-deposit verification;
- bank ownership verification;
- payment-detail change alerts.

Do not create an ambiguous generic "beneficiary verification" engine unless the provider requires one.

## 115.5 Treasury documents

Centralize:

- bank statements;
- investment statements;
- tax documents;
- transfer confirmations;
- DACA documents;
- LOC documents where supported;
- verification letters.

---

# 116. Accounting — Advanced Automation Objects

The V2 document already contains the core Accounting queue. V3 promotes these from minor mentions into first-class workflows.

## 116.1 Source-specific accounting workspaces

The uploaded images reinforce a source-based sidebar:

```text
Accounting
  Card Transactions
  Reimbursements
  Payments
  Banking / Treasury
```

Each source feeds the same general lifecycle:

```text
Waiting for Cardholder
→ Needs Review
→ Ready to Sync / Export
→ Syncing
→ Synced
→ Error
```

## 116.2 ERP-dependent columns

Column schema must be dynamic by provider.

Examples from uploaded screenshots:

```text
NetSuite Subsidiary
NetSuite Category

QuickBooks Department
QuickBooks Class
QuickBooks Job
```

Provider field definitions come from the integration schema rather than hard-coded UI.

## 116.3 Amortization

Dedicated object:

```text
AmortizationSchedule
  source_transaction
  start_period
  end_period
  periods
  original_amount
  recognized_amount
  remaining_amount
  schedule_lines[]
```

Support:

- prepaid software;
- insurance;
- annual subscriptions;
- other prepaid expenses.

## 116.4 Accruals

Support:

```text
AccrualRule
AccrualEntry
ReversalEntry
SourceObject
AccountingPeriod
```

Flow:

```text
Expected / Received Expense
  ↓
Accrual Calculation
  ↓
Period Entry
  ↓
Next-Period Reversal
  ↓
Actual Invoice / Transaction Match
  ↓
Variance / True-Up
```

## 116.5 Continuous reconciliation

Support:

- bank-side vs book-side matching;
- clearing status;
- unmatched queues;
- variance;
- reconciliation rules;
- continuous refresh;
- close-period lock.

## 116.6 Routine recurring auto-approval

For recurring series:

- first item requires normal approval;
- policy may allow subsequent items to auto-approve;
- material changes force re-approval;
- payment release remains a separate control where enabled.

---

# 117. Global Country Capability Matrix

A generic `multi_currency = true` flag is insufficient.

Create a capability registry.

Recommended model:

```text
CountryCapability {
  country
  legal_entity_supported
  card_issuing_supported
  card_settlement_currencies[]
  local_card_currency_supported
  statement_payment_supported
  statement_payment_currencies[]
  reimbursement_to_local_bank_supported
  locally_funded_reimbursement_supported
  reimbursement_currencies[]
  bill_pay_supported
  bill_pay_local_rails[]
  swift_supported
  local_currency_bill_pay_supported
  mileage_supported
  tax_capture_supported
  travel_supported
  provider_constraints
  plan_required
  effective_from
  effective_to
}
```

## UI behavior

When admin changes entity country, every downstream workflow should use the matrix to determine:

- available cards;
- payment methods;
- reimbursement rails;
- currencies;
- tax features;
- required bank/account details;
- accounting limitations.

## Important

Capabilities change over time.

Country support must therefore be:

- database/config driven;
- versioned;
- effective-dated;
- provider-aware.

---

# 118. Disputes, Fraud Cases & Repayments

## Status

**VERIFIED-CURRENT**

## Dispute entry points

- employee/cardholder transaction detail;
- admin transaction detail;
- web;
- mobile, subject to transaction-state restrictions.

## Dispute reasons

High-level families:

```text
Unrecognized / Fraud
Charged Incorrectly
Duplicate Charge
Goods / Services Not Received
Refund Not Received
Cancelled Service Charged
Other Merchant Issue
```

## Lifecycle

```text
Transaction
   ↓
Dispute Eligibility
   ↓
Vendor Contact Evidence
   ↓
Reason / Questionnaire
   ↓
Evidence Upload
   ↓
Internal Review
   ↓
Card Network Submission
   ↓
Optional Provisional Credit
   ↓
Pending Network Outcome
   ↓
Won / Lost / Cancelled
   ↓
Final Credit or Reversal
```

## Rules

- some dispute reasons require cleared transactions;
- pending web fraud reporting differs from normal merchant disputes;
- eligibility is time-bound;
- original transaction remains in history;
- credit appears separately;
- fraudulent-card case should support lock/terminate/reissue;
- cancellation may only be possible before final stages.

## Case-management page

```text
Expenses
  Disputes
    Open
    Needs Evidence
    Submitted
    Provisional Credit
    Resolved
```

Fields:

- case ID;
- transaction;
- card;
- cardholder;
- vendor;
- amount;
- reason;
- deadline;
- evidence;
- network status;
- provisional-credit status;
- final outcome;
- investigator notes;
- audit timeline.

## Repayments

Personal/incorrect company-card spend should support:

```text
Request Repayment
→ Employee Payment
→ Processing
→ Repaid
→ Accounting Sync
```

Repayment and dispute are separate concepts.

---

# 119. Developer Platform

## Status

**VERIFIED-CURRENT**

## Web pages

```text
Developer
  Apps
  OAuth
  API Scopes
  Credentials
  Webhooks
  Webhook Deliveries
  API Logs
  Sandbox
  Documentation
```

## OAuth

Support:

- client credentials for server-to-server;
- authorization code for third-party integrations;
- granular scopes;
- refresh tokens where relevant;
- environment isolation.

Example scope model:

```text
transactions:read
bills:read
bills:write
users:read
users:write
vendors:read
vendors:write
accounting:read
accounting:write
```

## Webhooks

Required platform behavior:

```text
Create Endpoint
→ Select Events
→ Generate Signing Secret
→ Deliver Event
→ Verify Signature
→ Retry on Failure
→ Delivery History
→ Replay
```

## API reliability

Support:

- cursor pagination;
- idempotency for critical writes;
- rate limiting;
- retry guidance;
- trace ID;
- async/deferred tasks;
- OpenAPI schema;
- sandbox/demo tenant.

## Developer audit

Track:

- app;
- token;
- scope;
- API action;
- webhook delivery;
- environment;
- actor/authorization context.

---

# 120. Plans, Entitlements & Commercial Lifecycle

Current public Ramp pricing uses plan tiers such as Free, Plus, and Enterprise, with some add-ons.

Our product should therefore have a generic entitlement system.

## Core objects

```text
Plan
Feature
Entitlement
Subscription
Trial
AddOn
UsageLimit
BillingAccount
```

## Rules

UI visibility and backend authorization must both use entitlements.

Example:

```text
Feature: payment_release
Required entitlement: AP_ADVANCED
```

Do not scatter plan-name checks throughout application code.

## Lifecycle

```text
Trial
→ Active
→ Upgrade / Add-on
→ Downgrade
→ Cancel
→ Expire
```

Support:

- seat-based fee;
- platform fee;
- usage-based feature;
- add-on;
- custom enterprise contract.

Pricing should be configuration-driven.

---

# 121. Vendor 360 — Optimized Product Design

The uploaded vendor screenshots reveal that Vendors should be a **cross-module financial entity**, not a simple master-data page.

## Vendor list optimized columns

```text
Vendor
Category
Owner
Owner Department
Total Spend
YTD Spend
Last 30 Days
Trend %
Next Payment
Frequency
Contract
Renewal
Open Bills
Payment Method
Risk
```

## Vendor navigation

Recommended:

```text
Vendors
  Overview
  Renewals
  Migrate Payments
  Price Intelligence
  Seat Intelligence
  Tax & 1099
```

## Vendor detail

```text
Overview
Spend
Subscriptions
Cards
Bills
Payments
Purchase Orders
Contracts
Renewals
Tax
Banking
Documents
Risk
Activity
```

## Migrate Payments / Move Spend

The uploaded image and Ramp documentation support a spend-migration workflow.

Flow:

```text
Upload Prior Card Transaction CSV/XLSX
        ↓
Detect Recurring / Large Vendors
        ↓
Estimate Identified Spend
        ↓
Assign Cardholder / Owner
        ↓
Choose Ramp Card
        ↓
Provide Merchant Migration Link / Task
        ↓
Track Migrated / Pending
        ↓
Estimate Cashback / Savings
```

This is useful during customer onboarding and should live under Vendor/Setup rather than being treated as a normal transaction workflow.

---

# 122. Procurement — Optimized Request Model

The uploaded Procurement screenshot gives an important design clue: procurement requests can resolve into different fulfillment types.

Use:

```text
ProcurementRequest
  requested_outcome_type
```

Possible outcomes:

- purchase order;
- new virtual card;
- new physical-card fund;
- edit existing card/fund;
- vendor setup;
- contract renewal;
- software purchase;
- service purchase.

## Request list

Required fields:

```text
Request Name
Requester
Approval Progress
Outcome Type
Amount
Frequency
Next Approver
Request Date
Status
```

Approval progress should be represented explicitly:

```text
0 of 6 approvals
1 of 6 approvals
5 of 6 approvals
Approved
Rejected
```

This is more useful than a single generic "In Review" state.

---

# 123. Bill Pay — Optimized Stage Model

The uploaded Bill Pay screens reinforce a staged AP queue.

Recommended views:

```text
Overview
Drafts
For Approval
For Payment
History
Urgent
International Wires
Payment Failures
```

## Status groups

### Missing Information

Examples:

- missing payment details;
- missing vendor details;
- missing tax details;
- missing accounting;
- unsupported payment route.

### Ready for Payment

Bill is sufficiently approved/configured but may still require payment release.

### Payment Release

Payment release is a separate gate:

```text
Bill Approval Complete
       ↓
Ready for Release
       ↓
Designated Payer
       ↓
Release Today / Scheduled Date
       ↓
Payment Initiated
```

Do not merge bill approval and payment release into one permission.

---

# 124. Accounting UX — Screenshot-Driven Optimization

The accounting screenshots show a very specific UX pattern that should be treated as a core product pattern.

## Top-level source selector

```text
Ramp/Card Transactions
Reimbursements
Payments
Treasury/Banking
```

## Status tabs

```text
Overview
Needs Review
Ready to Sync / Export
Waiting for Cardholder
```

## Inline workflow

Accounting users should be able to:

- edit ERP category inline;
- edit subsidiary/entity inline;
- review receipt inline;
- inspect memo;
- mark ready;
- undo ready;
- bulk mark ready;
- sync selected/all;
- export according to provider workflow.

## Rules counters

Top-level accounting automation should expose counts/links such as:

- Missing Items;
- Merchant Rules;
- Category Rules;
- Department Rules;
- Location Rules.

## Sync semantics

"Ready" is a distinct state from "Synced."

```text
Needs Review
→ Mark Ready
→ Ready to Sync
→ Sync
→ Synced
```

If an ERP is export-based rather than direct-sync:

```text
Ready to Export
→ Committed Export
→ Synced / Exported
```

---

# 125. Product Brainstorm — What We Actually Should Build

The goal should not be a screen-for-screen clone assembled from isolated Ramp screenshots.

The better target is:

> **A unified AI financial control plane where every dollar has an owner, authority, policy, approval, counterparty, accounting treatment, and audit trail.**

## 125.1 Product brain

The product should revolve around eight shared engines:

```text
1. Identity & Organization Graph
2. Money / Spend Authority Engine
3. Policy Engine
4. Approval Engine
5. Counterparty / Vendor Graph
6. Accounting & Reconciliation Engine
7. Event / Audit Graph
8. AI Decision & Automation Layer
```

Every module consumes these engines.

## 125.2 Core object relationship

```text
Person / Agent
      ↓
Organization / Entity / Department
      ↓
Budget / Program / Fund
      ↓
Request / PO / Card / Bill / Trip
      ↓
Vendor / Customer
      ↓
Transaction / Payment
      ↓
Receipt / Invoice / Contract
      ↓
Policy / Approval
      ↓
Accounting
      ↓
Reporting / Savings / AI
      ↓
Audit
```

## 125.3 The actual core product, by user job

### Employee

Needs:

- card/funds;
- request spend;
- submit receipt;
- submit reimbursement;
- book travel;
- see status.

### Manager

Needs:

- one Inbox;
- context-rich approvals;
- team spend;
- budget impact;
- exception alerts.

### Finance

Needs:

- policy;
- cards/funds;
- expenses;
- AP;
- vendor control;
- reporting;
- savings;
- AI automation.

### Accounting

Needs:

- universal coding queue;
- rules;
- amortization/accrual;
- reconciliation;
- ERP sync;
- close.

### Procurement

Needs:

- intake;
- routing;
- vendor;
- contract;
- PO;
- receiving;
- matching;
- renewals.

### Treasury

Needs:

- bank accounts;
- transfers;
- liquidity;
- statements;
- investment;
- cash forecast.

### IT / Security

Needs:

- identity;
- SCIM/SSO;
- integration scopes;
- agent identities;
- audit.

## 125.4 Universal Inbox

Instead of creating a separate approval UX for every module, use one cross-product task model.

```text
InboxItem {
  type
  object_id
  assignee
  priority
  due_at
  amount
  entity
  requested_by
  policy_summary
  ai_summary
  actions[]
}
```

Inbox can contain:

- spend request;
- expense;
- reimbursement;
- procurement;
- vendor change;
- bill;
- payment release;
- treasury transfer;
- tax issue;
- accounting exception.

## 125.5 Universal financial timeline

Every major object should show one timeline:

```text
Created
Edited
Submitted
AI Evaluated
Policy Evaluated
Approved / Rejected
Payment Initiated
Payment Settled
Accounting Ready
Synced
Commented
Document Added
```

This reduces fragmented audit experiences.

## 125.6 AI should be embedded, not isolated

Use AI in the workflow:

```text
Document
→ Extract
→ Match
→ Recommend
→ Explain
→ Human Review if Needed
→ Execute Deterministic Action
```

Examples:

- expense policy recommendation;
- invoice extraction;
- duplicate/fraud signal;
- coding suggestion;
- contract extraction;
- price benchmark;
- collection draft;
- report generation.

Keep the AI Assistant as an additional command/search layer, not the only AI surface.

## 125.7 Vendor as a strategic object

A vendor should connect:

```text
Spend
Cards
Bills
Payments
POs
Contracts
Seats
Price Intelligence
Tax
Bank Details
Renewal
Risk
```

This gives finance a true Vendor 360.

## 125.8 Accounting as the final control plane

Accounting should receive normalized data from all sources:

```text
Cards
Reimbursements
Bill Pay
Treasury
Receivables
```

and provide:

```text
Coding
Rules
Accruals
Amortization
Reconciliation
Sync
Close
```

This is more scalable than building a separate ERP-sync flow inside every module.

---

# 126. Revised Build Priority

Your research correctly identifies current Ramp features, but **feature existence and implementation priority are different**.

Building Ramp Sheets and Ramp for Agents as P0 would materially delay the core financial product.

Recommended product build priority:

## P0 — Core finance operating system

- organization/entities;
- people/RBAC;
- approval engine;
- policy engine;
- audit/event model;
- cards/funds/spend programs;
- transactions;
- expense/receipt;
- reimbursements;
- vendor 360;
- AP/Bill Pay;
- payment release;
- accounting queue + ERP sync;
- procurement request/PO;
- core travel;
- Inbox;
- reporting basics;
- integrations framework.

## P1 — Enterprise automation and risk

- draft-user onboarding;
- Slack provisioning;
- 1099/tax ops;
- disputes/repayments;
- advanced accounting rules;
- amortization;
- accruals;
- continuous reconciliation;
- advanced vendor verification;
- contracts/renewals;
- sourcing;
- Price Intelligence;
- license/seat intelligence;
- country capability matrix;
- developer platform;
- plan/entitlement engine;
- advanced treasury.

## P2 — New/adjacent Ramp parity

- Ramp Sheets equivalent;
- Ramp for Agents equivalent;
- Router / advanced AI infrastructure;
- managed investment functionality;
- Advisor Console;
- Stack-style close OS;
- agent-led incorporation;
- advanced global rails.

### Exception

If our product strategy is explicitly **agent-native finance**, move Ramp for Agents to P0/P1.

If our strategy is explicitly **FP&A / finance intelligence**, move Sheets to P1.

---

# 127. Current Source Register for V3 Research

The following current official public sources were used to verify the V3 additions.

## Ramp Sheets

- https://ramp.com/sheets
- https://ramp.com/leading-indicators/finance-leaders-top-questions-about-ai
- https://ramp.com/blog/ramp-labs-reddit-ama-insights

## Ramp for Agents / Incorporation

- https://agents.ramp.com/
- https://agents.ramp.com/docs/guides/incorporation
- https://agents.ramp.com/skills/ramp-incorporate
- https://ramp.com/product-releases

## Draft users / Slack

- https://support.ramp.com/setting-up-draft-users
- https://support.ramp.com/set-up-ramps-slack-integration-for-admins/
- https://support.ramp.com/inviting-users-to-ramp/

## Tax

- https://support.ramp.com/1099-filing-on-ramp/
- https://support.ramp.com/1099-state-filing/
- https://support.ramp.com/1099-corrections/
- https://support.ramp.com/ramp-vendor-portal/

## Expense compliance

- https://support.ramp.com/reimbursement-receipt-affidavits
- https://ramp.com/product-releases

## Treasury

- https://ramp.com/pricing
- https://support.ramp.com/ramp-managed-investment-account-overview
- https://support.ramp.com/ramp-banking-payments-overview
- https://support.ramp.com/ramp-investment-account-managed-accounting/

## Accounting

- https://support.ramp.com/overview-of-ramp-accounting
- https://support.ramp.com/managing-accounting-rules/
- https://support.ramp.com/ramp-accounting-agent-enablement-daily-use-admin-guide
- https://ramp.com/pricing

## International

- https://support.ramp.com/international-reimbursements
- https://support.ramp.com/employee-reimbursements-for-international-businesses
- https://support.ramp.com/international-transfers-on-ramp-bill-pay
- https://ramp.com/pricing

## Disputes / risk

- https://support.ramp.com/disputes-at-ramp/
- https://support.ramp.com/transaction-declines/
- https://support.ramp.com/vendor-verification/
- https://support.ramp.com/bill-pay-fraud/

## Developer platform

- https://docs.ramp.com/developer-api/v1
- https://docs.ramp.com/developer-api/v1/authorization/scopes
- https://docs.ramp.com/developer-api/v1/rate-limiting
- https://docs.ramp.com/developer-api/v1/sandbox
- https://docs.ramp.com/developer-api/v1/introduction

## Payment release / Bill Pay

- https://support.ramp.com/bill-pay-payment-release
- https://support.ramp.com/bill-pay-approvals/
- https://support.ramp.com/creating-and-managing-recurring-bill-payments-on-ramps-bill-pay

## Vendor / migration / price intelligence

- https://support.ramp.com/migrate-your-card-vendors
- https://support.ramp.com/price-intelligence-on-ramp/
- https://support.ramp.com/vendor-documents/
- https://support.ramp.com/request-payment-tax-and-other-details-from-vendors/

---

# 128. Final V3 Product Boundary

The optimized product should now be understood as:

```text
FINANCIAL CONTROL PLANE
│
├── Identity / Entity / RBAC
├── Policy / Approval / Inbox
├── Cards / Funds / Spend Programs
├── Transactions / Expenses / Receipts / Reimbursements
├── Disputes / Repayments / Risk
├── Procurement / PO / Receiving / Matching
├── Vendor 360 / Contracts / Renewals / Tax
├── AP / Bills / Payment Release / Payment Runs
├── Travel
├── Accounting / Accrual / Amortization / Reconciliation / ERP
├── Budgets / Reports / Savings / Price & Seat Intelligence
├── Treasury / Banking / Managed Investment
├── Receivables
├── Global Capability Matrix
├── Developer Platform
├── AI Token Spend / Router
├── Agent Finance
├── AI Financial Modeling / Sheets
└── Audit / Security / Compliance
```

The product should be implemented around the **shared control engines** rather than around the menu.

That is the most important V3 design decision.
