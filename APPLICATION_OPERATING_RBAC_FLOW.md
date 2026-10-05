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
- Comments: `
`

Submit. The policy result is server-generated: `PASS`, `WARN`, `REVIEW`, or `BLOCK`.

### B3. Approval

1. **Actor: Manager — Page: `/app/inbox`.** Open the request assigned to `manager@acme.test`, check policy and timeline, then click **Approve**.
2. **Actor: Finance Admin/Owner — Page: `/app/inbox`.** Open the **next inbox task for the same request**, check the amount/policy/timeline, then click **Approve**. This is the final human approval; it is not a second request, and the Employee does not approve anything here.
3. **Actor: System — Page/result: `/app/spend/requests/:id` and `/app/cards/:id`.** Immediately after Finance Admin/Owner clicks **Approve**, the system changes the request to `FULFILLED` and creates the linked virtual card/fund. No user fills another form at this step.
4. **Actor: Employee — Page: `/app/me/requests` or `/app/spend/requests/:id`.** Open the fulfilled request and view/use the linked card. The Employee does not create the card manually. If the configured workflow has only one approval step, Manager's approval on `/app/inbox` is final and Finance Admin/Owner is not required for that request.

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

Use this exact handoff after Aiden/AP has created and submitted the bill. The approval steps finish the **bill**; they do not create a payment automatically.

1. **Actor: AP/Aiden — Page: `/app/bill-pay/bills/:id`.** Open the submitted bill, confirm vendor, invoice number, total `330.00`, line items and document, then click **Submit** (if it is still `DRAFT`). The bill becomes `PENDING_APPROVAL`.
2. **Actor: Finance user — Page: `/app/inbox` or `/app/bill-pay/bills/:id`.** Open the bill approval task, review the bill and click **Approve**. This completes Finance's approval step; it does not schedule money.
3. **Actor: ADMIN/Owner — Page: `/app/inbox` or `/app/bill-pay/bills/:id`.** If the workflow has a second approval, open the **same bill** and click **Approve**. This is the final bill approval. The bill becomes `APPROVED` and its remaining payable balance is shown.
4. **Actor: AP/Finance payment creator — Page: `/app/bill-pay/bills/:id` or `/app/bill-pay/payments`.** Now click **Create/Schedule payment** for the approved bill. Enter the amount (for this demo, the remaining `330.00`), rail `ACH`, and a unique idempotency key if the form asks for one. Click **Schedule**. This creates a separate payment with status `SCHEDULED`; it does not release money yet.
5. **Actor: Treasury/Finance releaser — Page: `/app/bill-pay/payments/:id` or `/app/inbox`.** Sign in as a different user from the payment creator, open the `SCHEDULED` payment, verify amount/vendor/bank mask, then click **Release**. The creator cannot click Release; that is intentional SoD protection. Status becomes `PROCESSING`/`SENT`.
6. **Actor: Treasury/Finance releaser — same payment page `/app/bill-pay/payments/:id`.** After the sandbox rail response, click **Confirm settlement** (or the equivalent settlement action). The payment becomes `SETTLED`, the bill remaining amount decreases once (to `0.00` for a full payment), and one accounting source entry is created.

**Simple demo handoff:** Aiden/AP creates and submits bill → Finance approves bill → ADMIN approves same bill → AP/Finance clicks **Schedule payment** → Treasury opens payment and clicks **Release** → Treasury clicks **Confirm settlement**. If payment was created by AP, AP must not release it; use `treasury@acme.test`.

## Flow F — Payment run

Payment Run is a **batch/container for already-created scheduled payments**. An approved bill does not appear in a run until somebody first creates a payment for that bill.

### F1. Prepare an eligible payment

1. **Actor: AP/Finance payment creator — Page: `/app/bill-pay/bills/:id`.** Open a bill whose status is `APPROVED`.
2. Click **Create/Schedule payment**. Enter the remaining bill amount (for example `330.00`) and rail `ACH`, then click **Schedule**.
3. **Expected result:** a separate payment is created with status `SCHEDULED`. If the payment is not `SCHEDULED`, it will not be selectable in a run. The person who created it cannot release it.

### F2. Create the empty run

4. **Actor: Finance Admin/run creator — Page: `/app/bill-pay/payment-runs`.** Click **Create run**.
5. Fill:
   - Name: `Weekly AP Demo`
   - Legal entity: `Acme US LLC`
   - Source account: `Operating ••••1111`
6. Click **Save/Create**. The new run opens with status `OPEN` and payment count `0`.

### F3. Add the scheduled payment to the run

7. **Actor: same Finance Admin/run creator — Page: `/app/bill-pay/payment-runs/:id`.** In the eligible-payment list, find the payment from F1. It must be approved-bill payment, same legal entity, and `SCHEDULED`.
8. Tick that payment and click **Add selected payments**.
9. Confirm the run summary now shows payment count `1`, the correct total (for example `330.00`), source account `Operating ••••1111`, and no validation issues.
10. If the wrong payment was selected, while run status is still `OPEN`, select it and click **Remove**. It returns to the eligible list; adding it again links the same payment and does not create a duplicate payment.

### F4. Release the run and settle the payments

11. **Actor: different user — Page: `/app/bill-pay/payment-runs/:id`.** Sign out of the run creator and sign in as `treasury@acme.test` (or another authorized Finance user). Open the same run and review count, total, account and validation issues.
12. Click **Release run**. The run becomes `RELEASED`; its payment moves to `PROCESSING`/`SENT` through the existing payment-release logic. The original creator is intentionally blocked by SoD if they try to release it.
13. **Actor: Treasury — Page: `/app/bill-pay/payments/:id`.** Open the payment inside the released run and click **Confirm settlement** after the sandbox rail response.
14. **Expected result:** payment becomes `SETTLED`, the bill remaining amount decreases once, and accounting source is created. The run remains a historical batch; no second payment object is created.

**One-line demo sequence:** Approved bill → AP schedules payment → Finance creates `OPEN` run → Finance adds the `SCHEDULED` payment → Treasury releases run → Treasury confirms settlement.

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

1. **Actor: Employee — Page: `/app/travel/trips`.** Search available sandbox flight/hotel/car offers.
2. **Actor: Employee — Page: `/app/travel/trips/:id`.** Select one quote and click **Reprice**. Confirm the repriced amount is within the allowed tolerance.
3. **Actor: Employee — same trip detail page.** Click **Submit**. If the amount is out-of-policy or high value, the trip becomes `PENDING_APPROVAL`; otherwise it can continue without approval.
4. **Actor: Manager, then Finance (if configured) — Page: `/app/inbox`.** Open the exact trip approval task and click **Approve**. After the final approval, return to the trip detail page.
5. **Actor: Employee or authorized Travel/Finance user — Page: `/app/travel/trips/:id`.** In the selected booking card, click **Place mock hold**. Expected booking status: `BOOKED_MOCK`. Then click **Confirm sandbox booking**. This is two separate buttons; do not click Confirm before the mock hold succeeds.
6. **Actor: System (automatic after Confirm sandbox booking) — Result on `/app/travel/trips/:id`.** The booking becomes `CONFIRMED`, the trip becomes `CONFIRMED`, and the system automatically creates/attaches a temporary travel **fund** with the booking amount and a travel-restricted virtual **card** for the traveler. The operator does not fill a fund/card form in this step. The new fund/card IDs appear in the trip timeline/details.
7. **Actor: Traveler or authorized Travel/Finance user — Page: `/app/travel/trips/:id`.** Use the newly attached travel card for a sandbox travel transaction if you want to demonstrate spend. A card transaction/expense is **not** created merely by confirming the booking; it appears only after a card authorization/capture. Then, for a refundable confirmed booking, click **Cancel**.
8. **Actor: same authorized travel user — same trip detail page.** After the booking changes to `CANCELLED`/refund-eligible, click **Refund / Simulate refund**. Do not click Refund while the booking is still `CONFIRMED`.
9. **Actor: any permitted viewer — Page: `/app/travel/trips/:id`.** Show cancellation terms, refund status, refund amount, fund/card references and the activity timeline.

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
| Travel approve | `travel.approve` | Manager/Finance/Owner | Manager → finance chain on every submit |
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

## 8. Demo-day operator runbook (follow this exact order)

This is the section to use while presenting. Do not improvise users. Keep one browser tab per account, or sign out before changing accounts. After every step, confirm the **Expected result** before moving to the next account.

### 8.1 Login cards (write these on your demo notes)

| Demo label | Login email | Password | Use this account for |
|---|---|---|---|
| ADMIN | `admin@acme.test` | `password123` | setup, final approvals, audit, policies, roles |
| EMPLOYEE | `employee@acme.test` | `password123` | own request, expense, receipt, reimbursement, travel |
| MANAGER | `manager@acme.test` | `password123` | direct-report approvals |
| AP | `ap@acme.test` | `password123` | vendors, bills, payment creation, AP review |
| TREASURY | `treasury@acme.test` | `password123` | payment release, payment-run release, payout |

At `/login`, enter workspace **acme** plus the email/password above. If a seeded password was changed, use the value of `SEED_PASSWORD`. Never use ADMIN to demonstrate an Employee-only action; the audience must see the RBAC separation.

### 8.2 Run 1 — setup and invite (ADMIN)

**Login:** `admin@acme.test`  
**Page:** `/app/company/people`  
**Button:** `Invite person`  
**Fill exactly:**

| Field | Value |
|---|---|
| Email | `demo-new-user@acme.test` |
| First name | `Demo` |
| Last name | `New User` |
| Role | `Employee` |
| Manager | `manager@acme.test` |
| Entity | `Acme US LLC` |

Click **Send invite**. In sandbox click **Copy activation link**; do not type a token into any database.  
**Expected result:** person status is `INVITED`.  
**Switch to:** invited user opens `/activate?token=...`, enters a new 12+ character password twice, clicks **Activate**, then signs in at `/login`. Status becomes `ACTIVE`.

### 8.3 Run 2 — configure spend program (ADMIN)

**Login:** `admin@acme.test`  
**Page:** `/app/spend/programs` → `Create program`  
**Fill:** name `Software subscriptions`; entity `Acme US LLC`; currency `USD`; maximum `5000`; budget `Engineering 2026`; fulfillment `Virtual card`; merchant lock `OpenAI`; allowed MCC `software,saas`; per-transaction limit `250`; velocity amount `1000`; velocity count `10`; validity `30 days`.  
Click **Save**, then open the program and confirm it is `ACTIVE`.  
**Expected result:** the program appears in the Employee request form.

### 8.4 Run 3 — employee requests a virtual card (EMPLOYEE → MANAGER → ADMIN)

**Login:** `employee@acme.test`  
**Page:** `/app/me/requests` → `New request`  
**Fill:** name `Annual analytics subscription`; purpose `Customer reporting for Q4`; amount `600`; currency `USD`; entity `Acme US LLC`; program `Software subscriptions`; vendor `OpenAI`; category `Software`; fulfillment `Virtual card`; recurrence `One-time`; expiry `30 days from today`; comment `Receipt required`.  
Click **Submit**.  
**Expected result:** request status is `SUBMITTED`/`IN_REVIEW`; an approval task is created for MANAGER.

**Switch to MANAGER.** Page `/app/inbox` → open the request → check amount, policy result and timeline → click **Approve**.  
**Expected result:** next Finance/Owner approval task is created.

**Switch to ADMIN.** Page `/app/inbox` → open the same request → click **Approve/Fulfill**.  
**Expected result:** request is `FULFILLED`; linked virtual card/fund is created. Click the request row to prove it opens `/app/spend/requests/:id`.

### 8.5 Run 4 — card controls and spend (ADMIN/TREASURY)

**Login:** `admin@acme.test`  
**Page:** `/app/cards`  
Show the audience **active card count**, **total limits**, **total spend**, and the card ending in its masked last four digits. Click the card row.  
**Page:** `/app/cards/:id`  
**Controls to set:** merchant `OpenAI`; allowed MCCs `software,office`; per-transaction `40.00`; velocity amount `50.00`; velocity count `1`; window `24 hours`. Click **Save controls**.  
Click **Freeze**, confirm the dialog, then click **Unfreeze**. Click **Terminate** only if demonstrating the terminal state.  
**Expected result:** status and controls change, and an audit event is visible. Raw PAN/bank data is never shown.

For the spend demonstration enter amount `25.00`, merchant `OpenAI`, category `software`; click **Authorize**, then **Capture**.  
**Expected result:** authorization becomes a cleared transaction and a linked expense appears in `/app/expenses/transactions`. To show a decline, retry with MCC `gambling` or amount `45.00`; expected errors are `MCC_BLOCKED` or `PER_TXN_LIMIT`.

### 8.6 Run 5 — receipt and expense (EMPLOYEE → MANAGER → ADMIN)

**Login:** `employee@acme.test`  
**Page:** `/app/me/expenses` → open the OpenAI expense  
Fill memo `ChatGPT team plan`; upload a PDF/PNG/JPEG receipt; click **Save**. Open `/app/expenses/receipts/:id`, search employee `employee@acme.test`, merchant `OpenAI`, amount `25.00`, and select the suggested expense → **Link**. Click **Submit**.  
**Expected result:** expense is `SUBMITTED` and receipt is linked.

**Switch to MANAGER.** `/app/inbox` → open expense → click **Approve**.  
**Switch to ADMIN.** `/app/accounting/review` → assign GL `6100`, Department `Engineering`, Location `Austin`, Project `P0 Demo` → **Mark ready** → `/app/accounting/ready-to-sync` → **Sync**.  
**Expected result:** accounting row is synced or appears in errors with a retry action.

### 8.7 Run 6 — reimbursement (EMPLOYEE → MANAGER → TREASURY)

**Login:** `employee@acme.test`  
**Page:** `/app/me/reimbursements` → `New reimbursement`  
**Fill standard:** entity `Acme US LLC`; type `STANDARD`; amount `85.50`; currency `USD`; memo `Client lunch`; merchant `Cafe Demo`; category `Meals`; expense date today. Click **Submit**.  
**Expected result:** `SUBMITTED`; MANAGER task appears.

**Switch to MANAGER:** `/app/inbox` → open reimbursement → **Approve**.  
**Switch to TREASURY:** `/app/expenses/reimbursements` → select approved reimbursement → **Schedule payout** → **Confirm payout**.  
**Expected result:** `PAID`; server amount remains authoritative.

To demonstrate calculated types, create another request as EMPLOYEE with type `MILEAGE`, distance `120` miles, memo `Client visit`, or type `PER_DIEM`, eligible days `3`, destination `New York`. Show the configured rate and calculated total; do not claim that a manually typed total is authoritative.

### 8.8 Run 7 — vendor, bill, payment and payment run (AP → TREASURY)

**Login:** `ap@acme.test`  
**Page:** `/app/vendors` → `Add vendor`  
**Fill:** name `Acme Office Supplies`; category `Office`; entity `Acme US LLC`; risk `MEDIUM`; notes `Demo supplier`. Save. Open vendor → **Payment Details**. Enter only last four `1111`, masked routing `****111`, method `ACH`, reason `Initial setup`; save and complete verification if requested.  
**Expected result:** only masked details, verification state, last changed and history are visible.

**Page:** `/app/bill-pay/bills/new` → `Create bill`  
**Fill header:** entity `Acme US LLC`; vendor `Acme Office Supplies`; invoice `INV-DEMO-001`; invoice date today; due date 30 days later; currency `USD`; memo `Office equipment purchase`; upload invoice PDF.  
**Add line:** description `Office chair`; quantity `2`; unit price `150.00`; tax `30.00`; GL `6100`; Department `Engineering`; Location `Austin`; Project `P0 Demo`. Server total must display `330.00`. Click **Save draft**, edit the description, then **Submit**.  
**Expected result:** DRAFT can be corrected; submitted/protected stages cannot be arbitrarily edited.

**Switch to FINANCE/AP approver.** Open `/app/inbox` → select the same submitted bill → review → **Approve**.  
**Switch to ADMIN.** Open `/app/inbox` → select the same bill's next approval → **Approve**. The bill is now `APPROVED`; approval alone does not create a payment.  
**Switch to AP (`ap@acme.test`).** Open `/app/bill-pay/bills/:id` → click **Create/Schedule payment** → amount equal to remaining balance (`330.00` in this demo), rail `ACH` → **Schedule**.  
**Expected result:** a separate payment is `SCHEDULED`; AP/payment creator cannot release it.

**Switch to TREASURY (`treasury@acme.test`).** Open `/app/bill-pay/payments/:id` (or `/app/inbox`) → verify the scheduled payment → **Release**. Then click **Confirm settlement** on the payment detail.  
**Expected result:** payment becomes `SETTLED`, bill remaining becomes `0.00`, and accounting source is created.

For the payment-run version, open `/app/bill-pay/payment-runs` → `Create run`; name `Weekly AP Demo`; entity `Acme US LLC`; source account `Operating ••••1111`. Open run detail, select the scheduled payment, click **Add selected payments**, verify count/total/issues, optionally remove and re-add it, then have a different Treasury user click **Release run**.  
**Expected result:** existing settlement logic moves payment through `PROCESSING/SENT` to `SETTLED`; no duplicate payment object is created.

### 8.9 Run 8 — procurement and match exception (EMPLOYEE → MANAGER → ADMIN)

**Login:** `employee@acme.test`  
**Page:** `/app/procurement/requests` → `New procurement request`  
**Fill:** name `Laptop purchase`; entity `Acme US LLC`; program `Software intake`; amount `1200`; currency `USD`; outcome `Purchase order`; vendor `Acme Office Supplies`; memo `Two laptops for finance`. Submit.  
MANAGER approves from `/app/inbox`; ADMIN/Finance completes final approval.  
**Expected result:** PO is created only after final approval.

**Login:** `admin@acme.test`  
**Page:** `/app/procurement/purchase-orders/:id` → **Record receiving**; enter actual received quantity/amount and memo `Partial delivery received`.  
Open `/app/procurement/match-exceptions`. Choose the exception and use one action at a time: **Request receiving update**, **Request corrected invoice**, **Approve override**, **Comment**, then **Resolve** when corrected.  
**Expected result:** state, audit and outbox update; no DB edit is needed.

### 8.10 Run 9 — travel cancellation/refund (EMPLOYEE → MANAGER → TREASURY/ADMIN)

**Login:** `employee@acme.test`  
**Page:** `/app/travel/trips` → `New trip`  
**Fill:** name `NYC customer visit`; origin `Lahore`; destination `New York`; start `2026-10-10`; end `2026-10-12`; estimate `1200 USD`; purpose `Customer workshop`; entity `Acme US LLC`. Search a sandbox offer, select it, reprice and submit.  
MANAGER then ADMIN approve from `/app/inbox` if the trip requires both approvals. Return to `/app/travel/trips/:id`, click **Place mock hold**, wait for `BOOKED_MOCK`, then click **Confirm sandbox booking**.  
**Expected result:** booking and trip become `CONFIRMED`; the system automatically attaches a temporary travel fund and travel-restricted virtual card. No fund/card form is filled manually. A card transaction/expense appears only if you separately authorize/capture a sandbox transaction on that card.

On `/app/travel/trips/:id`, click **Cancel** for a refundable confirmed booking. After it becomes `CANCELLED`/refund-eligible, click **Refund/Simulate refund**.  
**Expected result:** refund status, refund amount and activity timeline are visible. Do not click Refund before cancellation.

### 8.11 Run 10 — admin configuration proof (ADMIN)

Use `admin@acme.test` for all pages below:

1. `/app/company/people/:id`: change manager/department/location, assign or remove a role, and show Suspend/Terminate/Reset credentials. Explain that termination revokes sessions and freezes active cards.
2. `/app/company/policy`: create `Receipt over 75`; object `expense`; condition amount `>75`; action `require receipt`; priority `10`; effective date today; simulate; then enable. Edit by creating a new version; disable only from a valid state.
3. `/app/company/approvals`: create `Spend two-step approval`; step 1 `manager`; step 2 `finance`; threshold `500`; preview/simulate; enable. Explain self-approval and SoD remain enforced.
4. `/app/company/accounting-dimensions`: add GL `6100 / Office equipment`, Department `Engineering`, Location `Austin`, Project `P0 Demo`, source `LOCAL`.
5. `/app/notifications`: open each actionable notification and prove it links to the exact request, bill, payment, reimbursement, exception or trip record.
6. `/app/company/audit`: filter by actor/object and show the invite, card-control, bill, payment-run and approval audit events.

### 8.12 Demo recovery rules

- If a button is missing, check the logged-in email, entity scope, permission and record state before assuming a bug.
- If an approval is missing, switch to the manager of the record owner (`manager@acme.test`) first, then Finance/Owner.
- If a payment cannot release, use a different Finance/Treasury user because creator/releaser SoD is intentional.
- If a bill cannot edit, it is no longer `DRAFT`; use cancel/void or the valid domain correction action.
- If a card cannot unfreeze, check policy, termination state and the user’s `card.freeze` permission.
- If a notification opens a list, copy the source record ID from the notification and use `/app/search` to open the exact detail route.
- Never hard-delete a settled payment, cleared transaction, paid reimbursement, issued PO, synced accounting record or audit event.

Closing statement:

> “The platform connects employee spend, cards, expenses, reimbursements, AP, procurement, travel and accounting through tenant-safe RBAC, state transitions, approval workflows, separation of duties, audit events and idempotent settlement.”
