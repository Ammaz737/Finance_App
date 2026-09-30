# Finance Platform — Complete Operating, RBAC & Demo Flow Manual

**Audience:** product demo operators, finance administrators, QA, and future production integrators  
**Application:** Ramp-style finance operations sandbox  
**Workspace:** `acme`  
**Scope:** implemented P0/P0.5 web application only. P1/P2 screens are intentionally excluded.

This document describes how the current application actually operates. It is based on the seeded database, API resource-access rules, web navigation, domain state machines, approval workflows, and form configuration in the repository.

## 1. Demo accounts and organization model

The seed creates one organization and two legal entities:

- Organization: `Acme Manufacturing`, workspace slug `acme`
- Legal entity 1: `Acme US LLC`, country `US`, currency `USD`
- Legal entity 2: `Acme UK Ltd`, country `GB`, currency `GBP`

Default seed password is `password123`, unless the environment variable `SEED_PASSWORD` overrides it.

| User | Role | Manager | Main purpose |
|---|---|---|---|
| `admin@acme.test` | Owner | — | Organization administration, all approvals, configuration, audit |
| `manager@acme.test` | Manager | Admin | Direct-report approvals and team review |
| `employee@acme.test` | Employee | Manager | Own requests, cards, expenses, receipts, reimbursements, travel |
| `treasury@acme.test` | Finance Admin | — | Payment/reimbursement release, accounting, finance operations |
| `ap@acme.test` | Finance Admin | — | AP bill review and finance operations |

All seeded role assignments are restricted to the US legal entity. A user can only operate on another entity after an authorized entity-scoped role assignment exists.

Seeded demo records include:

- Department: Engineering; location: Austin
- Spend program: Software tools, maximum `USD 5,000`, linked to Engineering 2026 budget
- Funds/cards: Elena fund/card ending `4242`; Ava fund/card ending `1001`
- Cleared card transaction: OpenAI, `USD 42.00`, with incomplete expense
- Vendor: OpenAI, category SaaS
- Draft bill: `INV-10034`, `USD 4,500.00`
- Procurement request: Datadog expansion, `USD 18,000.00`
- Travel trip: NYC customer visit, `USD 1,200.00`
- Mock ERP, mock travel, and mock card issuer integrations

## 2. RBAC model — how access is calculated

Every request is checked against:

1. **Tenant:** organization ID must match the logged-in workspace.
2. **Permission:** the user must have the permission required by the resource/action.
3. **Scope:** organization, entity, self, direct reports, or department.
4. **State:** the record must be in a valid state for the requested action.
5. **SoD:** requester/creator cannot perform certain approval or release actions.
6. **Audit/outbox:** material changes write an audit event and outbox event transactionally.

The `Owner` role has `*` organization-wide access. `Finance Admin` receives every named permission at organization scope. `Manager` and `Employee` receive narrower direct-report/self grants.

### Seeded role permission map

| Role | Effective permissions and scope |
|---|---|
| Owner | `*`, organization scope; unrestricted P0 administration within tenant |
| Finance Admin | All named permissions, organization scope: people, roles, cards, spend, expenses, reimbursements, vendors, bills, payments, procurement, travel, accounting, treasury, reports, budgets, audit |
| Manager | `expense.approve`, `spend_request.approve`, `reimbursement.approve`, `travel.approve`, `card.read`, `expense.read`, `procurement.review`; direct reports scope |
| Employee | `expense.create`, `expense.read`, `spend_request.create`, `card.read`, `reimbursement.create`, `travel.book`, `procurement.request`; self scope |

### Practical role rule

- Employee creates/submits own work.
- Manager approves direct-report work.
- AP/Finance Admin approves AP and performs finance release/payment/accounting operations.
- Owner performs final/high-risk approval and configuration.
- Treasury/Finance release is separate from the person who created the payment or run.

## 3. Navigation map

### Workspace

- `/app/home` — Overview KPIs and pending work
- `/app/inbox` — approval/release/accounting tasks assigned to current user
- `/app/search` — permission-scoped search with exact record links

### My work

- `/app/me/cards` — current user’s cards
- `/app/me/expenses` — current user’s expense work
- `/app/me/requests` — current user’s spend requests
- `/app/me/reimbursements` — current user’s reimbursements
- `/app/me/travel` — current user’s trips

### Spend and cards

- `/app/spend/programs` — spend programs and controls
- `/app/spend/requests` — spend request list/approval
- `/app/cards` — corporate-card overview, limits/spend and card list
- `/app/cards/:id` — card detail alias; existing `/app/spend/cards/:id` remains available
- `/app/spend/funds` — funds and available capacity
- `/app/spend/transactions` — authorization/capture/void/reversal records

### Expenses and reimbursements

- `/app/expenses/transactions` — finance expense review
- `/app/expenses/receipts` — receipt list
- `/app/expenses/receipts/:id` — receipt candidate picker/linking
- `/app/expenses/reimbursements` — finance reimbursement list
- `/app/me/reimbursements` — employee reimbursement list

### Procurement

- `/app/procurement/programs` — intake programs
- `/app/procurement/requests` — purchase requests
- `/app/procurement/purchase-orders` — issued POs, receiving and change orders
- `/app/procurement/receiving` — record goods/services received
- `/app/procurement/match-exceptions` — resolve variance exceptions

### Vendors and bill pay

- `/app/vendors` and `/app/vendors/:id` — Vendor 360 and payment details
- `/app/bill-pay/bills` — bill list/stages
- `/app/bill-pay/bills/new` — bill creation
- `/app/bill-pay/bills/:id` — bill detail/edit/approve/payment
- `/app/bill-pay/payments` and `/app/bill-pay/payments/:id` — payment lifecycle
- `/app/bill-pay/payment-runs` and `/app/bill-pay/payment-runs/:id` — payment batching/release

### Accounting, travel, administration

- `/app/accounting/*` — review, coding, ready, sync, failures, rules, integrations
- `/app/travel/trips`, `/app/travel/trips/:id` — trip and booking lifecycle
- `/app/company/people`, `/app/company/people/:id` — people and role assignments
- `/app/company/roles/:id` — role permissions/scope/entity restrictions
- `/app/company/policy` — policy builder/simulation
- `/app/company/approvals` — workflow builder/preview
- `/app/company/accounting-dimensions` — controlled coding values
- `/app/company/audit` — audit history
- `/app/notifications` — actionable notifications

## 3A. Page → user → task quick reference

Use this table during a live demo. “Owner/Finance” means `admin@acme.test`, `treasury@acme.test`, or `ap@acme.test` depending on the task; do not substitute an Employee account.

| Page / URL | User who operates it | What to enter/do | Next user/state |
|---|---|---|---|
| `/login` | Every user | Workspace `acme`, own email/password | Opens permitted workspace |
| `/activate?token=...` | Invited user | New 12+ character mixed-case/number password | User becomes `ACTIVE`; sign in |
| `/forgot-password` | Any user | Workspace + own email | Open sandbox reset link |
| `/reset-password` | User receiving reset link | New password + confirmation | Old sessions revoked; sign in |
| `/app/home` | Every permitted user | Read KPIs and pending work | Follow pending item to exact record |
| `/app/inbox` | Manager/Finance/Owner | Open assigned task; review policy/timeline; approve/reject/request info/release | Record advances or returns to requester |
| `/app/search` | Any permitted user | Search vendor/person/bill/expense/PO/trip/request | Open exact detail record |
| `/app/company/people` | Owner/Finance | Invite: email, first name, last name, role, optional manager | Invited user activates |
| `/app/company/people/:id` | Owner/Finance | Change manager/dept/location/entity; assign/remove role; suspend/terminate/reset | User permissions/lifecycle change |
| `/app/company/roles/:id` | Owner/Finance | Inspect role permissions, scope, entity restrictions | Assign role from People |
| `/app/company/entities` | Owner/Finance | Entity name, country ISO (`US`), currency ISO (`USD`) | Entity available to forms |
| `/app/company/departments` | Owner/Finance | Department name (`Engineering`) | Available for people/coding |
| `/app/company/locations` | Owner/Finance | Location name (`Austin`) | Available for people/coding |
| `/app/spend/programs` | Owner/Finance | Program name, entity, max amount, currency, budget, fulfillment, merchant/MCC/velocity controls | Employee can select active program |
| `/app/me/requests` | Employee | Name, purpose, amount/currency, entity, program, vendor/category, fulfillment, recurrence/expiry/comments | Manager approval task |
| `/app/spend/requests/:id` | Employee/Manager/Finance | Employee views; approver reviews policy/timeline and approves | Final Finance/Owner approval fulfills |
| `/app/cards` | Finance/Owner; employee can view permitted cards | Review active count, limits/spend, card status; open Issue card entry | Open `/app/cards/:id` |
| `/app/cards/:id` | Card holder views; Finance/Owner controls | Freeze, unfreeze, terminate; merchant lock, MCCs, per-txn, velocity | Card status/control changes audited |
| Card detail sandbox authorization | Finance/Owner | Amount, merchant, merchant category → Authorize → Capture | Cleared transaction creates expense |
| `/app/expenses/transactions` | Finance/Owner; manager for allowed scope | Open expense, review memo/receipt/policy | Employee fixes; manager approves |
| `/app/expenses/:id` | Employee/Finance | Add memo, upload receipt, submit | Manager approval; accounting queue |
| `/app/expenses/receipts/:id` | Employee/Finance | Search employee/merchant/amount/date/transaction/expense; select candidate | Receipt links to expense |
| `/app/me/reimbursements` | Employee | Entity, type, amount/distance/days, currency, memo, merchant/category/date | Submit creates approval task |
| `/app/expenses/reimbursements` | Manager/Finance/Owner | Approve, schedule payout, confirm/fail/return payout | `PAID` or retryable failure |
| `/app/vendors` | AP/Finance/Owner | Name, category, entity, risk, notes | Vendor detail/payment setup |
| `/app/vendors/:id` | AP/Finance/Owner | Payment Details: masked last4/routing, method, change reason; verify separately | Bills/payments can reference vendor |
| `/app/bill-pay/bills/new` | AP/Finance/Owner | Entity/vendor, invoice no/date/due date/currency, invoice upload, lines, tax, GL/dept/location/project | Draft bill detail |
| `/app/bill-pay/bills/:id` | AP/Finance | Edit only DRAFT; submit/cancel; approve when assigned | Approved bill becomes payable |
| `/app/bill-pay/payments` | AP/Finance | Select approved bill, amount not above remaining, rail/idempotency | Scheduled payment |
| `/app/bill-pay/payments/:id` | Treasury/Finance | Release payment; later confirm settlement | `PROCESSING/SENT` → `SETTLED` |
| `/app/bill-pay/payment-runs` | Treasury/Finance | Run name, entity, source bank account | Open run |
| `/app/bill-pay/payment-runs/:id` | Finance creator composes; different Finance/Treasury releases | Add eligible scheduled payments, remove before release, inspect count/total/issues, release | Payments move through existing settlement |
| `/app/procurement/programs` | Finance/Owner | Intake program name and outcome default | Requester selects program |
| `/app/procurement/requests` | Employee/Requester | Name, entity, procurement program, amount/currency, outcome, vendor, memo | Manager then Finance approval |
| `/app/procurement/purchase-orders/:id` | Finance/Owner | Review issued PO; request change order; record receiving | Match against bill |
| `/app/procurement/receiving` | Finance/Procurement reviewer | PO, received amount/quantity, memo | Match recalculates |
| `/app/procurement/match-exceptions` | Finance/Procurement reviewer/Owner | Override, receiving update, corrected invoice, corrected, comment, resolve, reject | Exception closes or returns for correction |
| `/app/travel/trips` | Employee | Trip name, origin/destination, dates, estimate/currency, purpose/entity | Approval if out-of-policy/high value |
| `/app/travel/trips/:id` | Employee/Manager/Travel/Finance | Search/select offer, reprice, hold/confirm sandbox; cancel/refund by booking state | Trip/booking/fund/card/expense timeline |
| `/app/company/policy` | Owner/Finance | Policy name/object, conditions, actions, priority, effective date, enabled state | Simulate, then enable/version/disable |
| `/app/company/approvals` | Owner/Finance | Workflow name/object, serial/parallel steps, manager/finance/budget/department/entity/threshold routing | Preview, then enable/version/disable |
| `/app/company/accounting-dimensions` | Finance/Owner | Dimension type, code, label, values, provider/source | Controlled coding values |
| `/app/accounting/review` | Finance/Owner | Review source; assign GL/category/dept/location/project | Mark ready |
| `/app/accounting/ready-to-sync` | Finance/Owner | Confirm coding and start sync | Mock ERP sync |
| `/app/accounting/errors` | Finance/Owner | Inspect sync error; retry | Same external ID prevents duplicate |
| `/app/notifications` | Notification recipient | Open actionable notification | Exact request/bill/payment/travel/exception record |
| `/app/company/audit` | Owner/authorized Finance | Read actor/action/object/old/new/timestamp | Evidence only; no editing |

## 4. End-to-end operating flows

## Flow A — Invite, activation and login

**Actor:** Owner/Finance Admin invites; invited user activates.

1. Open **Company → People → Invite person**.
2. Enter:
   - Email: unique valid email
   - First name: `Demo`
   - Last name: `Employee`
   - Role: select existing role, normally `Employee`
   - Optional manager: direct manager
3. Save. User remains invited/draft until activation.
4. In sandbox, copy the generated activation link. In production, email provider delivers it.
5. Open `/activate?token=...` in a new browser.
6. Enter password of at least 12 characters with upper/lowercase and number.
7. Activation changes user to `ACTIVE`; user then signs in through `/login`.

**Security behavior:** token is one-time, hashed at rest and expires. Do not present a raw token as the normal demo workflow.

## Flow B — Spend program → request → approval → virtual card

### B1. Configure a spend program

**Actor:** Finance Admin/Owner. Route: `/app/spend/programs`.

Enter:

- Name: `Software subscriptions`
- Legal entity: `Acme US LLC`
- Maximum request amount: `5000`
- Currency: `USD`
- Budget: `Engineering 2026`
- Default fulfillment: `VIRTUAL_CARD`
- Merchant lock: `OpenAI`
- Allowed MCCs: `software,saas`
- Per-transaction limit: `250`
- Velocity max amount: `1000`
- Velocity max count: `10`
- Valid days: `30`

Use program detail to edit controls. Deactivate only when it is safe; active financial state can block unsafe changes.

### B2. Submit employee request

**Actor:** Employee. Route: `/app/me/requests` or `/app/spend/requests`.

Enter:

- Request name: `Annual analytics subscription`
- Purpose: `Customer reporting for Q4`
- Amount: `600`
- Currency: `USD`
- Legal entity: `Acme US LLC`
- Program: `Software subscriptions`
- Vendor: `OpenAI` (optional)
- Category: `Software`
- Fulfillment: `Virtual card`
- Recurrence: `One-time` or `Monthly`
- Expiry: 30 days from today
- Comments: `Receipt required`

Submit. The policy result is server-generated: `PASS`, `WARN`, `REVIEW`, or `BLOCK`.

### B3. Approval

1. Manager opens `/app/inbox`, selects the request, checks policy and timeline, then **Approve**.
2. Finance Admin/Owner opens the next inbox task and **Approve**.
3. Final approval fulfills the request once and creates the linked virtual card/fund.
4. Request detail route is `/app/spend/requests/:id`.

The requester cannot approve their own request. A wrong role receives `NOT_ASSIGNED` or `SOD_VIOLATION`.

### B4. Card controls and spend

**Actor:** card holder can view own card; Finance Admin/Owner can manage controls.

On `/app/cards`:

- Active card count and currency-wise limits/spend are displayed.
- Open `/app/cards/:id`.
- `ACTIVE` → **Freeze**.
- `FROZEN` → **Unfreeze**.
- Non-terminated → **Terminate**.

Control values:

- Merchant lock: `OpenAI`
- Allowed MCCs: `software,office`
- Per-transaction: `40.00`
- Velocity amount: `50.00`
- Velocity count: `1`
- Window: `24` hours

Try a grocery MCC or amount above the limit to demonstrate `MCC_BLOCKED`, `PER_TXN_LIMIT`, or velocity decline.

### B5. Authorization → capture → expense

**Actor:** Finance Admin/Owner in sandbox.

On card detail, enter amount `25.00`, merchant `OpenAI`, category `software`, then:

1. **Authorize** — creates sandbox authorization/hold.
2. **Capture** — clears transaction and creates/links expense.
3. Expense appears in `/app/expenses/transactions`.

## Flow C — Expense and receipt

**Actor:** Employee creates/updates own expense; Manager approves; Finance codes/accounting.

1. Open expense detail from `/app/me/expenses` or `/app/expenses/transactions`.
2. Enter/update memo: `ChatGPT team plan`.
3. Upload receipt document (PDF/PNG/JPEG).
4. Open `/app/expenses/receipts/:id`.
5. Search candidate by employee, merchant, amount, date, transaction, or expense.
6. Select suggested candidate and **Link to this expense**.
7. Submit expense.
8. Manager opens inbox and approves.
9. Finance opens `/app/accounting/review`, applies controlled coding, marks ready, then syncs sandbox ERP.

Receipt policy in seed requires receipts above `USD 75`; the current seeded `USD 42` example demonstrates incomplete expense handling without crossing that threshold.

## Flow D — Reimbursement

### D1. Standard reimbursement

**Actor:** Employee creates/submits; Manager approves; Finance schedules/confirms payout.

Route: `/app/me/reimbursements` → **New reimbursement**.

Enter:

- Entity: `Acme US LLC`
- Type: `STANDARD`
- Amount: `85.50`
- Currency: `USD`
- Memo: `Client lunch`
- Merchant: `Cafe Demo`
- Category: `Meals`
- Expense date: today

Then **Submit** → manager **Approve** → Finance **Schedule** → Finance **Confirm payout**. Final state becomes `PAID` and accounting is queued.

### D2. Mileage

- Type: `MILEAGE`
- Distance: `120` miles
- Memo: `Client visit`
- Entity/currency: configured entity

The configured rate and total are calculated server-side. Do not enter a trusted total as the source of truth.

### D3. Per diem

- Type: `PER_DIEM`
- Eligible days/nights: `3`
- Destination: `New York`
- Memo: `Conference travel`

Amount = configured rate × eligible days/nights, calculated by server.

## Flow E — Vendor → bill → payment → settlement

### E1. Vendor setup

**Actor:** Finance Admin/Owner/AP. Route: `/app/vendors` → **Add vendor**.

Enter:

- Vendor name: `Acme Office Supplies`
- Category: `Office`
- Legal entity: `Acme US LLC`
- Risk: `MEDIUM`
- Notes: `Demo supplier`

Vendor detail provides Overview, Payment Details, Bills, Payments and Activity.

### E2. Payment details

Authorized user enters masked values only:

- Last four: `1111`
- Routing masked: `****111`
- Payment method: `ACH`
- Change reason: `Initial setup`

Another authorized user verifies the bank details if SoD requires it. The UI never shows raw banking secrets.

### E3. Create draft bill

Route: `/app/bill-pay/bills/new`.

Enter entity first, then vendor from the same entity:

- Invoice number: `INV-DEMO-001`
- Invoice date: today
- Due date: 30 days later
- Currency: auto-aligned entity currency (`USD`)
- Memo: `Office equipment purchase`
- Upload invoice PDF

Line example:

- Description: `Office chair`
- Quantity: `2`
- Unit price: `150.00`
- Tax: `30.00`
- GL account: `6100`
- Department: `Engineering`
- Location: `Austin`
- Project/job: `P0 Demo`

Total is `USD 330.00`. Save as draft for correction; server recomputes totals. DRAFT can be edited. Protected/paid records use cancel/void/state rules, never hard-delete.

### E4. Bill approval and payment

1. AP opens `/app/bill-pay/bills?stage=For approval` and approves.
2. Finance Admin/Owner completes the next approval if the workflow has a second step.
3. Authorized finance user schedules a payment against remaining bill balance.
4. Payment creator cannot release their own payment.
5. Treasury/Finance Admin releases payment → `PROCESSING`/`SENT`.
6. Confirm settlement → payment `SETTLED`, bill remaining amount decreases once, accounting source is created.

## Flow F — Payment run

**Actor:** Finance Admin/Treasury. Route: `/app/bill-pay/payment-runs`.

Create:

- Name: `Weekly AP Demo`
- Legal entity: `Acme US LLC`
- Source account: `Operating ••••1111`

On run detail:

1. Select only eligible approved/scheduled payments.
2. Click **Add selected payments**.
3. Confirm payment count, total, source account and validation issues.
4. Remove an eligible payment while run is `OPEN` if needed.
5. A different authorized user clicks **Release run**.
6. Existing payment-release and settlement logic continues to payment `SETTLED`.

Duplicate payment objects are not created when adding/removing/re-adding.

## Flow G — Procurement → PO → receiving → match

### G1. Procurement request

**Actor:** Employee/requester creates; Manager and Finance review.

Route: `/app/procurement/requests` → **New procurement request**.

Enter:

- Name: `Laptop purchase`
- Entity: `Acme US LLC`
- Program: `Software intake`
- Amount: `1200`
- Currency: `USD`
- Outcome: `Purchase order`
- Vendor: active vendor
- Memo: `Two laptops for finance`

Submit → Manager approval → Finance/Owner final approval. PO is not created before final approval.

### G2. Purchase order and receiving

Open `/app/procurement/purchase-orders/:id`.

- Review PO number/vendor/amount/lines.
- Use **Record receiving**.
- Purchase order: selected PO
- Amount/quantity: actual received
- Memo: `Partial delivery received`

Receiving moves open → partially received → received according to quantities/state.

### G3. Match exception

Create/observe a bill whose quantity/amount exceeds receiving tolerance. Open `/app/procurement/match-exceptions`.

Actions:

- Approve override
- Request receiving update
- Request corrected invoice
- Mark corrected
- Comment
- Resolve
- Reject

The API enforces tolerance, authority, SoD, audit and outbox; users must not edit the database directly.

## Flow H — Travel request → booking → cancellation/refund

**Actor:** Employee books/submits; Manager/Finance approve; employee/authorized travel user books and cancels.

Route: `/app/travel/trips` → **New trip**.

Enter:

- Name: `NYC customer visit`
- Origin: `Lahore`
- Destination: `New York`
- Start: `2026-10-10`
- End: `2026-10-12`
- Estimated amount: `1200`
- Currency: `USD`
- Purpose: `Customer workshop`
- Entity: `Acme US LLC`

Flow:

1. Search available sandbox flight/hotel/car offers.
2. Select quote and reprice.
3. Submit; out-of-policy or high amount requires approval.
4. Manager and Finance approve as configured.
5. Place mock hold; confirm sandbox booking.
6. Confirmed booking links trip/fund/card/expense as applicable.
7. Confirmed refundable booking → **Cancel**.
8. Cancelled/refund-eligible booking → **Refund / simulate refund**.
9. Show cancellation terms, refund status, refund amount and timeline.

## Flow I — People, roles and organization setup

### I1. Organization/entity/department/location

**Actor:** Owner/Finance Admin with `roles.assign`.

- Entity: name, ISO country code (`US`), ISO currency (`USD`)
- Department: name (`Engineering`)
- Location: name (`Austin`)

Edit writes audit/outbox. Archive only when safe; legal entity archive is blocked by active bills/cards/payments.

### I2. People detail

On `/app/company/people/:id`, authorized admin can:

- Change manager
- Change department/location/legal entity
- Assign/remove role and entity restriction
- Suspend
- Terminate
- Reset activation/credentials

Termination revokes sessions and freezes active cards, subject to safety checks.

### I3. Role detail

On `/app/company/roles/:id`, show role name, permission list, scope and entity restrictions. Existing role assignment is supported. Advanced custom-role authoring is outside P0.5.

## Flow J — Policy builder

**Actor:** Owner/Finance Admin with `roles.assign`. Route: `/app/company/policy`.

Create a policy:

- Policy name: `Receipt over 75`
- Object type: `expense`
- Priority: `10`
- Effective date: today
- Enabled state: enable only after review
- Condition: amount, category, department, entity, vendor, merchant, country, date/age (as supported)
- Action: require receipt, require memo, `WARN`, `REVIEW`, `BLOCK`, or require approval

Available operations: create, edit/version, disable, simulate. Simulation and execution use the shared policy engine; do not edit JSON directly in the database.

Seed policies include procurement quote/high-value rules, travel maximum/out-of-policy rules, expense receipt over `USD 75`, and reimbursement receipt/memo rules.

## Flow K — Approval workflow builder

**Actor:** Owner/Finance Admin with `roles.assign`. Route: `/app/company/approvals`.

Create:

- Name: `Spend two-step approval`
- Object type: `spend_request`
- Step 1: manager, sequential
- Step 2: finance, sequential
- Optional minimum amount: `500`
- Optional department/entity routing
- Optional parallel group for parallel reviewers

Preview/simulate before enabling. Enable creates the active version; edit creates a new version and disables/retires the previous version as appropriate. Self-approval and SoD remain enforced by the shared engine.

Seed workflows:

- Spend request: manager → finance
- Expense: manager
- Reimbursement: manager
- Bill: AP → finance
- Procurement: manager → finance
- Travel: manager → finance

## Flow L — Accounting dimensions, coding and sync

### L1. Dimension administration

**Actor:** Finance Admin/Owner with `accounting.code`. Route: `/app/company/accounting-dimensions`.

Create local values:

- Type/key: `GL Account`, `Department`, `Location`, `Class`, `Project`, or custom
- Code: `6100`
- Label: `Office equipment`
- Values: controlled list
- Source: `LOCAL` in sandbox; provider/source metadata is retained for future ERP sync

### L2. Accounting queue

1. Open `/app/accounting/review`.
2. Review source type, amount, memo, category and coding.
3. Add GL/department/location/project using controlled dimensions.
4. Mark ready.
5. Open `/app/accounting/ready-to-sync` and sync sandbox ERP.
6. Confirm in `/app/accounting/synced`.
7. Failed rows appear in `/app/accounting/errors`; retry uses the same external ID to prevent duplicate postings.

## Flow M — Notifications, audit and integrations

- `/app/notifications`: open actionable notification; verify it links to exact source record.
- `/app/inbox`: task decision and source record.
- `/app/company/audit`: actor, action, object, old value, new value and time.
- `/app/company/integrations`: integration status, health, cursor and sandbox ping.

Current integrations are mock/sandbox: `mock-issuer`, `mock-travel`, `mock-netsuite`, `MOCK_QBO`. No live card issuer, bank rail, ERP, payout rail, OCR provider or travel provider is claimed.

## 5. Permission/action matrix

| Resource/action | Required permission | Normal actor | Scope/state note |
|---|---|---|---|
| Invite people | `people.invite` | Owner/Finance | Tenant/entity controlled |
| Edit/suspend people | `people.edit` | Owner/Finance | People lifecycle; terminate freezes cards/revokes sessions |
| Assign/remove roles | `roles.assign` | Owner/Finance | Entity restriction required where applicable |
| Entity/dept/location edit/archive | `roles.assign` | Owner/Finance | Archive blocked by unsafe financial dependencies |
| View/manage cards | `card.read`, `card.freeze`, `card.issue` | Employee own; Finance/Admin manage | Card holder/entity scope; freeze/unfreeze/terminate/control |
| Create spend program | `spend_program.manage` | Owner/Finance | Entity scoped |
| Create spend request | `spend_request.create` | Employee | Self scope |
| Approve spend | `spend_request.approve` | Manager/Finance/Owner | Direct report or organization scope; requester cannot approve |
| Expense create/submit | `expense.create` | Employee | Own expense |
| Expense approve | `expense.approve` | Manager/Finance/Owner | Direct report/organization scope |
| Receipt link | `expense.create` | Employee/Finance | Candidate must be tenant-safe and permitted |
| Reimbursement submit | `reimbursement.create` | Employee | Own reimbursement |
| Reimbursement approve | `reimbursement.approve` | Manager/Finance/Owner | Approval state/SoD |
| Schedule/confirm payout | `reimbursement.pay` | Finance/Treasury | Approved only; separate payout authority |
| Vendor create/edit | `vendor.create` | AP/Finance/Owner | Entity scoped |
| Vendor bank change/verify | `vendor.bank_details.manage` | Finance/Owner | Masked details and changer/verifier SoD |
| Bill create/edit DRAFT | `bill.create` | AP/Finance | DRAFT-only edit; protected records use cancel rules |
| Bill approve | `bill.approve` | AP/Finance/Owner | Workflow/AP → finance |
| Schedule payment | `payment.create` | Finance/AP | Remaining balance/state checked |
| Release/settle payment | `payment.release` | Treasury/Finance | Creator/releaser SoD |
| Payment-run compose/release | `payment_run.manage` | Treasury/Finance | OPEN-only add/remove; creator cannot release |
| Procurement request | `procurement.request` | Employee | Self/entity scope |
| PO/receiving/match | `procurement.review` / `po.create` | Manager/Finance/AP | PO after final approval; tolerance enforced |
| Travel book | `travel.book` | Employee/Travel/Finance | Traveler/entity scope |
| Travel approve | `travel.approve` | Manager/Finance/Owner | OOP/high-value approval |
| Accounting code/ready | `accounting.code` | Finance/Owner | Controlled dimensions |
| Accounting sync/retry | `accounting.sync` | Finance/Owner | Idempotent external IDs |
| Budget edit | `budget.manage` | Finance/Owner | Cannot reduce below actual + committed |
| Reports/integrations | `report.read`, accounting permissions | Finance/Owner | Tenant/entity scope |
| Audit | `audit.read` | Owner/authorized finance | Read-only historical evidence |

## 6. State and correction semantics

| Record | Normal lifecycle | Correction action |
|---|---|---|
| User | INVITED → ACTIVE → SUSPENDED/TERMINATED | Activate, reset credentials, suspend, terminate |
| Spend request | DRAFT/SUBMITTED → IN_REVIEW → APPROVED/FULFILLED or REJECTED | Valid state action; no arbitrary edit after protected stage |
| Card | ACTIVE ↔ FROZEN → TERMINATED | Freeze/unfreeze/terminate; no hard delete |
| Expense | INCOMPLETE → SUBMITTED/IN_REVIEW → APPROVED/ACCOUNTED | Add memo/receipt, submit, approve, reverse/cancel through domain rules |
| Reimbursement | DRAFT → SUBMITTED/IN_REVIEW → APPROVED → SCHEDULED/PAID or FAILED/RETURNED | Submit, approve, payout retry/return; no delete after payment |
| Bill | DRAFT → NEEDS_REVIEW/PENDING_APPROVAL → APPROVED → PARTIAL/PAID | Edit DRAFT, submit, approve, cancel where valid |
| Payment | SCHEDULED → PROCESSING/SENT → SETTLED | Cancel only cancellable state; settle once |
| Payment run | OPEN → RELEASED | Add/remove only OPEN; release through existing payment logic |
| Procurement/PO | DRAFT → SUBMITTED → APPROVED → ISSUED → receiving/match | Change order after issuance; no issued-history hard delete |
| Match exception | OPEN/IN_REVIEW → requested/corrected/resolved/rejected | Resolution commands only |
| Travel | DRAFT → approval → booking/confirmed → cancelled/refund | Cancel/refund according to booking state/terms |
| Entity/department/location | ACTIVE → ARCHIVED | Archive only when safe |
| Policy/workflow | DRAFT/version → ENABLED → DISABLED | Version/disable; preserve history |

## 7. Production/sandbox boundary

The current repository is a complete P0/P0.5 product flow, but provider connections are mock. Before production, replace adapters behind the same interfaces for card issuing, banking/ACH, payout, accounting/ERP, OCR, email, storage, travel and fraud/KYC. Add provider webhooks, signature verification, retry/replay handling, reconciliation and compliance approvals before claiming live financial execution.

## 8. Recommended demo script

1. Login as Admin and show Overview.
2. Login as Employee and create spend request.
3. Login as Manager and approve.
4. Login as Admin/Finance and approve/finalize.
5. Open `/app/cards/:id`, authorize and capture sandbox spend.
6. Link receipt, submit expense, approve and show accounting.
7. Create reimbursement and show server calculation/payout.
8. Create vendor/bill, approve, schedule payment and compose/release run.
9. Create procurement request, issue PO, receive and resolve exception.
10. Create trip, approve/book, cancel/refund.
11. Return to Admin: People/Roles, Policy, Approval Workflow, Accounting Dimensions, Audit and Notifications.

Closing statement:

> “The platform connects employee spend, cards, expenses, reimbursements, AP, procurement, travel and accounting through tenant-safe RBAC, state transitions, approval workflows, separation of duties, audit events and idempotent settlement.”

