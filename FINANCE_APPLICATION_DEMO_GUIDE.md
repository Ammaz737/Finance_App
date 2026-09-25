# Finance Application — Complete Demo & Operating Guide

Yeh guide current implemented application ko demo karne aur operate karne ke liye hai. Is mein active P0/P0.5 workflows cover kiye gaye hain. Local development mein cards, bank payouts, travel bookings aur ERP sync **sandbox/mock** hain; real paisa ya real booking process nahi hoti.

User-to-user handoff aur har persona ki daily responsibilities ke liye `USER_WISE_APPLICATION_OPERATING_GUIDE.md` follow karein.

## 1. Application access

- Web application: `http://localhost:3002`
- Login page: `http://localhost:3002/login`
- Workspace: `acme`
- Default password: `password123`

Default environment mein web kabhi port `3000` par bhi start ho sakta hai. Terminal mein Next.js ka printed URL final hota hai. Current tested instance port `3002` par hai.

### Demo users

| User | Role / best use | Email | Password |
|---|---|---|---|
| Ava Admin | Owner, full access, final finance approval/release | `admin@acme.test` | `password123` |
| Miles Manager | Direct-report approvals | `manager@acme.test` | `password123` |
| Elena Employee | Requests, expenses, reimbursements, travel | `employee@acme.test` | `password123` |
| Tessa Treasury | Bills, payments and finance operations | `treasury@acme.test` | `password123` |
| Aiden Payable | AP approval | `ap@acme.test` | `password123` |

### Important role rule

Application separation of duties enforce karti hai:

- Request banane wala apni request approve nahi kar sakta.
- Payment schedule karne wala wohi payment release nahi kar sakta.
- Vendor bank details change karne wala wohi change verify nahi kar sakta.
- Multi-step approval mein har required step complete hona chahiye.

Demo ke waqt account switch karne ke liye top-right se **Sign out** karein aur required user se dobara login karein.

## 2. Seeded demo data

Fresh seed mein aam tor par yeh records milte hain:

| Data | Seeded value |
|---|---|
| Organization | Acme Manufacturing |
| Workspace slug | `acme` |
| Legal entities | Acme US LLC / USD, Acme UK Ltd / GBP |
| Department | Engineering |
| Location | Austin |
| Budget | Engineering 2026 — USD 100,000 |
| Spend program | Software tools — maximum USD 5,000 |
| Procurement program | Software intake |
| Vendor | OpenAI — category SaaS |
| Employee fund | Elena software fund — USD 2,500 |
| Seed card | Virtual card ending `4242`, merchant lock `OpenAI` |
| Bank accounts | Operating `1111`, Payroll `2222` |
| Draft bill | INV-10034 — USD 4,500 |
| Draft procurement request | Datadog expansion — USD 18,000 |
| Draft trip | NYC customer visit — USD 1,200 |

Automated testing ke baad local database mein extra demo records ho sakte hain. Naya record banate waqt unique suffix use karein, jaise `Demo 2026-09-22 01`, taa-ke search asaan ho.

## 3. Common interface ka use

### Navigation

Left sidebar modules ko sections mein divide karti hai: Workspace, My work, Spend, Expenses, Procurement, Vendors & Bill Pay, Accounting, Insights, Travel aur Company. User ko sirf woh pages nazar aate hain jin ki permission us role ke paas ho.

### List pages

Zyada tar list pages par yeh controls common hain:

- **Search:** record ke name, status ya visible text se filter karta hai.
- **Status filter:** jab multiple statuses available hon to list narrow karta hai.
- **Saved view name + Save view:** current status filter ko reusable view banata hai.
- **Record count:** current filtered records ki tadaad.
- **Row click:** detail page ya right-side detail drawer kholta hai.
- **Primary button:** naya record/form kholta hai, agar user ke paas permission ho.

### Generic form rules

- `*` wala field required hai.
- Amount fields mein zero se bari numeric value dein, jaise `250.00`.
- Currency ISO-3 code hota hai: `USD`, `GBP`.
- Country ISO-2 code hota hai: `US`, `GB`, `PK`.
- Legal entity select karne ke baad currency auto-change ho sakti hai.
- Vendor/program dropdown selected entity ke mutabiq filter hota hai.
- Date browser date picker se select karein.
- Success message ke baad drawer close aur list refresh hoti hai.

## 4. Recommended end-to-end demo order

Sab se coherent demo is order mein chalega:

1. Admin se company setup aur seeded data dikhayein.
2. Employee se spend request banayein.
3. Manager aur Admin se two-step approval karein.
4. Issued virtual card par sandbox authorization aur capture karein.
5. Generated expense complete aur approve karein.
6. Procurement request approve karke PO banayein, receiving aur matching dikhayein.
7. Vendor/bill/payment workflow complete karein.
8. Reimbursement payout complete karein.
9. Travel quote, approval aur sandbox booking dikhayein.
10. Accounting queue mein coding, ready aur sync complete karein.
11. Insights, notifications, audit log aur search dikhayein.

---

## 5. Workspace pages

### 5.1 Overview

Path: **Workspace → Overview**

Yahan application-wide KPIs aur operational queues ka summary milta hai. Demo mein pending approvals, payables, spend, accounting aur travel cards explain karein. Kisi KPI ke link par click karke related queue kholi ja sakti hai.

### 5.2 Inbox

Path: **Workspace → Inbox**

Inbox user-specific work queue hai. Filters:

- All
- Approval
- Payment release
- Accounting exception

Operating steps:

1. Required approver account se login karein.
2. Inbox kholein.
3. Task row click karein.
4. Drawer mein requester, amount, legal entity, policy aur approval step check karein.
5. **Approve** click karein; approval ke liye comment optional hai.
6. **Request info** ya **Reject** ke liye comment required hai.
7. Payment task ho to **Release payment** use karein.
8. **View source record** se original request khol sakte hain.

### 5.3 Global Search

Path: **Workspace → Search**

Example searches:

- `OpenAI`
- `INV-10034`
- `Elena`
- `NYC`
- Apni unique demo request ka naam

Search vendors, people, bills, expenses, POs, travel aur requests mein permission-scoped result deta hai.

### 5.4 Notifications

Path: **Insights → Notifications**

- **Open** related record par le jata hai.
- **Mark read** single notification read karta hai.
- **Mark all read** tamam unread notifications clear karta hai.

---

## 6. Spend request → card → expense complete demo

### 6.1 Employee spend request create kare

Login: `employee@acme.test`

Path: **My work → My requests → New spend request**

Recommended form values:

| Field | Sample value | Note |
|---|---|---|
| What are you purchasing? | `Demo OpenAI subscription 01` | Required, unique rakhein |
| Business purpose | `Engineering AI productivity tools` | Clear business reason |
| Amount | `120.00` | Required; program maximum se kam |
| Currency | `USD` | Entity select karne par auto-set ho sakti hai |
| Legal entity | `Acme US LLC` | Required |
| Spend program | `Software tools` | Required; entity ke baad select karein |
| Vendor | `OpenAI` | Optional, demo mein select karein |
| Category | `Software` | Recommended |
| Fulfillment | `Virtual card` | Card issue hoga |
| Recurrence | `Monthly` | One-time bhi select kar sakte hain |
| Expiration | Future date | Optional |
| Comments | `Demo request for finance walkthrough` | Optional |

**Create** ke baad request detail kholein. Expected initial status `IN_REVIEW` ya `SUBMITTED` hoga. Policy aur approval progress panels dikhayein.

### 6.2 Two-step approval

Seeded workflow: Manager → Finance.

1. Sign out; `manager@acme.test` se login karein.
2. **Inbox** mein request select karke **Approve** karein.
3. Sign out; `admin@acme.test` se login karein.
4. **Inbox** mein next finance step **Approve** karein.
5. Request detail par final status `FULFILLED` hona chahiye.
6. Fulfillment panel mein fund aur virtual card links nazar aayenge.

### 6.3 Virtual card controls

Login: Admin

Request ke card link ya **Spend → Cards** se card detail kholein.

Recommended controls:

| Field | Sample | Meaning |
|---|---|---|
| Merchant lock | `OpenAI` | Sirf exact merchant allow hoga |
| Allowed MCCs | `software,office` | Comma-separated merchant categories |
| Per-transaction limit | `100.00` | Single transaction cap |
| Velocity max amount | `300.00` | Window ke andar total cap |
| Velocity max count | `5` | Window ke andar transaction count |
| Velocity window | `24` | Hours |

**Save controls** click karein.

Card actions:

- **Freeze:** temporary transactions block; confirmation dialog aata hai.
- **Unfreeze:** card dobara active karta hai.
- **Terminate:** permanent action; normal demo mein avoid karein.

### 6.4 Sandbox card authorization

Card detail ke **Sandbox authorize** form mein:

| Field | Value |
|---|---|
| Amount | `25.00` |
| Merchant | `OpenAI` |
| Merchant category | `software` |

**Authorize** click karein. Controls match hon to decision approved aur transaction `PENDING` hogi. Transactions section mein **Capture** click karein; status `CLEARED` ho jayega.

Negative demo options:

- Merchant lock ke against `Different Vendor` dalne par decline.
- Per-transaction limit se zyada amount par decline.
- Card freeze karke authorize karne par `CARD_FROZEN` decline.
- Disallowed category par MCC decline.

### 6.5 Generated expense complete karein

Capture ke baad expense generate hota hai.

Login: Employee ya Admin

Path: **My work → My expenses**, latest incomplete expense kholein.

1. **Business purpose / memo:** `OpenAI subscription for engineering team`.
2. **Save memo**.
3. Agar Requirements mein receipt missing ho to PDF/PNG/JPG select karein.
4. **Upload & link** click karein.
5. Optional split:
   - Amount: `15.00`
   - Category: `Software`
   - Department: `Engineering`
   - Remaining splits mil kar expense total ke barabar hone chahiye.
6. Requirements complete hone par **Submit expense**.
7. Manager account se Inbox ya **Expense review** mein **Approve**.

Receipt threshold policy seeded environment mein `75` hai. Choti expense par receipt optional ho sakta hai; policy result UI mein check karein.

---

## 7. Reimbursements

### 7.1 Standard reimbursement

Login: Employee

Path: **My work → My reimbursements → New reimbursement**

UI-only smooth demo ke liye amount `75` se kam rakhein:

| Field | Sample value |
|---|---|
| Legal entity | Acme US LLC |
| Type | Standard |
| Amount | `40.00` |
| Currency | `USD` |
| Business purpose | `Client coffee meeting` |
| Merchant | `Demo Cafe 01` |
| Category | `Meals` |
| Expense date | A recent date |
| Destination | Blank |
| Distance | Blank |
| Per-diem days | Blank |
| Eligible days | Blank |

Create ke baad detail kholein aur **Submit** karein. Manager se **Approve**, phir Admin se **Schedule payout**, phir sandbox mein **Confirm payout** karein. Final status `PAID` aur accounting entry create honi chahiye.

### 7.2 Mileage reimbursement

| Field | Sample value |
|---|---|
| Type | Mileage |
| Distance (miles) | `100` |
| Amount | Blank chhor dein |
| Business purpose | `Customer-site mileage` |
| Currency | USD |

Amount server calculate karta hai; current seeded rate ke mutabiq 100 miles ka test amount USD `67.00` hota hai. User-supplied Amount ko authoritative na samjhein.

### 7.3 Per diem reimbursement

| Field | Sample value |
|---|---|
| Type | Per diem |
| Destination | `Chicago` |
| Per-diem days | `2` |
| Amount | Blank chhor dein |
| Business purpose | `Conference meals and incidentals` |

Amount server calculate karta hai; current demo rules mein 2 days ka tested total USD `150.00` hai.

### Reimbursement lifecycle

`DRAFT → IN_REVIEW → APPROVED → SCHEDULED → PAID`

- Duplicate merchant/date/amount records block ho sakte hain.
- Employee apna reimbursement approve ya pay nahi kar sakta.
- Accounting entry payout confirm hone ke baad banti hai.

---

## 8. Procurement → Purchase Order → Receiving → Match

### 8.1 Procurement program create karna

Login: Admin

Path: **Procurement → Programs → New intake program**

| Field | Sample |
|---|---|
| Program name | `IT equipment intake` |
| Default outcome | Purchase order |

Possible outcomes: Purchase order, Virtual card, Vendor setup.

### 8.2 Procurement request

Login: Employee

Path: **Procurement → Requests → New procurement request**

| Field | Sample value |
|---|---|
| Request name | `Demo laptops 01` |
| Legal entity | Acme US LLC |
| Procurement program | Software intake or IT equipment intake |
| Amount | `1000.00` |
| Currency | USD |
| Outcome | Purchase order |
| Vendor | OpenAI or another active US vendor |
| Memo | `Engineering equipment procurement` |

Create se request `DRAFT` hoti hai. Detail page par **Submit** karein; status `IN_REVIEW` hoga.

Approval sequence:

1. Manager Inbox → Approve.
2. Admin Inbox → Approve.
3. Final status `FULFILLED`.
4. Purchase order automatically create hota hai; **Open PO** click karein.

### 8.3 Receiving

PO detail par **Receiving** section:

- Partial receive example: Amount `400.00` → **Record receipt**.
- Final receive example: Amount `600.00` → **Record receipt**.
- Received total PO amount se zyada nahi hona chahiye.

Alternative page: **Procurement → Receiving → Record receipt**

| Field | Value |
|---|---|
| Purchase order | Open/partially received PO |
| Amount | Remaining amount |
| Memo | `Final delivery received` |

### 8.4 Bill matching

PO match ke liye pehle bill banate waqt us PO ko link karna backend-supported flow hai. Linked bill PO detail ke Bills section mein nazar aata hai. Bill select karke **Run 2/3-way match** click karein.

- Received amount bill ke barabar ho: `MATCHED` / three-way match.
- Bill quantity/amount receiving se zyada ho: `EXCEPTION`.

### 8.5 Match exception resolve karna

Path: **Procurement → Match Exceptions**

1. Exception select karein.
2. Optional Comment likhein.
3. Situation ke mutabiq action:
   - Approve override
   - Request receiving update
   - Request corrected invoice
   - Mark corrected
   - Resolve
   - Comment — comment required
   - Reject

---

## 9. Vendors

### 9.1 Vendor create

Login: Admin ya Finance Admin

Path: **Vendors & Bill Pay → Vendors → Add vendor**

| Field | Sample |
|---|---|
| Vendor name | `Demo Cloud Vendor 01` |
| Category | `SaaS` |
| Legal entity | Acme US LLC |
| Risk | Low |
| Notes | `Demo vendor for bill-pay walkthrough` |

Vendor row click karke detail kholein. Overview mein name, legal name, display name, category, risk aur notes edit kiye ja sakte hain.

### 9.2 Vendor bank details

Vendor detail → **Banking / payment details**:

| Field | Sample |
|---|---|
| Last 4 | `6789` |
| Routing (masked) | `*****021` |
| Change reason | `Initial demo payment setup` |

**Update bank details** ke baad status pending verification hoga. Doosre authorized user se login karke same vendor kholein aur **Verify** karein. Changer khud verify nahi kar sakta.

Vendor detail mein related bills, payments, POs aur activity bhi nazar aati hai.

---

## 10. Bill Pay complete workflow

### 10.1 Bill create

Login: `treasury@acme.test` ya Admin

Path: **Vendors & Bill Pay → Bills → Create bill**

Header fields:

| Field | Sample value |
|---|---|
| Legal entity | Acme US LLC |
| Vendor | OpenAI / verified demo vendor |
| Invoice number | `DEMO-INV-001` — unique hona chahiye |
| Invoice date | Current/recent date |
| Due date | Future date |
| Currency | Entity se auto-set |
| Memo | `Monthly software invoice` |
| Invoice document | Optional PDF/PNG/JPEG |

Line item:

| Field | Sample value |
|---|---|
| Description | `Software subscription` |
| Quantity | `1` |
| Unit price | `125.00` |
| Tax | `0.00` |
| Category | `Software` |
| GL account | `6100` |
| Department | `Engineering` |
| Location | `Austin` |
| Project / job | `AI Enablement` |

- Multiple lines ke liye **Add line**.
- Total UI calculate karti hai aur server dobara validate karta hai.
- **Save as draft** checked rakhein taa-ke corrections demonstrate ho saken.
- **Create bill** click karein.

### 10.2 Draft correction aur submit

Bill detail par draft invoice number, dates, memo aur lines edit ki ja sakti hain. **Save draft corrections** ke baad **Submit for approval** karein.

Bill stages:

- Drafts
- For approval
- For payment
- History
- Urgent — due within seven days

### 10.3 Bill approval

Seeded workflow: AP → Finance.

1. `ap@acme.test` login → Inbox → Approve.
2. `admin@acme.test` login → Inbox → Approve.
3. Bill status `APPROVED` aur ready for payment.

Bill creator apna bill approve nahi kar sakta. Bill approval payment release nahi hai.

### 10.4 Payment schedule

Approved bill detail par:

- Full payment: Partial amount blank chhor dein.
- Partial payment: `80.00` jaisi amount enter karein.
- **Schedule payment** click karein.

Payment status `SCHEDULED` hoga. Agar partial settlement hai to bill baad mein `PARTIAL` aur remaining amount show karega.

Alternative: **Payments → Schedule payment**

| Field | Value |
|---|---|
| Approved bill | Approved/partial bill |
| Amount | Remaining se kam ya barabar |
| Payment method | ACH, Wire, ya Check |

### 10.5 Payment release and settlement

Payment schedule karne wale se different authorized user use karein—recommended Admin.

1. **Payments** ya Bill detail par scheduled payment kholein.
2. **Release payment** → status `PROCESSING`/`SENT`.
3. Sandbox mein **Confirm settlement** → status `SETTLED`.
4. Full amount settle hone par bill `PAID`.
5. Partial amount settle hone par bill `PARTIAL`; remaining amount ke liye second payment schedule karein.

### 10.6 Payment runs

Path: **Vendors & Bill Pay → Payment runs → New payment run**

| Field | Sample |
|---|---|
| Run name | `Weekly AP run 01` |
| Legal entity | Acme US LLC |
| Source account | Operating |

Run detail par eligible scheduled payments check karein, **Add selected payments**, phir different authorized user se **Release run**. Validation issues hon to release button disabled rahega.

---

## 11. Accounting

### 11.1 Queue lifecycle

Path: **Accounting → Overview**

Lifecycle:

`NEEDS_REVIEW → READY_TO_SYNC → SYNCING → SYNCED`

Sources:

- Card transactions
- Reimbursements
- Bills
- Payments

### 11.2 Coding an entry

Path: **Accounting → Needs review**

Entry row click karein. Accounting form mein:

| Field | Sample |
|---|---|
| Category | `Software` |
| Memo | `Demo accounting classification` |
| GL account | `6100` |
| Department | `Engineering` |

Pehle coding save karein, phir **Mark ready**. **Ready to sync** page par **Sync** ya Overview se **Sync all ready**. Local demo mock ERP use karta hai.

Error entry ko **Sync errors** page par **Retry** ya **Mark ready** kiya ja sakta hai. Ready entry ko **Undo ready** bhi kiya ja sakta hai.

### 11.3 Accounting rule

Path: **Accounting → Rules → New rule**

| Field | Sample |
|---|---|
| Rule name | `OpenAI software coding` |
| Source type | Card |
| Memo contains | `OpenAI` |
| Set category | `Software` |
| GL account | `6100` |
| Department | `Engineering` |
| Priority | `10` |

Lower priority number pehle apply hota hai.

### 11.4 Accounting dimensions

Path: **Company → Accounting dimensions**

Example:

| Field | Value |
|---|---|
| Key | `cost_center` |
| Label | `Cost Centers` |
| Values | Neeche wala multiline format |

```text
ENG|Engineering
FIN|Finance
SALES|Sales
```

Har line ka format `code|label` hai.

### 11.5 Integrations

- **Accounting → Integrations:** configured provider records.
- **Company → Integrations:** health, cursor, last sync aur **Sandbox ping**.
- Real provider sync current local demo ka hissa nahi; mock integration expected hai.

---

## 12. Travel

### 12.1 Trip create

Login: Employee

Path: **My work → My travel → New trip**

| Field | Sample |
|---|---|
| Trip name | `Chicago customer workshop 01` |
| Legal entity | Acme US LLC |
| Destination | `Chicago` |
| Purpose | `Customer workshop` |
| Start date | Future date, e.g. `2026-11-10` |
| End date | Start ke baad, e.g. `2026-11-12` |
| Estimated cost | `900.00` |
| Currency | USD |

### 12.2 Quote and booking

Trip detail par:

1. Search type: Flights, Hotels, ya Cars.
2. **Search quotes**.
3. In-policy quote select karein.
4. **Submit**.
5. In-policy trip direct `READY_TO_BOOK` ho sakti hai.
6. Out-of-policy trip `PENDING_APPROVAL` jayegi; Manager phir Admin approvals complete karein.
7. **Reprice**.
8. **Place mock hold** — real booking nahi.
9. **Confirm (sandbox)** — trip confirmed aur travel fund/card provision ho sakte hain.

Other actions:

- **Provision fund/card:** approved/bookable trip ke liye.
- **Cancel:** booked/confirmed booking cancel.
- **Record refund:** refundable cancelled booking ka sandbox refund.
- Fund ID / Expense ID fields advanced manual linking ke liye hain; normal demo mein automatic provisioning use karein.

Out-of-policy quote approval ke baghair book nahi hoti. Reprice tolerance se zyada price change booking ko block karke `REPRICE_REQUIRED` state de sakta hai.

---

## 13. Budgets and Spend Programs

### 13.1 Budget

Path: **Insights → Budgets → New budget**

| Field | Sample |
|---|---|
| Budget name | `Engineering Demo 2026` |
| Legal entity | Acme US LLC |
| Amount | `25000.00` |
| Currency | USD |
| Period | Annual |

Budget detail actual, committed, remaining aur utilization show karta hai. Linked spend programs bhi dikhte hain. Actual aur committed double-count nahi hone chahiye.

### 13.2 Spend program

Path: **Spend → Spend programs → New spend program**

| Field | Sample |
|---|---|
| Program name | `Demo SaaS purchases` |
| Legal entity | Acme US LLC |
| Maximum request amount | `1000.00` |
| Currency | USD |
| Budget | Engineering Demo 2026 |
| Default fulfillment | Virtual card |
| Default merchant lock | `OpenAI` |
| Default allowed MCCs | `software` |
| Default per-transaction limit | `250.00` |
| Default velocity max amount | `500.00` |
| Default velocity max count | `5` |
| Default validity (days) | `30` |

Program detail par controls edit ya program deactivate kiya ja sakta hai. Deactivation destructive history delete nahi karti, lekin new requests mein program unavailable ho sakta hai.

---

## 14. Company administration

### 14.1 Company settings

Path: **Company → Settings**

Owner organization name update kar sakta hai. Demo environment ka naam unnecessarily change na karein jab tak branding demo required na ho.

### 14.2 Legal entity

Path: **Company → Entities → Add entity**

| Field | Sample |
|---|---|
| Legal name | `Demo Pakistan Pvt Ltd` |
| Country code | `PK` |
| Currency code | `PKR` |

Country 2 letters aur currency 3 letters mein enter karein. Existing entity edit/archive actions Owner ke liye hain.

### 14.3 Department

Path: **Company → Departments → Add department**

- Department name: `Finance Operations`
- Existing row par Edit ya Archive available hai.

### 14.4 Location

Path: **Company → Locations → Add location**

- Location name: `Karachi`
- Existing row par Edit ya Archive available hai.

### 14.5 Invite a person

Path: **Company → People → Invite person**

| Field | Sample |
|---|---|
| First name | `Demo` |
| Last name | `User` |
| Work email | Unique email, e.g. `demo.user.01@acme.test` |
| Role | Employee |
| Manager | `manager@acme.test` |

Create ke baad sandbox activation link show hota hai:

1. **Open activation** ya **Copy activation link**.
2. Workspace/email prefilled honge.
3. Minimum 12-character password set karein, example `DemoPassword123!`.
4. Confirm password same rakhein.
5. **Activate account**, phir login.

Person detail par manager, department, location, legal entity, role aur role entity scope manage kiye ja sakte hain. Account actions: Suspend, Reset activation/credentials, Terminate.

### 14.6 Roles

Path: **Company → Roles**

Role row click karne se permissions aur scope read-only view milta hai. Current UI existing roles ko People page se assign/remove karti hai; advanced custom-role authoring current active scope mein nahi.

### 14.7 Policy builder

Path: **Company → Policies**

Example expense policy:

| Field | Sample |
|---|---|
| Policy name | `Demo high-value receipt policy` |
| Object type | expense |
| Priority | `50` |
| Effective date | Today/future date |
| Enabled | Checked |
| Rule | receipt_required |
| Amount threshold | `75` |
| Category | Blank |
| Action | REVIEW or BLOCK |

Available object types: expense, reimbursement, spend request, procurement, bill, travel.

Available rule types include receipt required, memo required, vendor required, quote required, high value, category amount, manager approval, hard policy block, travel maximum amount aur travel out of policy.

- **Add rule:** ek policy mein extra condition.
- **Simulate:** fixed sample input par expected result preview.
- **Save policy:** new policy.
- **Edit / version:** old record overwrite nahi hota; new version banti hai.
- **Disable:** future evaluations se policy remove hoti hai.

### 14.8 Approval workflow builder

Path: **Company → Approval rules**

Example:

| Field | Sample |
|---|---|
| Workflow name | `Demo spend approval` |
| Object type | spend_request |
| Enable after save | Checked |
| Step 1 approver | manager |
| Step 1 mode | Serial |
| Minimum amount | Blank |
| Maximum amount | `5000` |
| Step 2 approver | finance |
| Step 2 mode | Serial |

Approver types: manager, budget, finance, AP, controller, department head, legal, CFO, entity.

Parallel steps ke liye mode **Parallel** aur same **Parallel group** value dein. **Preview / simulate** se applicable steps aur self-approval/separation-of-duties checks dikhte hain. Edit new version create karta hai; workflow enable/disable bhi ho sakta hai.

### 14.9 Audit log

Path: **Company → Audit log**

Material actions chronological order mein actor, action, object type aur object ID ke sath show hoti hain. Spend approval, card, bill, payment, reimbursement aur configuration changes verify karne ke liye use karein.

---

## 15. Password reset and security

### Forgot password

Login page → **Forgot password?**

1. Workspace: `acme`.
2. Email enter karein.
3. **Send reset link**.
4. Local sandbox mein email ke bajaye reset link screen par milta hai.
5. Link open karein.
6. Minimum 12-character new password aur confirmation enter karein.
7. Reset links single-use hain aur seven days mein expire hotay hain.

### Logged-in password change

Security page agar direct accessible ho to current password, minimum 12-character new password aur confirmation enter karein. Password change ke baad other sessions sign out ho jati hain.

---

## 16. Status glossary

| Status | Meaning |
|---|---|
| DRAFT | Record bana hai, submit nahi hua |
| INCOMPLETE | Required receipt/memo/coding missing |
| SUBMITTED / IN_REVIEW | Approval queue mein hai |
| PENDING_APPROVAL | Approver action pending |
| APPROVED | Business approval complete; payment/release separate ho sakta hai |
| FULFILLED | Request ka fund/card/PO outcome create ho gaya |
| ACTIVE | Usable card/program/vendor |
| FROZEN | Card temporarily blocked |
| TERMINATED | Permanently closed |
| PENDING | Card hold/authorization transaction |
| CLEARED | Card transaction captured |
| SCHEDULED | Payment/payout created, release pending |
| PROCESSING / SENT | Released to mock provider, settlement pending |
| SETTLED / PAID | Final sandbox settlement recorded |
| PARTIAL | Kuch amount paid/received, balance baqi |
| NEEDS_REVIEW | Accounting coding/review required |
| READY_TO_SYNC | ERP sync ke liye approved |
| SYNCED | Mock ERP acknowledgement complete |
| SYNC_ERROR | Sync failed; retry required |
| EXCEPTION | Procurement match discrepancy |
| PASS / WARN / REVIEW / BLOCK | Policy evaluation result |

## 17. Demo safety and common mistakes

- `OpenAI` merchant-lock card par merchant exactly `OpenAI` enter karein.
- Spend/procurement program selected legal entity se compatible hona chahiye.
- Invoice number duplicate nahi ho sakta; har demo mein unique number use karein.
- Creator se approval/release attempt 403 ya disabled action de sakta hai—yeh expected control hai.
- Reject aur Request info ke liye comment required hai.
- Amount fields positive hon; commas ki jagah plain numeric value use karein, e.g. `1250.00`.
- Receipt files PDF, PNG, JPG/JPEG hon.
- Bill line description, quantity aur unit price required hain.
- Expense splits ka eventual total expense amount ke barabar hona chahiye.
- PO receiving total PO commitment se zyada na karein.
- Payment amount remaining bill amount se zyada na karein.
- Travel start date end date se pehle ho aur preferably future mein ho.
- Sandbox labels ka matlab real card, payout, booking ya ERP posting nahi hui.
- Terminate, archive, deactivate, cancel aur freeze actions confirmation mang sakte hain; demo data preserve karna ho to avoid karein.

## 18. Short 15-minute presentation script

1. Admin login karke Overview, Company setup aur Audit log dikhayein.
2. Employee login karke USD 120 OpenAI spend request create karein.
3. Manager Inbox se first approval.
4. Admin Inbox se final approval; issued card open karein.
5. USD 25 OpenAI/software authorization aur Capture.
6. Expense memo complete karke Manager se approve.
7. Treasury se USD 125 bill create/submit.
8. AP then Admin approvals.
9. Treasury payment schedule; Admin release and confirm settlement.
10. Accounting Needs review se category/GL code, Mark ready, Sync.
11. Search mein invoice/request dhoondein; Audit log mein events dikhayein.

## 19. Full demo completion checklist

- [ ] Login and role switching shown
- [ ] Overview KPIs shown
- [ ] Inbox approve/reject/request-info behavior explained
- [ ] Spend request created and two-step approved
- [ ] Fund/card fulfillment shown
- [ ] Sandbox authorization and capture completed
- [ ] Expense requirements, receipt/memo and approval shown
- [ ] Standard/mileage/per-diem reimbursement explained
- [ ] Procurement request, PO and receiving shown
- [ ] Match or match exception shown
- [ ] Vendor and bank verification shown
- [ ] Bill created with line coding
- [ ] Bill AP + Finance approvals completed
- [ ] Payment scheduled by one user and released by another
- [ ] Settlement and bill paid/partial state shown
- [ ] Travel quote, approval and mock booking shown
- [ ] Accounting coding and mock sync shown
- [ ] Budgets and spend programs shown
- [ ] People invite/activation and role assignment shown
- [ ] Policy and approval workflow simulation shown
- [ ] Search, notifications, integrations and audit log shown

## 20. Currently non-primary / feature-flagged areas

Disputes, tax, receivables, banking/treasury extensions, contracts, sourcing, renewals, price/license intelligence, savings/reports, AI tools, developer platform, rewards, traveler management aur travel policy jaise P1/P2 surfaces feature flags ke peeche ya scaffold stage mein ho sakte hain. Main demo active navigation aur upar documented workflows par rakhein.
