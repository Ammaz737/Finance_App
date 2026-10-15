# Finance Platform — Complete Role-Based Demo Runbook

> Verification correction, 15 October 2026: Read [FLOW_VERIFICATION_2026-10-15.md](docs/FLOW_VERIFICATION_2026-10-15.md) before the demo. Ordinary spend reuses the employee's ordinary card and tops up its wallet. Travel currently creates a separate instrument. Corporate Cards can hide the ordinary card by selecting a newer travel card. The source checks below are not live deployment verification.

This is the operator script for the P0/P0.5 sandbox. Follow it in order. Every step states the **user**, **page**, **data**, **button**, **result**, and **next user**.

## 1. Demo users

| Label | Login | Role | Primary work |
|---|---|---|---|
| ADMIN | `admin@acme.test` / `password123` | Owner | users, roles, policies, workflows, final approvals, audit |
| AIDEN/AP | `ap@acme.test` / `password123` | Finance Admin | vendors, bills, payment creation, AP review |
| FINANCE/TREASURY | `treasury@acme.test` / `password123` | Finance Admin | payment release, settlement, reimbursement payout |
| MANAGER | `manager@acme.test` / `password123` | Manager | direct-report approvals |
| EMPLOYEE | `employee@acme.test` / `password123` | Employee | own requests, expenses, reimbursements, procurement and travel |

Workspace: `acme`. Organization: `Acme Manufacturing`. Main entity: `Acme US LLC`, currency `USD`. If `SEED_PASSWORD` is configured, use that password instead.

## 2. Role rules

- Employee creates/submits own work; cannot approve own work.
- Manager approves direct-report requests and expenses.
- Finance/AP operates vendors, bills, accounting and payment creation.
- Treasury releases payments and confirms settlement; payment creator cannot release.
- Admin/Owner configures the organization and completes final approval where configured.
- Every material action is tenant-scoped, state-checked, RBAC-checked, audited and emitted to outbox.

## 3. Start: create and activate a user

### 3.1 Admin invites the user

**Login:** ADMIN  
**Page:** `/app/company/people`  
**Click:** `Invite person`  
**Fill:** email `demo.employee@acme.test`; first name `Demo`; last name `Employee`; role `Employee`; manager `manager@acme.test`; entity `Acme US LLC`; department `Engineering`; location `Austin`.  
**Click:** `Send invite`.  
**Result:** invitation creates a `DRAFT` user awaiting activation; copy the returned activation link.  
**Next:** invited user opens the copied link.

### 3.2 Invited user activates

**Login:** invited user  
**Page:** `/activate?token=...`  
**Fill:** new password (12+ characters, upper/lowercase and number) and confirmation.  
**Click:** `Activate`; then go to `/login`, workspace `acme`, and sign in.  
**Result:** user status becomes `ACTIVE`; token is one-time and cannot be reused.

### 3.3 Admin verifies role/entity assignment

**Login:** ADMIN  
**Page:** `/app/company/people/:id`  
**Check/edit:** manager, department, location, legal entity, role, scope and entity restriction. Click `Save`.  
**Result:** user sees only permitted pages. Use `/app/company/roles/:id` to show role name, permissions, scope and entity restrictions.

## 4. Admin setup before operational demo

**Login:** ADMIN.

1. `/app/company/entities`: confirm `Acme US LLC / US / USD`.
2. `/app/company/departments`: confirm `Engineering`.
3. `/app/company/locations`: confirm `Austin`.
4. `/app/company/accounting-dimensions`: add GL `6100 / Office equipment`, Department `Engineering`, Location `Austin`, Project `P0 Demo`.
5. `/app/spend/programs` → create `Software subscriptions`; entity `Acme US LLC`; max `5000 USD`; fulfillment `Virtual card`; merchant `OpenAI`; MCCs `software,saas`; per-transaction `250`; velocity `1000` amount / `10` transactions.
6. `/app/company/policy` → create `Receipt over 75`; object `expense`; condition amount `>75`; action `require receipt`; simulate, then enable.
7. `/app/company/approvals` → verify `Spend two-step approval`: Manager → Finance; preview/simulate, then enable.

## 5. Employee spend request → approvals → card

### 5.1 Employee submits request

**Login:** EMPLOYEE  
**Page:** `/app/me/requests` → `New request`  
**Fill:** name `Annual analytics subscription`; purpose `Customer reporting for Q4`; amount `600`; currency `USD`; entity `Acme US LLC`; program `Software subscriptions`; vendor `OpenAI`; category `Software`; fulfillment `Virtual card`; recurrence `One-time`; expiry `30 days`; comment `Receipt required`.  
**Click:** `Submit`.  
**Result:** `SUBMITTED`/`IN_REVIEW`; Manager task appears.

### 5.2 Manager approves

**Login:** MANAGER  
**Page:** `/app/inbox`  
**Action:** open the exact request, review policy/timeline, click `Approve`.  
**Result:** Finance/Admin task appears when two-step workflow is active.

### 5.3 Finance/Admin gives final approval

**Login:** FINANCE or ADMIN  
**Page:** `/app/inbox`  
**Action:** open the next task for the same request, verify amount/policy/timeline, click `Approve`.  
**System result:** request becomes `FULFILLED`. For `VIRTUAL_CARD`, the first approval without an ordinary live card creates one; subsequent approvals reuse the ordinary card and move the request fund balance into its wallet. A zero request-fund balance can mean a successful top-up. For `FUND_ONLY`, there is no card fulfillment. No card form is filled here.  
**Employee page:** `/app/me/requests` or `/app/spend/requests/:id` to view the fulfilled request/card.

**Top-up demonstration:** note the ordinary card ID and wallet balance first. Submit another `VIRTUAL_CARD` request for `100 USD`, complete its assigned approvals, then open the same request's linked card or `/app/me/cards`. Expect the same ordinary card ID and wallet balance increased by `100`, assuming no intervening spend. Do not use a travel card as the baseline. The Corporate Cards overview currently can select a travel card instead; see the verification report.

## 6. Cards and card spend

**Login:** ADMIN or FINANCE  
**Overview page:** `/app/cards` — currently shows one selected card per holder and available balance of selected cards. It does not reliably show all wallets or total transaction spend. Prefer the fulfilled request's exact card link, or Employee `/app/me/cards`, for the ordinary-wallet demo.  
**Detail page:** `/app/cards/:id` — set merchant `OpenAI`; allowed MCCs `software,office`; per-transaction `40.00`; velocity `50.00` amount / `1` transaction / `24` hours. Click `Save controls`.  
**Actions:** `Freeze` → confirm → `Unfreeze`; `Terminate` only for terminal-state demo.  
**Result:** card status/control changes are audited.

To show spend: on card detail enter amount `25.00`, merchant `OpenAI`, category `software`; click `Authorize`, then `Capture`. A cleared transaction and expense appear. Try MCC `gambling` or amount `45.00` to show a policy decline.

## 7. Expense → receipt → accounting

**EMPLOYEE — `/app/me/expenses`:** open expense; memo `ChatGPT team plan`; upload PDF/PNG/JPEG receipt; save.  
**EMPLOYEE/FINANCE — `/app/expenses/receipts/:id`:** search employee, merchant, amount, date or transaction; select candidate; click `Link`; submit expense.  
**MANAGER — `/app/inbox`:** open expense; click `Approve`.  
**FINANCE/ADMIN — `/app/accounting/review`:** select GL `6100`, Department `Engineering`, Location `Austin`, Project `P0 Demo`; click `Mark ready`.  
**FINANCE/ADMIN — `/app/accounting/ready-to-sync`:** click `Sync`.  
**Result:** synced row appears, or an error appears in `/app/accounting/errors` for retry.

## 8. Reimbursement

**EMPLOYEE — `/app/me/reimbursements` → `New reimbursement`:** entity `Acme US LLC`; type `STANDARD`; amount `85.50`; currency `USD`; memo `Client lunch`; merchant `Cafe Demo`; category `Meals`; date today; click `Submit`.  
**MANAGER — `/app/inbox`:** open reimbursement; click `Approve`.  
**FINANCE/TREASURY — `/app/expenses/reimbursements`:** click `Schedule payout`, then `Confirm payout`.  
**Result:** status `PAID`. For mileage use distance `120` miles; for per diem use eligible days `3`; server calculates the total.

## 9. Vendor → bill → payment → settlement

### 9.1 Aiden/AP creates vendor and bill

**AIDEN/AP — `/app/vendors`:** create vendor `Acme Office Supplies`, category `
`, entity `Acme US LLC`, risk `MEDIUM`; save. Payment Details: last four `1111`, masked routing `****111`, method `ACH`, reason `Initial setup`; save/verify.  
**AIDEN/AP — `/app/bill-pay/bills/new`:** entity `Acme US LLC`; vendor `Acme Office Supplies`; invoice `INV-DEMO-001`; invoice date today; due date +30 days; currency `USD`; upload invoice PDF. Add line `Office chair`, quantity `2`, unit price `150.00`, tax `30.00`, GL `6100`, Department `Engineering`, Location `Austin`, Project `P0 Demo`. Save draft, correct if needed, then `Submit`. Server total is `330.00`.

### 9.2 Bill approvals

**FINANCE — `/app/inbox`:** open the same bill; verify vendor/total/document; click `Approve`.  
**Next assigned approver — `/app/inbox`:** open the same bill's next approval and click `Approve`. Use ADMIN only when assigned/authorized by the active workflow; a fixed Finance → Admin sequence is not guaranteed.  
**Result:** bill status `APPROVED`; approval does not create a payment.

### 9.3 Create payment

**AIDEN/AP — `/app/bill-pay/bills/:id`:** click `Create/Schedule payment`; amount remaining `330.00`; rail `ACH`; click `Schedule`.  
**Result:** separate payment status `SCHEDULED`. Aiden/payment creator cannot release it.

### 9.4 Release and settle payment

**TREASURY — `/app/bill-pay/payments/:id` or `/app/inbox`:** open scheduled payment; verify amount/vendor/masked bank details; click `Release`.  
**TREASURY — same payment page:** after sandbox rail response, click `Confirm settlement`.  
**Result:** payment `SETTLED`; bill remaining becomes `0.00`; accounting source is created.

## 10. Payment run batch

Payment Run contains already-created `SCHEDULED` payments. An approved bill cannot be added directly.

1. **AIDEN/AP — `/app/bill-pay/bills/:id`:** first create/schedule a payment; confirm status `SCHEDULED`.
2. **FINANCE/AP — `/app/bill-pay/payment-runs`:** click `Create run`; name `Weekly AP Demo`; entity `Acme US LLC`; source `Operating ••••1111`; save. Run is `OPEN` with count `0`.
3. **FINANCE/AP — `/app/bill-pay/payment-runs/:id`:** select the scheduled payment; click `Add selected payments`; verify count, total, source account and validation issues.
4. While run is `OPEN`, select an incorrect payment and click `Remove`; re-adding links the same payment and does not create a duplicate.
5. **TREASURY — same run page:** sign in as `treasury@acme.test`; review run; click `Release run`. Run becomes `RELEASED`; payment becomes `PROCESSING`/`SENT`.
6. **TREASURY — `/app/bill-pay/payments/:id`:** click `Confirm settlement`; payment becomes `SETTLED`.

## 11. Procurement and match exception

**EMPLOYEE — `/app/procurement/requests`:** create `Laptop purchase`; entity `Acme US LLC`; amount `1200 USD`; outcome `Purchase order`; vendor `Acme Office Supplies`; memo `Two laptops for finance`; click `Submit`.  
**MANAGER — `/app/inbox`:** click `Approve`.  
**ADMIN/FINANCE — `/app/inbox`:** final `Approve`; PO is created only after final approval.  
**FINANCE — `/app/procurement/purchase-orders/:id`:** `Record receiving` with a **partial** receipt (e.g. quantity `1` or amount `600`) and memo. Match exceptions do **not** appear from receiving alone.  
**FINANCE/AP — `/app/bill-pay/bills/new?purchaseOrderId=:id`:** create a supplier bill for the same entity/vendor, link the PO, invoice the **full** amount (e.g. `1200`) or a higher invoiced quantity than received; save.  
**FINANCE — same PO detail:** select that bill, optionally set **Invoiced quantity** higher than received (e.g. `2` when only `1` received), click `Run 2/3-way match`. Status `EXCEPTION`/`BLOCKED` opens the queue.  
**FINANCE/ADMIN — `/app/procurement/match-exceptions`:** select the exception; use `Request receiving update`, `Request corrected invoice`, `Approve override`, `Comment`, then `Resolve` / `Mark corrected` when fixed. Never edit the database.

## 12. Travel → fund/card → cancel/refund

**EMPLOYEE — `/app/travel/trips`:** create `NYC customer visit`; origin `Lahore`; destination `New York`; choose future start/end dates; estimate `1200 USD`; purpose `Customer workshop`; entity `Acme US LLC`; select offer; `Reprice`; `Submit`.  
**MANAGER/FINANCE — `/app/inbox`:** approve if policy/high amount requires it.  
**EMPLOYEE/TRAVEL/FINANCE — `/app/travel/trips/:id`:** click `Place mock hold` (status `BOOKED_MOCK`), then `Confirm sandbox booking` (status `CONFIRMED`).  
**System result:** a temporary travel fund and travel-restricted virtual card are automatically created and attached to the trip. No fund/card form is filled manually. A card expense appears only after a separate card authorization/capture.  
**Authorized travel user — same page:** refundable confirmed booking → `Cancel`; after status `CANCELLED`/refund-eligible → `Refund / Simulate refund`. Show cancellation terms, refund status, refund amount and timeline.

## 13. Admin configuration and evidence

**ADMIN:** `/app/company/people/:id` change manager/department/location/entity, assign/remove role, suspend/terminate/reset credentials.  
**ADMIN:** `/app/company/policy` create/edit/version/disable/simulate policies.  
**ADMIN:** `/app/company/approvals` create/preview/simulate/enable/disable workflows.  
**ADMIN:** `/app/company/audit` show actor, action, record, old value, new value and timestamp.  
**ADMIN:** `/app/notifications` open actionable notifications and prove they deep-link to exact records.

## 14. State and safety rules

- Draft bills can be edited; protected/paid bills use valid cancel/void rules.
- Payment creator cannot release payment; run creator cannot release run.
- Cards use freeze/unfreeze/terminate, not hard delete.
- Settled payments, cleared transactions, paid reimbursements, issued POs, synced accounting records and audit events are never hard-deleted.
- If a button is missing, check exact login, entity scope, permission and record state before changing data.

## 15. One-line demo order

**Admin creates user → user activates → Admin assigns role/entity → Admin configures controls → Employee submits request → Manager approves → Finance/Admin final-approves → system creates card → Employee submits expense → Manager approves → Finance codes → Employee submits reimbursement → Manager approves → Treasury pays → Aiden creates bill → Finance/Admin approve → Aiden schedules payment → Treasury releases/settles → Finance creates payment run → Employee submits procurement/travel → approvals → receiving/booking → match resolution/cancel/refund → Admin shows audit and RBAC.**
