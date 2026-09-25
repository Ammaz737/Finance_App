# Finance Platform — Demo Playbook (Urdu/Hinglish)

Yeh playbook demo ke waqt screen-by-screen follow karein. Values sample hain; sandbox mein same pattern use karein.

## 0. Demo setup

Seeded sandbox users:

| Role | Login | Password |
|---|---|---|
| Owner/Admin | `admin@acme.test` | `password123` |
| Manager | `manager@acme.test` | `password123` |
| Employee | `employee@acme.test` | `password123` |
| Treasury | `treasury@acme.test` | `password123` |
| AP | `ap@acme.test` | `password123` |

Workspace: `acme`. If `SEED_PASSWORD` is configured, use that password instead.

Demo rule: mutation hamesha us role se karein jo real company mein action perform karega. Is se RBAC aur SoD visibly demonstrate hoti hai.

Recommended order:

1. Overview → setup data → employee spend → card/expense
2. Reimbursement
3. Vendor → bill → payment → payment run
4. Procurement → PO → receiving → match exception
5. Travel → booking → cancel/refund
6. Admin configuration → accounting → inbox/notifications

## 1. First login and authentication lifecycle

### Normal login

Open `/login`, workspace `acme`, email, and password enter karein.

### Invite → activate

1. Admin: **Company → People → Invite person**.
2. Fill: first name `Demo`, last name `Employee`, unique email, role `Employee`.
3. Save. Sandbox mein **Copy activation link** use karein; raw token ko demo workflow na banayein.
4. Incognito/new browser mein activation link open karein.
5. Password 12+ characters, upper/lowercase, number: `DemoUser12345`.
6. Activate, then `/login` se new user sign in karein.

### Forgot/reset/change password

- `/forgot-password`: workspace + email → **Send reset link** → sandbox **Open link**.
- `/reset-password`: new password + confirmation.
- Authenticated user: **Company → Security → Change password**.
- Session expire hone par expected message: “Your session expired. Please sign in again.”

Demo line: “Invitation token one-time hai, password reset generic response deta hai, aur password change ke baad purani sessions revoke hoti hain.”

## 2. Overview, search, inbox

### Overview

`/app/home` ya **Workspace → Overview** par KPIs, pending approvals, payables, budgets, travel, integrations dikhayein.

### Search

`/app/search` mein vendor name, employee, bill invoice number, request name, expense, PO, payment, ya trip search karein. Result par click exact detail record kholta hai.

### Inbox

`/app/inbox` mein row select karein. Drawer mein policy, amount, requester, progress, timeline aur actions dekhein. **View source record** exact request/bill/payment/travel/match record kholta hai.

## 3. Spend program setup (Admin)

Route: `/app/spend/programs`.

**New spend program** example:

- Name: `SaaS subscriptions`
- Legal entity: `Acme US`
- Maximum request amount: `1000`
- Currency: `USD`
- Default fulfillment: `Virtual card`
- Merchant lock: `OpenAI`
- Allowed MCCs: `software,saas`
- Per-transaction limit: `250`
- Velocity max amount: `1000`
- Velocity max count: `10`
- Validity: `30` days

Program detail par **Edit controls** se change karein. Active requests/financial state ko violate karne wali edits reject hongi. **Deactivate** sirf safe active program par karein.

## 4. Employee spend request → approval → virtual card

### Employee request

Employee: `/app/me/requests` ya `/app/spend/requests` → **New spend request**.

Example form:

- What are you purchasing? `Annual analytics subscription`
- Business purpose: `Customer reporting for Q4`
- Amount: `600`
- Currency: `USD`
- Legal entity: `Acme US`
- Spend program: `SaaS subscriptions`
- Category: `Software`
- Fulfillment: `Virtual card`
- Recurrence: `Monthly` (or `One-time` for the simple demo)
- Expiration: 30 days from today
- Comments: `Vendor renewal; receipt required`

Submit. Policy result PASS/WARN/REVIEW/BLOCK and approval progress explain karein.

### Approval funnel

1. Manager `/app/inbox` → request open → **Approve**.
2. Owner/Admin `/app/inbox` → same request → **Approve**.
3. Final approval ke baad request `FULFILLED` aur one virtual card create hota hai.
4. Request detail se linked card open karein.

Self-approval intentionally fail hoti hai; isko negative-control demo ke taur par dikhayein.

### Card authorization/capture demo

Card detail `/app/cards/:id` ya `/app/spend/cards/:id`:

- Amount: `25.00`
- Merchant: `OpenAI`
- Category: `software`
- **Authorize** → sandbox authorization
- Transactions table mein **Capture** → cleared transaction + expense

Card controls:

- Merchant lock: `OpenAI`
- Allowed MCCs: `software,office`
- Per-transaction limit: `40.00`
- Velocity count: `1`
- Velocity amount: `50.00`
- Window: `24` hours

Grocery MCC ya limit se zyada amount try karein; `MCC_BLOCKED` / `PER_TXN_LIMIT` / velocity decline explain karein.

## 5. Corporate Cards page

Canonical route: `/app/cards`.

Yahan show karein:

- Total active cards
- Currency-wise fund-backed limits
- Spent amount (limit minus available)
- Card table and status
- **Issue card** entry point → existing spend-request form → `Virtual card` fulfillment

Individual card actions:

- ACTIVE → **Freeze**
- FROZEN → **Unfreeze**
- Any non-terminated card → **Terminate**
- Controls save: merchant, MCCs, per-transaction, velocity

Demo line: “Finance team har approved request ko isolated virtual card mein convert kar sakti hai; controls rogue merchant aur excessive velocity ko block karte hain.”

Important: live issuer nahi hai; card result sandbox/mock provider ka hai.

## 6. Expense and receipt flow

1. Captured card transaction se `/app/expenses/transactions` par expense dikhayein.
2. Expense detail open karein; memo aur receipt requirements dekhein.
3. Receipt upload karein (PDF/PNG/JPEG), then **Link receipt**.
4. `/app/expenses/receipts/:id` par candidate picker use karein:
   - employee
   - merchant `OpenAI`
   - amount `25`
   - date/transaction/expense ID
5. Suggested match select → **Link to this expense**.
6. Memo `Golden E2E receipt verified` add karein, then **Submit**.
7. Manager approve kare; accounting queue mein CARD_TRANSACTION source row dekhein.

Receipt-required policy ho to receipt ke baghair submit block hoga.

## 7. Reimbursements

Personal route: `/app/me/reimbursements`. Finance route: `/app/expenses/reimbursements`.

### Standard

- Type: `STANDARD`
- Amount: `85.50`
- Currency: `USD`
- Memo: `Client lunch`
- Merchant: `Cafe Demo`
- Category: `Meals`
- Expense date: today

**Submit** → manager approval → Finance payout schedule → Treasury/Finance confirm settlement → `PAID` → accounting.

### Mileage

- Type: `MILEAGE`
- Distance: `120` miles
- Currency/entity as configured
- Memo: `Client visit`

UI configured rate and server-calculated total show karega. Forged amount/rate accept nahi hota.

### Per diem

- Type: `PER_DIEM`
- Eligible days/nights: `3`
- Destination: `New York`
- Memo: `Conference travel`

Configured rate × eligible days server-calculated amount hai. UI informational hai.

## 8. Vendors and bill payment

### Vendor

Route: `/app/vendors` → **Add vendor**.

- Vendor name: `Acme Office Supplies`
- Category: `Office`
- Entity: `Acme US`
- Risk: `MEDIUM`
- Notes: `Demo supplier`

Vendor detail tabs: Overview, Payment Details, Bills, Payments, Activity.

Payment details mein masked last four `1111`, masked routing, method `ACH`, reason `Initial setup`; verification authorized user kare. Raw bank secret kabhi display nahi hota.

### Bill creation

Route: `/app/bill-pay/bills/new`.

- Entity first select karein; currency auto-align hoti hai.
- Vendor: active vendor from same entity
- Invoice number: `INV-DEMO-001`
- Invoice date: today
- Due date: 30 days later
- Currency: `USD`
- Upload: PDF invoice

Line example:

- Description: `Office chairs`
- Quantity: `2`
- Unit price: `150.00`
- Tax: `30.00`
- GL: `6100 Office equipment`
- Department: `Operations`
- Location: `Lahore`
- Project/job: `P0 Demo`

Total = `330.00`. Server total authoritative hai. **Save as draft** se baad mein edit karein; protected stage ke baad arbitrary edit nahi.

### Bill approval/payment

1. AP `/app/bill-pay/bills?stage=For approval` → approve.
2. Owner/second approver → approve if workflow has another step.
3. Payment create/schedule from bill detail.
4. Treasury/releaser payment release kare; creator release nahi kar sakta.
5. Settlement confirm → remaining bill amount update + accounting entry.

## 9. Payment Run

Route: `/app/bill-pay/payment-runs` → **New payment run**.

- Name: `Weekly AP Demo`
- Entity: same bill entity
- Source account: sandbox bank account

Run detail:

1. Eligible approved/scheduled payments checkbox select.
2. **Add selected payments**.
3. Count, total, source account, validation issues verify.
4. Wrong eligible payment par **Remove**.
5. Another authorized user **Release run**.
6. Existing payment release/settlement path continues to PROCESSING → SETTLED.

## 10. Procurement and match exception

### Procurement request

`/app/procurement/requests` → **New procurement request**:

- Name: `Laptop purchase`
- Entity: `Acme US`
- Program: `Office purchasing`
- Amount: `1200`
- Currency: `USD`
- Outcome: `Purchase order`
- Vendor: active vendor
- Memo: `Two laptops for finance`

Manager approve → Finance/Owner final approve → PO is issued only after final approval.

### Receiving and match

`/app/procurement/purchase-orders/:id` → record receiving:

- Purchase order: selected PO
- Amount/quantity: actual received
- Memo: `Partial delivery received`

Bill matching PO + receiving passes when tolerance is met. Over-variance creates `/app/procurement/match-exceptions`.

Exception actions:

- Approve override
- Request receiving update
- Request corrected invoice
- Mark corrected
- Comment
- Resolve
- Reject

Har action audit/outbox and approval authority rules ke through jata hai.

## 11. Travel

1. `/app/travel/trips` → **New trip**.
2. Example: name `NY Conference`, origin `Lahore`, destination `New York`, dates next month, estimated amount `900 USD`, purpose `Finance conference`.
3. In-policy trip approve; out-of-policy trip manager/Owner approval maangega.
4. Trip detail → **Search offers**.
5. Flight/hotel/car offer select → reprice → **Book/confirm sandbox**.
6. Confirmed booking fund/card links and activity timeline show karein.
7. Confirmed refundable booking → **Cancel**.
8. Cancelled/refund-eligible booking → **Refund / simulate refund**.
9. Terms, refund amount/status, and timeline explain karein.

Provider mock/sandbox hai; live ticketing nahi.

## 12. Admin configuration

### People and roles

`/app/company/people` → person detail:

- Manager
- Department
- Location
- Legal entity
- Assign/remove role
- Suspend/terminate
- Reset credentials

`/app/company/roles/:id` par role name, permissions, scope, entity restrictions show karein. Existing-role assignment P0 capability hai; advanced custom-role builder separate backlog hai.

### Policy builder

`/app/company/policy`:

- Name: `Receipt over 75`
- Object type: `expense`
- Priority: `10`
- Effective date: today
- Enabled: on/off
- Condition: amount/category/department/entity/vendor/merchant/country/date as supported
- Actions: receipt, memo, WARN, REVIEW, BLOCK, approval

**Save policy**, **Edit/version**, **Disable**, **Simulate**. Existing policy engine execution and simulation same rules use karte hain.

### Approval workflow builder

`/app/company/approvals`:

- Name: `Spend two-step approval`
- Object type: `spend_request`
- Steps: manager → finance/Owner
- Mode: sequential; parallel group where needed
- Threshold: e.g. finance step minimum `500`
- Department/entity routing if needed
- Enable only after preview

Self-approval protection and SoD automatically shared engine enforce karta hai.

### Accounting dimensions

`/app/company/accounting-dimensions`:

- Dimension type: GL Account / Department / Location / Class / Project / Custom
- Code: `6100`
- Label: `Office equipment`
- Source: Local (sandbox)
- Values: controlled coding lists

## 13. Accounting and integrations

- `/app/accounting/review`: coding missing/needs review rows.
- Open entry → set controlled category, memo, GL, department.
- Mark ready → `/app/accounting/ready-to-sync`.
- Sync sandbox → `/app/accounting/synced`.
- Failures → `/app/accounting/errors` → retry.
- `/app/accounting/integrations` shows provider health/cursor; mock ERP only.

## 14. Notifications and audit

`/app/notifications` mein actionable notification open karein; exact source record deep-link verify karein. **Company → Audit log** mein actor, action, object, old/new values and timestamp show karein. Demo mein har material mutation ke baad audit trail zaroor dikhayein.

## 15. Closing demo script

“Employee request submit karta hai, policy evaluate hoti hai, manager aur finance approval ke baad isolated virtual card issue hota hai. Card controls merchant/MCC/velocity ko enforce karte hain. Card spend capture hote hi expense aur receipt flow start hota hai. Bills, reimbursements, procurement, travel, payments aur accounting same approval, audit, SoD aur server-authoritative totals ke rules follow karte hain.”

## 16. Demo safety checklist

- Live provider claim na karein: sandbox/mock label dikhayein.
- Admin se employee action perform na karein jab SoD demonstrate karna ho.
- Same invoice number dobara use karke duplicate protection dikhayein.
- Settled/paid records delete karne ka promise na karein; cancel/archive semantics explain karein.
- Exact record URLs note karein: `/app/cards/:id`, `/app/spend/requests/:id`, `/app/bill-pay/bills/:id`, `/app/procurement/match-exceptions?match=:id`, `/app/travel/trips/:id`.

