# AI-Powered Financial Operations SaaS
## Complete Product Design Specification — Web Portal, Mobile App, Users, RBAC, Pages, Workflows & Platform Architecture

**Document type:** Product Design Specification (PDS) + UX Information Architecture + Functional PRD  
**Product model:** Ramp-style AI-powered financial operations SaaS  
**Primary surfaces:** Responsive Web Portal + iOS/Android Mobile App  
**Audience:** Product, UX/UI, Frontend, Backend, Mobile, QA, DevOps, Security, Data, AI/ML  
**Status:** Implementation blueprint

---

# 1. Product Definition

## 1.1 What this product is

This product is an **AI-powered financial operations platform for businesses**.

It gives a company one system to control:

- company cards;
- employee spending;
- pre-spend requests;
- budgets and spend programs;
- expenses and receipts;
- reimbursements;
- travel;
- vendor bills;
- accounts payable;
- procurement;
- purchase orders;
- vendor management;
- contracts and renewals;
- business banking / treasury;
- accounting coding and ERP synchronization;
- reporting and analytics;
- accounts receivable;
- integrations;
- users, roles, security, and audit;
- AI-assisted finance operations.

The product should not be designed as disconnected modules.

The core design principle is:

> **Every financial event should connect to the same people, vendor, policy, budget, approval, accounting, payment, reporting, and audit model.**

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

Recommended Web navigation:

```text
HOME
  Overview
  Inbox
  Tasks

MY WORK
  My Expenses
  My Cards & Funds
  My Requests
  My Reimbursements
  My Travel
  My AI Spend

SPEND
  Cards & Funds
  Spend Programs
  Spend Requests
  Transactions
  Expenses
  Reimbursements

PROCUREMENT
  Purchase Requests
  Purchase Orders
  Vendors
  Contracts
  Renewals
  Sourcing

BILL PAY
  Bills
  Approvals
  Payments
  Payment Runs

TRAVEL
  Travel Overview
  Trips
  Travelers
  Travel Policies

BANKING
  Accounts
  Transactions
  Transfers
  Cash Forecast
  Statements

ACCOUNTING
  Overview
  Transactions
  Coding Queue
  Ready to Sync
  Synced
  Rules
  ERP Sync
  Reconciliation

INSIGHTS
  Executive Dashboard
  Reports
  Budgets
  Savings
  Vendor Spend
  Department Spend
  AI Spend

RECEIVABLES
  Customers
  Invoices
  Collections
  Incoming Payments
  Cash Application

AI
  Ask AI
  AI Agents
  AI Activity
  AI Spend

ADMIN
  People
  Departments
  Locations
  Entities
  Roles & Permissions
  Policies
  Approval Workflows
  Integrations
  Security
  Audit Log
  Billing
  Company Settings
```

Navigation items should hide automatically when the current user has no access.

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

Employees request spending authority before purchasing.

List columns:

- requester;
- title;
- amount;
- frequency;
- annualized value;
- purpose;
- vendor;
- status;
- current approver;
- requested date.

Status:

```text
Draft
Submitted
In Review
Needs Info
Approved
Rejected
Cancelled
Expired
Issued
```

Request form:

- request title;
- business purpose;
- amount;
- recurring/one-time;
- recurrence;
- vendor;
- category;
- desired start date;
- expiration;
- supporting file;
- comments.

Approved request may create:

- fund;
- virtual card;
- PO;
- procurement record;
- budget commitment.

---

# 15. WEB — Transactions

## Purpose

Canonical card transaction ledger.

Tabs:

- All;
- Pending;
- Cleared;
- Declined;
- Refunded;
- Disputed.

Columns:

- date;
- cardholder;
- vendor;
- amount;
- card;
- fund;
- category;
- receipt status;
- policy status;
- accounting status;
- entity.

Transaction detail page includes:

- merchant;
- amount;
- transaction lifecycle;
- card/fund;
- receipt;
- memo;
- policy evaluation;
- approval history;
- accounting coding;
- vendor;
- comments;
- audit timeline.

---

# 16. WEB — Expenses

## Purpose

Manage post-spend compliance.

Tabs:

- Needs Attention;
- Awaiting Cardholder;
- Awaiting Approval;
- Ready for Accounting;
- Complete;
- Policy Exceptions.

Expense list:

- employee;
- merchant;
- amount;
- receipt;
- memo;
- category;
- policy result;
- approver;
- accounting status;
- age.

Expense detail should have:

### Header
- merchant;
- amount;
- employee;
- date;
- status.

### Documents
- receipt image/PDF;
- invoice;
- supporting documents.

### Expense Requirements
- receipt;
- memo;
- purpose;
- attendees;
- category;
- project;
- client;
- custom fields.

### Policy
AI result:
- compliant;
- approval recommended;
- review required;
- rejection recommended.

### Approval Timeline
- approver;
- decision;
- comment;
- timestamp.

### Accounting
- GL account;
- department;
- location;
- class;
- project;
- tax;
- custom dimensions.

---

# 17. WEB — Reimbursements

## Purpose

Repay employees for personal-money business expenses.

Tabs:

- Draft;
- Submitted;
- In Review;
- Approved;
- Scheduled;
- Paid;
- Rejected.

Types:

- standard expense;
- mileage;
- per diem.

Create form:

- amount;
- date;
- merchant;
- currency;
- purpose;
- receipt;
- accounting fields.

Mileage:

```text
Reimbursement = Distance × Approved Rate
```

Per diem:

```text
Eligible Days × Location / Policy Rate
```

Admin settings:

- mileage rates;
- per-diem rules;
- required documents;
- approval workflow.

---

# 18. WEB — Procurement

## Purpose

Formal intake-to-purchase workflow.

Subpages:

- Purchase Requests;
- Workflow Builder;
- Purchase Orders;
- Sourcing;
- Vendor Onboarding;
- Contracts;
- Renewals.

Purchase request supports:

- software;
- service;
- equipment;
- renewal;
- expansion;
- new vendor;
- security review;
- legal review.

---

# 19. WEB — Procurement Request Detail

Sections:

- requester;
- department;
- vendor;
- requested product/service;
- amount;
- recurring cost;
- term;
- business justification;
- budget impact;
- security questionnaire;
- legal review;
- finance review;
- approval path;
- linked contract;
- linked PO;
- linked card/bill.

Actions:

- approve;
- reject;
- request information;
- assign reviewer;
- add workflow step;
- create PO;
- create virtual card.

---

# 20. WEB — Workflow Builder

Visual workflow designer.

Node types:

- manager approval;
- named approver;
- finance approval;
- legal review;
- security review;
- procurement review;
- budget owner;
- condition;
- parallel branch;
- AI review;
- webhook/integration step.

Conditions:

```text
amount > X
vendor is new
category = software
department = engineering
country = US
renewal = true
security data = sensitive
```

Support:

- sequential approvals;
- parallel approvals;
- fallback approvers;
- delegation;
- SLA/escalation.

---

# 21. WEB — Purchase Orders

Pages:

- PO List;
- PO Detail;
- PO Create/Edit.

PO fields:

- PO number;
- vendor;
- requester;
- owner;
- entity;
- amount;
- currency;
- line items;
- quantity;
- unit cost;
- accounting fields;
- delivery period;
- contract;
- approval state;
- received amount;
- billed amount;
- remaining commitment.

Formula:

```text
Remaining Commitment =
Approved PO Amount - Matched Bill Amount
```

---

# 22. WEB — Vendors

## Vendor List

Columns:

- vendor;
- category;
- total spend;
- open bills;
- contract status;
- payment method;
- risk/status;
- owner;
- entity.

## Vendor Detail

Tabs:

- Overview;
- Spend;
- Bills;
- Payments;
- Contracts;
- Purchase Orders;
- Documents;
- Banking;
- Activity.

Vendor profile:

- legal name;
- tax ID;
- address;
- contacts;
- bank/payment details;
- tax documents;
- category;
- risk flags;
- onboarding status.

Sensitive bank changes should require re-approval.

---

# 23. WEB — Contracts & Renewals

Contract detail:

- vendor;
- contract value;
- currency;
- start date;
- end date;
- renewal date;
- renewal terms;
- notice period;
- owner;
- department;
- legal entity;
- document;
- extracted clauses;
- linked spend;
- linked PO.

AI extracts:

- dates;
- pricing;
- renewal language;
- termination clause;
- auto-renewal;
- notice deadline.

Renewal dashboard:

- due in 30 days;
- due in 60 days;
- due in 90 days;
- owner;
- annual value;
- risk;
- action.

---

# 24. WEB — Sourcing

Functions:

- create sourcing event;
- invite vendors;
- collect bids;
- compare pricing;
- score vendors;
- negotiate;
- select winner.

Scoring dimensions:

- price;
- security;
- legal;
- service;
- implementation;
- custom criteria.

---

# 25. WEB — Bill Pay

Subpages:

- Bills;
- Approvals;
- Payments;
- Payment Runs;
- Vendors;
- Settings.

---

## 25.1 Bills List

Columns:

- vendor;
- invoice number;
- amount;
- due date;
- status;
- approval;
- payment status;
- PO match;
- entity;
- owner.

Statuses:

```text
Draft
Needs Review
Awaiting Approval
Approved
Scheduled
Partially Paid
Paid
Rejected
Cancelled
```

---

## 25.2 Bill Detail

Sections:

- invoice preview;
- vendor;
- invoice number;
- invoice date;
- due date;
- line items;
- tax;
- currency;
- payment method;
- PO match;
- accounting;
- approval timeline;
- fraud/risk review;
- payment schedule;
- audit timeline.

AI capabilities:

- invoice OCR;
- vendor matching;
- duplicate invoice detection;
- account coding;
- payment risk flags;
- PO match suggestion.

---

# 26. WEB — Payments

Payment list:

- vendor;
- bill;
- amount;
- method;
- scheduled date;
- status;
- approval;
- source account;
- entity.

Payment status:

```text
Draft
Awaiting Approval
Scheduled
Processing
Sent
Completed
Failed
Cancelled
Returned
```

Actions:

- approve;
- reschedule;
- cancel;
- retry;
- view remittance.

---

# 27. WEB — Payment Runs

Bulk payment workflow.

Steps:

1. select approved bills;
2. validate vendor/payment data;
3. choose bank/source;
4. review cash impact;
5. final approval;
6. release;
7. track settlement.

Display:

- total amount;
- count;
- source account;
- cash after run;
- warnings;
- high-risk vendors;
- approval status.

---

# 28. WEB — Travel

Subpages:

- Overview;
- Search / Book;
- Trips;
- Travelers;
- Approvals;
- Policies;
- Reporting.

Employee booking flow:

```text
Destination
→ Dates
→ Flight / Hotel / Car
→ Policy Evaluation
→ Approval if Needed
→ Booking
→ Trip
→ Card/Expense Matching
```

Travel policy controls:

- cabin class;
- hotel nightly cap;
- advance booking rule;
- preferred providers;
- car class;
- out-of-policy approval;
- department limits.

---

# 29. WEB — Trip Detail

Display:

- traveler;
- itinerary;
- flights;
- hotel;
- car;
- booking IDs;
- policy status;
- trip budget;
- linked cards/funds;
- linked expenses;
- changes/cancellations.

---

# 30. WEB — Banking / Treasury

Subpages:

- Accounts;
- Transactions;
- Transfers;
- Cash Forecast;
- Rules;
- Statements.

---

## 30.1 Accounts

Cards for:

- bank name;
- account nickname;
- mask;
- entity;
- available balance;
- current balance;
- last sync;
- status.

---

## 30.2 Bank Transactions

Searchable ledger.

Columns:

- date;
- account;
- description;
- amount;
- type;
- category;
- reconciliation status.

---

## 30.3 Transfers

Create transfer:

- from account;
- to account;
- amount;
- date;
- memo;
- approval.

For high-value transfers:

```text
Creator
→ Approver
→ Releaser
```

---

## 30.4 Cash Forecast

Charts:

- current cash;
- expected inflows;
- scheduled AP;
- payroll forecast;
- card repayment;
- projected closing balance.

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

# 32. WEB — Accounting

Primary accounting workflow:

```text
Awaiting Cardholder
→ Needs Review
→ Ready to Sync
→ Synced
```

Subpages:

- Overview;
- Transactions;
- Coding Queue;
- Ready to Sync;
- Synced;
- Sync Errors;
- Rules;
- ERP Configuration;
- Reconciliation.

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

Purpose:

Executive financial visibility.

KPIs:

- total spend;
- spend growth;
- budget variance;
- cash position;
- AP outstanding;
- AR outstanding;
- savings identified;
- vendor concentration;
- policy compliance;
- expense completion rate.

Charts:

- spend over time;
- vendor spend;
- category spend;
- department spend;
- entity spend;
- recurring spend;
- card vs bill vs reimbursement;
- out-of-policy trend.

---

# 37. WEB — Reports

Report builder dimensions:

- date;
- employee;
- manager;
- department;
- location;
- entity;
- vendor;
- category;
- GL;
- card;
- fund;
- transaction type;
- policy state.

Measures:

- total spend;
- transaction count;
- average transaction;
- budget;
- variance;
- outstanding bills;
- outstanding receivables.

Features:

- filters;
- grouping;
- sorting;
- save report;
- schedule;
- export;
- share;
- dashboard pinning.

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

# 39. WEB — Savings

Functions:

- duplicate subscriptions;
- unused SaaS;
- price benchmarking;
- vendor consolidation;
- upcoming renewals;
- negotiated savings;
- card policy opportunities.

AI can generate savings recommendations but should show evidence.

---

# 40. WEB — Receivables

Subpages:

- Customers;
- Invoices;
- Collections;
- Payments;
- Cash Application;
- Settings.

---

## 40.1 Customers

Fields:

- company;
- contacts;
- billing email;
- address;
- payment terms;
- currency;
- tax information;
- outstanding balance.

---

## 40.2 Invoices

Create invoice:

- customer;
- invoice number;
- line items;
- quantity;
- unit price;
- tax;
- discount;
- due date;
- payment terms;
- currency;
- memo.

Statuses:

```text
Draft
Sent
Viewed
Partially Paid
Paid
Overdue
Void
```

---

## 40.3 Collections

Functions:

- reminder rules;
- overdue queue;
- collections activity;
- promise-to-pay;
- escalation;
- customer communication.

---

## 40.4 Cash Application

Match incoming payment to invoice.

AI may suggest:

```text
Incoming $10,000
→ Customer ABC
→ Invoice INV-1007
→ Match Confidence 98%
```

Human confirmation required below configured threshold.

---

# 41. WEB — AI Spend

Purpose:

Manage spend across AI providers.

Pages:

- Company AI Spend;
- My AI Spend;
- Provider Connections;
- Spend Limits;
- Usage;
- Anomalies.

Display:

- provider;
- user/API key;
- tokens;
- estimated cost;
- invoiced cost;
- model;
- project;
- date.

Controls:

- monthly spend limits;
- user limits;
- project limits;
- anomaly alerts;
- provider connection.

---

# 42. WEB — Ask AI

Global finance assistant.

User can ask:

- “How much did Marketing spend last month?”
- “Which vendors increased more than 20%?”
- “Show overdue bills.”
- “Why was this expense rejected?”
- “Which contracts renew next quarter?”
- “Create a report of software spend by team.”

Action-capable requests may include:

- draft spend request;
- prepare report;
- draft approval comment;
- find transaction;
- update low-risk metadata.

High-risk operations require explicit human confirmation.

---

# 43. WEB — AI Agents Page

List operational agents:

- Policy Agent;
- Accounting Agent;
- AP Agent;
- Procurement Agent;
- Contract Agent;
- Reporting Agent;
- Collections Agent;
- Cash Application Agent;
- Spend Anomaly Agent.

Each agent page includes:

- enabled/disabled;
- scope;
- confidence threshold;
- allowed actions;
- human-review settings;
- recent decisions;
- error rate;
- audit history.

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

Integration marketplace categories:

- Banks / Open Banking;
- Accounting / ERP;
- HRIS;
- Identity / SSO;
- Collaboration;
- Email / Receipts;
- Procurement;
- Security;
- E-signature;
- Travel;
- AI Providers;
- Data Warehouse;
- Developer API.

Integration card:

- provider;
- category;
- status;
- connected entity;
- last sync;
- health.

Connection detail:

- authentication;
- scopes;
- owner;
- sync frequency;
- field mappings;
- last successful sync;
- errors;
- webhook status;
- reconnect;
- disconnect.

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

Integration categories:

## 81.1 Banking
Purpose:
- balances;
- transactions;
- repayments;
- cash visibility;
- treasury.

## 81.2 ERP / Accounting
Purpose:
- chart of accounts;
- dimensions;
- vendors;
- transaction sync;
- journal/accounting export.

## 81.3 HRIS
Purpose:
- employees;
- manager;
- department;
- location;
- lifecycle.

## 81.4 Identity / SCIM
Purpose:
- login;
- provisioning;
- de-provisioning;
- security groups.

## 81.5 Collaboration
Examples:
- Slack;
- Teams.

Purpose:
- approvals;
- notifications;
- commands.

## 81.6 Email / Receipt Sources
Purpose:
- receipts;
- invoices;
- vendor correspondence.

## 81.7 Procurement / Security
Purpose:
- security review;
- ticketing;
- legal workflow;
- e-signature.

## 81.8 Travel
Purpose:
- booking;
- itinerary;
- travel inventory;
- travel changes.

## 81.9 AI Providers
Purpose:
- token/usage ingestion;
- spend attribution;
- anomaly monitoring.

## 81.10 Data / API
Purpose:
- data warehouse;
- BI;
- customer-built integrations;
- webhooks.

---

# 82. AI Architecture

AI must be embedded in workflows, not only offered as a chatbot.

AI use cases:

- OCR;
- receipt matching;
- invoice extraction;
- accounting suggestions;
- policy review;
- anomaly detection;
- duplicate detection;
- report generation;
- contract extraction;
- vendor normalization;
- cash application matching;
- spend request summarization;
- collections drafting.

---

## 82.1 AI Decision Safety

AI output should carry:

```text
Recommendation
Confidence
Evidence
Source Data
Suggested Action
Human Review Required?
```

Rules:

- deterministic policy always overrides generative output;
- low-confidence actions require review;
- payment release is never silently executed by AI;
- role/permission checks apply to AI actions;
- all AI-triggered changes are audited.

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

## Journey 1 — New Employee

```text
HRIS
→ Employee Imported
→ Manager/Department Assigned
→ Spend Program Matches
→ User Invited
→ Physical Card Ordered
→ Virtual/Fund Access Issued
→ Employee Activates App
```

---

## Journey 2 — Employee Purchase

```text
Employee Uses Card
→ Authorization Controls
→ Transaction Created
→ Receipt Requested
→ Employee Uploads Receipt
→ AI Matches Receipt
→ Policy Check
→ Approval if Needed
→ Accounting Coding
→ ERP Sync
→ Reporting Updated
```

---

## Journey 3 — Spend Request

```text
Employee Request
→ Manager Approval
→ Budget Owner
→ Finance
→ Approved
→ Virtual Card/Fund Created
→ Employee Purchases
```

---

## Journey 4 — Reimbursement

```text
Employee Pays Personally
→ Submit Claim
→ OCR
→ Policy
→ Manager Approval
→ Finance Approval
→ Payment
→ Accounting Sync
```

---

## Journey 5 — Bill Pay

```text
Invoice Email/Upload
→ OCR
→ Vendor Match
→ Duplicate/Fraud Check
→ PO Match
→ Accounting Coding
→ Approval
→ Payment Scheduled
→ Payment Released
→ Settlement
→ ERP Sync
```

---

## Journey 6 — Procurement

```text
Employee Purchase Request
→ Budget Check
→ Manager
→ Security
→ Legal
→ Procurement
→ Vendor Onboarding
→ Contract
→ PO / Virtual Card
→ Invoice
→ Payment
```

---

## Journey 7 — Travel

```text
Employee Searches Trip
→ Policy Check
→ Approval if Required
→ Booking
→ Trip Created
→ Card Spend
→ Receipts
→ Expenses
→ Accounting
```

---

## Journey 8 — Accounting Close

```text
Transaction Feed
→ Employee Requirements
→ Expense Approval
→ Coding
→ Rules
→ Accounting Review
→ Ready to Sync
→ ERP
→ Reconciliation
```

---

## Journey 9 — Treasury Transfer

```text
Treasury Creates Transfer
→ Policy Check
→ Approver
→ Step-Up Authentication
→ Release
→ Bank Processing
→ Completion
→ Audit
```

---

## Journey 10 — Contract Renewal

```text
Contract Imported
→ AI Extracts Renewal Date
→ 90-Day Alert
→ Owner Review
→ Usage/Spend Analysis
→ Negotiate / Cancel / Renew
→ Updated Contract
```

---

## Journey 11 — AR Invoice

```text
Create Invoice
→ Send Customer
→ Due Date
→ Reminder
→ Payment Received
→ AI Match
→ Cash Application
→ Accounting Sync
```

---

# 91. Recommended MVP vs Full Product

This is a very large platform. Build it in layers.

## Phase 1 — Core Foundation
- organization;
- people;
- RBAC;
- entities;
- departments;
- policies;
- approval engine;
- audit;
- integrations framework.

## Phase 2 — Spend & Cards
- funds;
- virtual card abstraction;
- physical card abstraction;
- spend programs;
- spend requests;
- transactions.

## Phase 3 — Expenses
- receipts;
- OCR;
- expense workflow;
- reimbursements;
- mobile receipt capture.

## Phase 4 — Accounting
- coding;
- rules;
- ERP integration;
- sync queues.

## Phase 5 — Bill Pay
- vendors;
- invoices;
- approvals;
- payments;
- payment runs.

## Phase 6 — Procurement
- purchase requests;
- workflows;
- PO;
- vendor onboarding;
- contracts.

## Phase 7 — Travel
- trip;
- travel policy;
- booking integration.

## Phase 8 — Reporting
- dashboard;
- reports;
- budgets;
- savings.

## Phase 9 — Banking / Treasury
- accounts;
- transfers;
- statements;
- forecasting.

## Phase 10 — AR
- customers;
- invoices;
- collections;
- cash application.

## Phase 11 — AI Layer
- Ask AI;
- Policy Agent;
- Accounting Agent;
- AP Agent;
- Procurement Agent;
- Reporting Agent;
- anomaly detection.

AI should start earlier for OCR/classification, but autonomous agents should be added after deterministic workflows are stable.

---

# 92. Recommended Web Frontend Architecture

Suggested application route structure:

```text
/app
  /home
  /inbox

  /me
    /expenses
    /cards
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
    /reimbursements

  /procurement
    /requests
    /workflows
    /purchase-orders
    /vendors
    /contracts
    /renewals
    /sourcing

  /bill-pay
    /bills
    /approvals
    /payments
    /payment-runs

  /travel
    /overview
    /trips
    /travelers
    /policies

  /banking
    /accounts
    /transactions
    /transfers
    /forecast
    /statements

  /accounting
    /overview
    /transactions
    /coding
    /ready-to-sync
    /synced
    /errors
    /rules
    /erp

  /insights
    /dashboard
    /reports
    /budgets
    /savings

  /receivables
    /customers
    /invoices
    /collections
    /payments
    /cash-application

  /ai
    /ask
    /agents
    /activity
    /spend

  /admin
    /people
    /departments
    /locations
    /entities
    /roles
    /policies
    /approvals
    /integrations
    /security
    /audit
    /billing
    /settings
```

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

Shared Web + Mobile design system.

Components:

- buttons;
- inputs;
- currency fields;
- date pickers;
- status badges;
- cards;
- tables;
- drawers;
- modals;
- stepper;
- approval timeline;
- receipt viewer;
- document viewer;
- comments;
- audit timeline;
- empty states;
- warning banners;
- charts.

Status design must be consistent across modules.

Example:

- green = successful/compliant;
- amber = attention/review;
- red = blocked/failed;
- neutral = pending.

Do not rely on color alone; include text/icon.

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
- Web initial interactive target: under 3 seconds on normal business networks.
- Core table/filter interactions: near-instant client feedback.
- Card authorization: real-time, low-latency infrastructure.
- Async jobs for OCR, ERP sync, AI, report exports.

## Availability
- Financial APIs should use high availability.
- Payment and authorization services isolated from analytics failures.

## Reliability
- idempotency for financial writes;
- retry-safe jobs;
- immutable ledgers/audit;
- transactional outbox/event design.

## Security
- encryption in transit and at rest;
- secret vault;
- MFA;
- SSO;
- RBAC;
- session controls;
- audit;
- high-risk step-up authentication.

## Compliance Architecture
Design for:
- SOC-style controls;
- PCI scope minimization;
- privacy controls;
- retention;
- access review;
- segregation of duties.

Actual certifications require independent implementation and audit.

---

# 97. Backend Service Boundaries

Recommended services/modules:

```text
Identity Service
Organization Service
RBAC Service
People Service
Policy Service
Approval Workflow Service

Cards Service
Funds Service
Authorization Service
Transactions Service
Expenses Service
Reimbursements Service

Procurement Service
Vendor Service
Contracts Service
Bill Pay Service
Payments Service

Travel Service
Banking/Treasury Service
Accounting Service
Reporting Service
Budget Service
Receivables Service

Document/OCR Service
Integration Service
Notification Service
Audit Service
AI Orchestration Service
Search Service
```

Start as a modular monolith if the team is small, but preserve these domain boundaries.

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

The product is not considered complete only because pages exist.

A production-ready version must prove:

### Spend
- funds enforce limits;
- requests route correctly;
- card transactions create expenses;
- policy rules work.

### Expenses
- receipts match;
- missing requirements are tracked;
- approvals are auditable.

### AP
- invoice → approval → payment works end-to-end;
- duplicate/risk checks exist;
- partial/full payment states remain correct.

### Procurement
- purchase requests support multi-step review;
- PO/vendor/contract relations are traceable.

### Accounting
- every eligible transaction can be coded;
- sync status is visible;
- failed sync can recover without duplication.

### Mobile
- receipt scan works;
- employee self-service is complete;
- manager approvals are fast;
- push deep-links correctly.

### RBAC
- no unauthorized data leaks;
- entity and team scopes work;
- actions are protected server-side;
- approval authority is enforced.

### AI
- recommendations show evidence;
- AI cannot bypass RBAC;
- high-risk actions require confirmation;
- agent actions are audited.

### Audit
- financial state-changing operations are traceable.

---

# 101. Final Product Summary

The product should be understood as five layers:

```text
LAYER 1 — PEOPLE & CONTROL
Users
Roles
Entities
Policies
Budgets
Approvals

LAYER 2 — SPENDING
Cards
Funds
Requests
Expenses
Reimbursements
Travel

LAYER 3 — BUYING & PAYING
Procurement
Vendors
Contracts
POs
Bills
Payments

LAYER 4 — FINANCIAL SYSTEM
Banking
Treasury
Accounting
ERP
AR
Reporting

LAYER 5 — INTELLIGENCE
OCR
Policy AI
Accounting AI
AP AI
Procurement AI
Reporting AI
Anomaly Detection
Ask AI
```

The **Web Portal** is the organization’s financial operations control center.

The **Mobile App** is the employee/manager action layer.

The **RBAC + Policy + Approval + Accounting + Audit architecture** is the shared backbone that makes all modules one product rather than a collection of unrelated pages.

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
