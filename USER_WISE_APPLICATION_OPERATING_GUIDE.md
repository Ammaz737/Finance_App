# Finance Application — User-wise Operating Guide

Yeh guide application ko **user ke role ke hisaab se** operate karne ke liye hai. Is ka purpose yeh clear karna hai ke:

- Kaunsa user kya kaam karega.
- Us user ko kaun se pages use karne hain.
- Form mein kya data dalna hai.
- Kaam complete karne ke baad record kis user ke paas jayega.
- Agla user us record par kya action karega.

Application URL: `http://localhost:3002`

Har login par:

- Workspace: `acme`
- Password: `password123`

## 1. Users aur unki responsibilities

| User | Email | Main responsibility |
|---|---|---|
| Elena Employee | `employee@acme.test` | Apni spend requests, expenses, reimbursements, procurement aur travel requests create karna |
| Miles Manager | `manager@acme.test` | Employee ki requests review aur first-level approval karna |
| Aiden Payable | `ap@acme.test` | Vendor invoices aur bills ki AP review/approval karna |
| Tessa Treasury | `treasury@acme.test` | Bills create karna, payments schedule karna, payment runs aur accounting operations |
| Ava Admin | `admin@acme.test` | Final finance approval, payment release, configuration, company administration aur audit |

## 2. Sab se important operating rule

Ek hi user se complete workflow chalane ki koshish na karein.

Correct business flow:

```text
Employee creates request
        ↓
Manager reviews/approves
        ↓
Finance/Admin gives final approval
        ↓
Treasury schedules payment or system issues card
        ↓
Different Finance/Admin user releases payment
        ↓
Accounting reviews and syncs
```

Application creator ko apna record approve/release karne se rok sakti hai. Yeh error nahi, financial control hai.

---

# USER 1 — Elena Employee

Login:

- Email: `employee@acme.test`
- Password: `password123`
- Workspace: `acme`

## 3. Employee ko application mein kya nazar aayega

Employee ka main section **My work** hai:

- My cards
- My expenses
- My requests
- My reimbursements
- My travel

Employee Procurement Requests page bhi use kar sakta hai.

Employee ka kaam:

1. Company spend ke liye pehle request banana.
2. Apni issued cards aur funds dekhna.
3. Card transaction ke baad expense complete karna.
4. Personal/out-of-pocket expense ka reimbursement banana.
5. Procurement request create aur submit karna.
6. Business travel request aur quote create karna.
7. Apni requests ka status check karna.

Employee yeh kaam nahi karega:

- Apni request approve nahi karega.
- Payment release nahi karega.
- Company policy/configuration edit nahi karega.
- Final accounting sync nahi karega.

## 4. Employee task: Spend request banana

Menu:

**My work → My requests → New spend request**

Demo values:

| Field | Value |
|---|---|
| What are you purchasing? | `OpenAI team subscription DEMO-01` |
| Business purpose | `Engineering team AI productivity` |
| Amount | `120.00` |
| Currency | `USD` |
| Legal entity | `Acme US LLC` |
| Spend program | `Software tools` |
| Vendor | `OpenAI` |
| Category | `Software` |
| Fulfillment | `Virtual card` |
| Recurrence | `Monthly` |
| Expiration | Koi future date |
| Comments | `Demo spend request` |

Operating steps:

1. Pehle **Legal entity** select karein.
2. Us ke baad **Spend program** select karein.
3. Vendor select karein.
4. Amount program maximum se kam rakhein.
5. Create button click karein.
6. Request detail khol kar Policy aur Approval progress check karein.

Expected status:

- `IN_REVIEW` ya `SUBMITTED`.

Agla user:

- **Miles Manager** first approval karega.
- Us ke baad **Ava Admin** ya authorized Finance user final approval karega.

## 5. Employee task: Apne cards dekhna

Menu:

**My work → My cards**

Employee yahan:

- Card ke last four digits dekh sakta hai.
- Card status `ACTIVE`, `FROZEN` ya `TERMINATED` dekh sakta hai.
- Linked fund aur available amount dekh sakta hai.
- Card transactions inspect kar sakta hai.

Employee normally card controls change nahi karega. Card freeze/control finance/admin user handle karega.

## 6. Employee task: Expense complete karna

Card transaction capture hone ke baad expense create hota hai.

Menu:

**My work → My expenses**

Latest `INCOMPLETE` expense open karein.

Data:

| Field | Value |
|---|---|
| Business purpose / memo | `OpenAI subscription for engineering team` |
| Receipt file | PDF, PNG, JPG ya JPEG |
| Split amount | Optional, jaise `120.00` |
| Split category | `Software` |
| Split department | `Engineering` |

Operating steps:

1. Requirements panel check karein.
2. Memo missing ho to enter karke **Save memo**.
3. Receipt required/missing ho to file choose karein.
4. **Upload & link** click karein.
5. Zaroorat ho to category/department split add karein.
6. Splits ka total expense amount ke barabar hona chahiye.
7. Requirements complete hon to **Submit expense**.

Expected status:

- `SUBMITTED` ya `IN_REVIEW`.

Agla user:

- **Miles Manager** expense approve karega.
- Approval ke baad **Tessa Treasury** ya **Ava Admin** accounting queue handle karega.

## 7. Employee task: Standard reimbursement

Use case: Employee ne apne paison se company expense pay kiya.

Menu:

**My work → My reimbursements → New reimbursement**

Smooth UI demo ke liye USD 75 se kam amount use karein:

| Field | Value |
|---|---|
| Legal entity | `Acme US LLC` |
| Type | `Standard` |
| Amount | `40.00` |
| Currency | `USD` |
| Business purpose | `Client coffee meeting` |
| Merchant | `Demo Cafe 01` |
| Category | `Meals` |
| Expense date | Recent date |
| Destination | Blank |
| Distance | Blank |
| Per-diem days | Blank |
| Eligible days | Blank |

Create ke baad reimbursement detail open karke **Submit** karein.

Expected flow:

```text
Employee creates DRAFT
Employee submits
Manager approves
Admin/Treasury schedules payout
Different authorized user confirms sandbox payout
Accounting entry is created
```

## 8. Employee task: Mileage reimbursement

Menu wahi hai: **My reimbursements → New reimbursement**

| Field | Value |
|---|---|
| Legal entity | Acme US LLC |
| Type | Mileage |
| Currency | USD |
| Business purpose | `Customer-site mileage` |
| Distance | `100` miles |
| Amount | Blank rakhein |

System amount khud calculate karega. Current demo rate mein 100 miles ka tested amount USD `67.00` hai.

## 9. Employee task: Per diem reimbursement

| Field | Value |
|---|---|
| Legal entity | Acme US LLC |
| Type | Per diem |
| Currency | USD |
| Business purpose | `Conference meals and incidentals` |
| Destination | `Chicago` |
| Per-diem days | `2` |
| Amount | Blank rakhein |

System amount khud calculate karega. Current demo rules mein 2 days ka tested amount USD `150.00` hai.

## 10. Employee task: Procurement request

Use case: Aisi purchase jahan PO ya formal procurement process required ho.

Menu:

**Procurement → Requests → New procurement request**

| Field | Value |
|---|---|
| Request name | `Engineering laptops DEMO-01` |
| Legal entity | Acme US LLC |
| Procurement program | Software intake |
| Amount | `1000.00` |
| Currency | USD |
| Outcome | Purchase order |
| Vendor | Active vendor |
| Memo | `Laptops for engineering team` |

Operating steps:

1. Create request.
2. Request detail open karein.
3. Status `DRAFT` ho to **Submit** click karein.
4. Policy result aur approval progress check karein.

Agla user:

- Manager first approval.
- Admin/Finance final approval.
- Final approval ke baad Purchase Order automatically create hoga.

## 11. Employee task: Travel request

Menu:

**My work → My travel → New trip**

| Field | Value |
|---|---|
| Trip name | `Chicago customer workshop DEMO-01` |
| Legal entity | Acme US LLC |
| Destination | `Chicago` |
| Purpose | `Customer workshop` |
| Start date | Future date |
| End date | Start date ke baad |
| Estimated cost | `900.00` |
| Currency | USD |

Trip detail par:

1. Search type `Flights`, `Hotels` ya `Cars` select karein.
2. **Search quotes** click karein.
3. In-policy quote choose karke **Select**.
4. **Submit**.
5. Submit ke baad trip `PENDING_APPROVAL` hoti hai (manager → finance), chahe policy PASS ho.
6. Out-of-policy / high-value trips pe policy `REVIEW` dikhegi; phir bhi wahi approval chain.
7. Manager aur Finance approve ke baad trip `READY_TO_BOOK` hoti hai.
8. **Place mock hold**.
9. **Confirm (sandbox)**.

Expected result:

- Booking `CONFIRMED`.
- Travel fund/card provision ho sakta hai.
- Yeh real booking nahi; sandbox operation hai.

---

# USER 2 — Miles Manager

Login:

- Email: `manager@acme.test`
- Password: `password123`
- Workspace: `acme`

## 12. Manager ki responsibility

Manager ka primary workspace **Inbox** hai. Elena Manager ki direct report hai, is liye Elena ke applicable approval tasks Miles ko milte hain.

Manager approve karega:

- Spend requests ka manager step.
- Employee expenses.
- Reimbursements.
- Procurement requests ka manager step.
- Travel requests ka manager step (in-policy aur out-of-policy dono).

Manager ka daily operating pattern:

1. Login.
2. **Workspace → Inbox**.
3. `Approval` filter select karein.
4. Task row open karein.
5. Requester, amount, entity aur policy check karein.
6. Source record open karke details verify karein.
7. Approve, Request info ya Reject.

## 13. Manager task: Spend request review

Inbox mein Employee ki spend request open karein.

Check karein:

- Purchase name clear hai.
- Business purpose valid hai.
- Amount reasonable hai.
- Correct legal entity aur program hai.
- Vendor aur category match karte hain.
- Policy `PASS`, `WARN`, `REVIEW` ya `BLOCK` kya keh rahi hai.

Action:

- Valid ho: **Approve**.
- Missing information: Comment likh kar **Request info**.
- Invalid ho: Reason comment mein likh kar **Reject**.

Approve ke baad request next Finance/Admin step ko jayegi. Manager final card issue nahi karta.

## 14. Manager task: Expense review

Menu:

**Expenses → Expense review** ya **Inbox**

Check:

- Receipt required ho to attached hai.
- Receipt merchant/amount transaction se match karta hai.
- Business purpose meaningful hai.
- Category aur split correct hain.
- Policy warnings clear hain.

Valid ho to **Approve**. Approval ke baad accounting entry finance queue mein chali jayegi.

## 15. Manager task: Reimbursement review

Check:

- Standard expense ka merchant, date aur amount.
- Mileage mein distance reasonable hai.
- Per diem mein destination aur eligible days.
- Duplicate check `CLEAR` hai.
- Business purpose aur required evidence complete hai.

Action:

- **Approve** → status `APPROVED`.
- Manager payout schedule nahi karega; yeh Treasury/Admin ka task hai.

## 16. Manager task: Procurement review

Check:

- Vendor selected hai.
- Business purpose/memo complete hai.
- Amount request ke scope ke mutabiq hai.
- Outcome `PURCHASE_ORDER`, `VIRTUAL_CARD` ya `VENDOR_SETUP` theek hai.
- High-value request ke liye policy requirements clear hain.

Valid ho to **Approve**. Finance/Admin final step ke baad hi PO ya doosra outcome create hoga.

## 17. Manager task: Travel approval

Travel task normally out-of-policy quote par aata hai.

Check:

- Destination aur dates.
- Business purpose.
- Estimated amount.
- Selected supplier/quote.
- Out-of-policy reason.
- Refundability/cancellation terms.

Approve ke baad agar workflow mein finance step hai to request Admin ke Inbox mein jayegi. Final approval ke baghair booking hold/confirmation block reh sakti hai.

---

# USER 3 — Aiden Payable / AP

Login:

- Email: `ap@acme.test`
- Password: `password123`
- Workspace: `acme`

## 18. AP user ki responsibility

AP user ka main kaam:

- Vendor invoice review.
- Duplicate invoice check.
- Vendor match aur payment readiness check.
- Bill approval ka first AP step.
- Vendor details aur linked PO/match inspect karna.

Note: Seeded permissions mein Aiden Finance Admin role use karta hai, lekin demo persona ke taur par is account ko AP review ke liye use karein.

## 19. AP task: Bill review

Menu:

**Workspace → Inbox** ya **Vendors & Bill Pay → For approval**

Bill open karke check karein:

- Invoice number unique hai.
- Legal entity correct hai.
- Vendor active hai.
- Vendor match status acceptable hai.
- Duplicate status `CLEAR` hai.
- Invoice date aur due date valid hain.
- Line descriptions, quantity, unit price aur tax match karte hain.
- Category/GL/department coding reasonable hai.
- Invoice document safe/available hai.
- Linked PO ho to PO, receiving aur invoice amounts match karte hain.

Valid ho to **Approve bill**.

Expected result:

- AP approval record ho jayega.
- Bill next Finance/Admin approval ke paas jayega.
- AP approval ka matlab payment release nahi hai.

## 20. AP task: Vendor verification support

Menu:

**Vendors & Bill Pay → Vendors**

Vendor detail par:

- Legal/display name verify karein.
- Risk level check karein.
- Current bank last four digits check karein.
- Payment readiness status check karein.
- Bank change kisi doosre user ne kiya ho to authorized AP user **Verify** kar sakta hai.

Bank details change karne wala same user verification nahi karega.

## 21. AP task: Match exception review

Menu:

**Procurement → Match Exceptions**

Situation ke mutabiq:

- Goods receive ho chuke hain lekin system record missing: **Request receiving update**.
- Invoice galat hai: **Request corrected invoice**.
- Approved business exception hai: **Approve override**.
- Correction complete hai: **Mark corrected** ya **Resolve**.
- Sirf note add karna hai: Comment likh kar **Comment**.
- Invoice unacceptable hai: **Reject**.

---

# USER 4 — Tessa Treasury / Finance Operations

Login:

- Email: `treasury@acme.test`
- Password: `password123`
- Workspace: `acme`

## 22. Treasury user ki responsibility

Tessa ka main kaam:

- Vendors create/manage karna.
- Bills create aur submit karna.
- Approved bills ke payments schedule karna.
- Payment runs create karna.
- Accounting entries code/ready/sync karna.
- Bank/payment operational queues manage karna.

Important:

- Tessa agar payment schedule karti hai to wohi payment release na kare.
- Release ke liye Ava Admin use karein.

## 23. Treasury task: Vendor create karna

Menu:

**Vendors & Bill Pay → Vendors → Add vendor**

| Field | Value |
|---|---|
| Vendor name | `Demo Cloud Vendor 01` |
| Category | `SaaS` |
| Legal entity | Acme US LLC |
| Risk | Low |
| Notes | `Demo vendor for bill payment` |

Create ke baad vendor detail open karein.

Bank form:

| Field | Value |
|---|---|
| Last 4 | `6789` |
| Routing masked | `*****021` |
| Change reason | `Initial payment setup` |

**Update bank details** ke baad Aiden AP ya Ava Admin se verification karwayein.

## 24. Treasury task: Bill create karna

Menu:

**Vendors & Bill Pay → Bills → Create bill**

Header:

| Field | Value |
|---|---|
| Legal entity | Acme US LLC |
| Vendor | OpenAI ya verified demo vendor |
| Invoice number | `DEMO-INV-001` |
| Invoice date | Current/recent date |
| Due date | Future date |
| Currency | Auto-set USD |
| Memo | `Monthly software invoice` |
| Invoice document | Optional PDF/PNG/JPG |

Line:

| Field | Value |
|---|---|
| Description | `Software subscription` |
| Quantity | `1` |
| Unit price | `125.00` |
| Tax | `0.00` |
| Category | `Software` |
| GL account | `6100` |
| Department | `Engineering` |
| Location | `Austin` |
| Project/job | `AI Enablement` |

Operating steps:

1. **Save as draft** checked rakhein.
2. **Create bill**.
3. Detail page par data inspect/correct karein.
4. **Save draft corrections**, agar koi change ho.
5. **Submit for approval**.

Handoff:

- Aiden AP first approval.
- Ava Admin final finance approval.

## 25. Treasury task: Approved bill ka payment schedule karna

Bill final approved hone ke baad bill detail par:

- Full payment: Partial amount blank.
- Partial payment: e.g. `80.00`.
- **Schedule payment**.

Alternative menu:

**Vendors & Bill Pay → Payments → Schedule payment**

| Field | Value |
|---|---|
| Approved bill | Required approved/partial bill |
| Amount | Remaining amount se kam ya barabar |
| Payment method | ACH, Wire ya Check |

Expected status: `SCHEDULED`.

Handoff:

- Ava Admin payment release karega.

## 26. Treasury task: Payment run create karna

Menu:

**Vendors & Bill Pay → Payment runs → New payment run**

| Field | Value |
|---|---|
| Run name | `Weekly AP Run DEMO-01` |
| Legal entity | Acme US LLC |
| Source account | Operating |

Run detail:

1. Eligible payments select karein.
2. **Add selected payments**.
3. Run total check karein.
4. Validation issues check karein.
5. Tessa run creator ho to Ava Admin se **Release run** karwayein.

## 27. Treasury task: Accounting coding

Menu:

**Accounting → Needs review**

Entry row open karke:

| Field | Value |
|---|---|
| Category | `Software` |
| Memo | `Demo accounting classification` |
| GL account | `6100` |
| Department | `Engineering` |

Operating steps:

1. Coding save karein.
2. **Mark ready**.
3. **Ready to sync** page kholein.
4. **Sync** click karein.

Bulk operation:

- **Accounting → Overview → Sync all ready**.

Local application mock ERP use karti hai.

## 28. Treasury task: Accounting rule banana

Menu:

**Accounting → Rules → New rule**

| Field | Value |
|---|---|
| Rule name | `OpenAI software coding` |
| Source type | Card |
| Memo contains | `OpenAI` |
| Set category | Software |
| GL account | `6100` |
| Department | Engineering |
| Priority | `10` |

Lower number wali rule pehle evaluate hoti hai.

---

# USER 5 — Ava Admin / Owner

Login:

- Email: `admin@acme.test`
- Password: `password123`
- Workspace: `acme`

## 29. Admin ki responsibility

Ava Owner hai aur full access rakhti hai.

Admin ka kaam:

- Final finance approvals.
- Payments release aur sandbox settlement.
- Card controls aur sandbox card authorization.
- Company entities, departments aur locations.
- People invitations, assignments aur roles.
- Policies aur approval workflows.
- Budgets aur spend programs.
- Accounting dimensions/integrations.
- Audit log aur system-wide reporting.

Admin ko har workflow ka creator banane se demo controls hide ho jate hain. Admin ko primarily final approver/configuration owner ki tarah use karein.

## 30. Admin task: Final spend/procurement/travel approval

Menu:

**Workspace → Inbox**

Manager approval ke baad next task Admin ko milega.

Check:

- Previous approval complete hai.
- Policy result acceptable hai.
- Amount aur entity correct hain.
- Request creator Admin khud nahi hai.

**Approve** ke baad:

- Spend request → fund/card issue.
- Procurement request → PO ya selected outcome create.
- Travel request → ready to book.

## 31. Admin task: Card controls aur sandbox transaction

Menu:

**Spend → Cards**

Card open karke controls:

| Field | Value |
|---|---|
| Merchant lock | `OpenAI` |
| Allowed MCCs | `software,office` |
| Per-transaction limit | `100.00` |
| Velocity max amount | `300.00` |
| Velocity max count | `5` |
| Velocity window | `24` |

Sandbox authorization:

| Field | Value |
|---|---|
| Amount | `25.00` |
| Merchant | `OpenAI` |
| Merchant category | `software` |

1. **Authorize**.
2. Pending transaction par **Capture**.
3. Capture ke baad expense create hoga.

Admin card ko Freeze/Unfreeze kar sakta hai. Terminate permanent action hai; normal demo mein use na karein.

## 32. Admin task: Final bill approval

AP approval ke baad Admin Inbox mein bill task open karein.

Verify:

- AP approval complete.
- Duplicate clear.
- Vendor/payment readiness.
- Invoice lines and totals.
- PO match, agar applicable.

**Approve bill**. Status `APPROVED` hona chahiye. Ab Tessa Treasury payment schedule karegi.

## 33. Admin task: Payment release

Tessa payment schedule karegi. Us ke baad Admin:

1. **Workspace → Inbox** mein payment-release task open kare.
2. Ya **Vendors & Bill Pay → Payments** mein scheduled payment open kare.
3. **Release payment**.
4. Status `PROCESSING` ya `SENT`.
5. Sandbox mein **Confirm settlement**.
6. Full amount settle ho to Bill `PAID`.
7. Partial amount ho to Bill `PARTIAL`; Treasury remaining payment schedule kare.

## 34. Admin task: Reimbursement payout

Manager approval ke baad reimbursement `APPROVED` hota hai.

Menu:

**Expenses → Reimbursements**

1. Reimbursement open karein.
2. **Schedule payout**.
3. Status `SCHEDULED`.
4. Sandbox mein **Confirm payout**.
5. Status `PAID`.
6. Accounting entry payout ke baad create hogi.

## 35. Admin task: Budget create karna

Menu:

**Insights → Budgets → New budget**

| Field | Value |
|---|---|
| Budget name | `Engineering Demo 2026` |
| Legal entity | Acme US LLC |
| Amount | `25000.00` |
| Currency | USD |
| Period | Annual |

Budget detail actual, committed, remaining aur utilization show karega.

## 36. Admin task: Spend program create karna

Menu:

**Spend → Spend programs → New spend program**

| Field | Value |
|---|---|
| Program name | `Demo SaaS purchases` |
| Legal entity | Acme US LLC |
| Maximum request amount | `1000.00` |
| Currency | USD |
| Budget | Engineering Demo 2026 |
| Default fulfillment | Virtual card |
| Merchant lock | OpenAI |
| Allowed MCCs | software |
| Per-transaction limit | `250.00` |
| Velocity max amount | `500.00` |
| Velocity max count | `5` |
| Validity days | `30` |

## 37. Admin task: Company structure

### Entity

Menu: **Company → Entities → Add entity**

| Field | Value |
|---|---|
| Legal name | `Demo Pakistan Pvt Ltd` |
| Country code | `PK` |
| Currency code | `PKR` |

### Department

Menu: **Company → Departments → Add department**

- Department name: `Finance Operations`.

### Location

Menu: **Company → Locations → Add location**

- Location name: `Karachi`.

Admin existing records edit/archive bhi kar sakta hai.

## 38. Admin task: Person invite aur activate karna

Menu:

**Company → People → Invite person**

| Field | Value |
|---|---|
| First name | Demo |
| Last name | User |
| Work email | `demo.user.01@acme.test` |
| Role | Employee |
| Manager | manager@acme.test |

Create ke baad sandbox activation link show hoga.

Activation steps:

1. **Open activation**.
2. Workspace aur email verify karein.
3. Minimum 12-character password: `DemoPassword123!`.
4. Same confirm password.
5. **Activate account**.
6. New user se login test karein.

Person detail par Admin:

- Manager assign karega.
- Department assign karega.
- Location assign karega.
- Legal entity assign karega.
- Role assign/remove karega.
- Organization ya entity scope select karega.
- Account suspend/reset/terminate kar sakta hai.

## 39. Admin task: Policy banana

Menu:

**Company → Policies**

Example:

| Field | Value |
|---|---|
| Policy name | `Demo high-value receipt policy` |
| Object type | expense |
| Priority | `50` |
| Effective date | Today/future date |
| Enabled | Checked |
| Rule | receipt_required |
| Threshold | `75` |
| Action | REVIEW |

Actions:

- **Simulate** se policy result check karein.
- **Save policy** new policy banata hai.
- **Edit / version** existing policy ka new version banata hai.
- **Disable** future evaluation rokta hai.

## 40. Admin task: Approval workflow banana

Menu:

**Company → Approval rules**

| Field | Value |
|---|---|
| Workflow name | `Demo spend workflow` |
| Object type | spend_request |
| Enable after save | Checked |
| Step 1 | manager / Serial |
| Step 1 maximum | `5000` |
| Step 2 | finance / Serial |

1. **Add step** se finance step add karein.
2. **Preview / simulate**.
3. Applicable steps verify karein.
4. **Save workflow**.

Parallel approvals ke liye mode Parallel aur same parallel group use karein.

## 41. Admin task: Accounting dimensions

Menu:

**Company → Accounting dimensions**

| Field | Value |
|---|---|
| Key | `cost_center` |
| Label | `Cost Centers` |
| Values | Neeche ka multiline data |

```text
ENG|Engineering
FIN|Finance
SALES|Sales
```

## 42. Admin task: Audit aur integrations

### Audit log

Menu: **Company → Audit log**

Use:

- Kis user ne approval ki.
- Card kab issue/freeze hua.
- Bill/payment lifecycle.
- Reimbursement payout.
- Configuration changes.

### Integration health

Menu: **Company → Integrations**

- Provider status.
- Health.
- Cursor.
- Last sync.
- **Sandbox ping**.

Local demo mein real provider connection nahi; mock adapters expected hain.

---

# COMPLETE USER-TO-USER WORKFLOWS

## 43. Workflow A — Spend request se accounting tak

### Step 1 — Elena Employee

1. My requests.
2. USD 120 OpenAI request create.
3. Legal entity Acme US LLC.
4. Program Software tools.
5. Fulfillment Virtual card.

Result: `IN_REVIEW`.

### Step 2 — Miles Manager

1. Inbox.
2. Request review.
3. Approve.

Result: Finance approval pending.

### Step 3 — Ava Admin

1. Inbox.
2. Final approve.

Result: `FULFILLED`; fund/card issued.

### Step 4 — Ava Admin

1. Card detail.
2. USD 25, merchant OpenAI, MCC software.
3. Authorize.
4. Capture.

Result: Cleared transaction + incomplete expense.

### Step 5 — Elena Employee

1. My expenses.
2. Memo/receipt/splits complete.
3. Submit expense.

### Step 6 — Miles Manager

1. Inbox or Expense review.
2. Approve expense.

### Step 7 — Tessa Treasury

1. Accounting Needs review.
2. Category Software, GL 6100.
3. Mark ready.
4. Sync.

Final result: Accounting `SYNCED`.

## 44. Workflow B — Bill se settlement tak

### Step 1 — Tessa Treasury

1. Bill create.
2. Unique invoice `DEMO-INV-001`.
3. USD 125 line.
4. Submit for approval.

### Step 2 — Aiden AP

1. Inbox/For approval.
2. Duplicate, vendor, document aur lines check.
3. Approve.

### Step 3 — Ava Admin

1. Inbox.
2. Final finance approval.

Result: Bill `APPROVED`.

### Step 4 — Tessa Treasury

1. Bill detail.
2. Schedule USD 125 ACH payment.

Result: Payment `SCHEDULED`.

### Step 5 — Ava Admin

1. Payments/Inbox.
2. Release payment.
3. Confirm settlement.

Final result: Payment settled, bill `PAID`.

## 45. Workflow C — Procurement se PO aur matching tak

### Step 1 — Elena Employee

1. Procurement request create.
2. USD 1,000.
3. Outcome Purchase order.
4. Submit.

### Step 2 — Miles Manager

1. Inbox.
2. First approve.

### Step 3 — Ava Admin

1. Inbox.
2. Final approve.

Result: PO created.

### Step 4 — Ava Admin ya authorized procurement reviewer

1. PO open.
2. Receive USD 400.
3. Receive remaining USD 600.

### Step 5 — Tessa Treasury

1. Linked vendor bill create.
2. Amount USD 1,000.
3. Submit.

### Step 6 — Ava Admin/AP

1. PO detail.
2. Linked bill select.
3. Run 2/3-way match.

Result: `MATCHED`, warna Match Exceptions queue.

## 46. Workflow D — Reimbursement payout

### Step 1 — Elena Employee

1. Standard reimbursement USD 40 create.
2. Submit.

### Step 2 — Miles Manager

1. Inbox.
2. Approve.

### Step 3 — Ava Admin/Tessa Treasury

1. Schedule payout.

### Step 4 — Different authorized finance user

1. Confirm payout.

Result: `PAID` + accounting entry.

## 47. Workflow E — Travel booking

### Step 1 — Elena Employee

1. Trip create.
2. Search quote.
3. Select quote.
4. Submit.

### In-policy route

1. Elena reprices.
2. Places mock hold.
3. Confirms sandbox booking.

### Out-of-policy route

1. Miles Manager approves.
2. Ava Admin gives final approval.
3. Elena reprices/holds/confirms.

Result: Confirmed trip + travel fund/card.

---

# DAILY OPERATION CHECKLIST BY USER

## 48. Elena Employee daily checklist

- [ ] Inbox/notifications check ki?
- [ ] Apni request statuses dekhin?
- [ ] Incomplete expenses complete kiye?
- [ ] Required receipts attach kiye?
- [ ] Draft reimbursements submit kiye?
- [ ] Travel/procurement drafts submit kiye?
- [ ] Card/fund balance check kiya?

## 49. Miles Manager daily checklist

- [ ] Inbox approvals review kiye?
- [ ] Policy warnings padhe?
- [ ] Missing data par Request info kiya?
- [ ] Invalid request reject with comment ki?
- [ ] Expense receipts/memos verify kiye?
- [ ] Duplicate reimbursement check kiya?
- [ ] Out-of-policy travel reason review kiya?

## 50. Aiden AP daily checklist

- [ ] For approval bills check kiye?
- [ ] Duplicate invoice status verify kiya?
- [ ] Vendor/payment readiness check ki?
- [ ] PO/receipt/invoice match dekha?
- [ ] Match exceptions resolve/escalate kiye?
- [ ] Pending bank change verification dekhi?

## 51. Tessa Treasury daily checklist

- [ ] New invoices capture kiye?
- [ ] Approved bills ke payments schedule kiye?
- [ ] Payment run prepare kiya?
- [ ] Release ke liye Admin ko handoff kiya?
- [ ] Accounting Needs review queue clear ki?
- [ ] Ready entries sync kiye?
- [ ] Sync errors retry kiye?

## 52. Ava Admin daily checklist

- [ ] Final finance approvals complete kiye?
- [ ] Payment releases review kiye?
- [ ] Settlement/payout confirmations check ki?
- [ ] Integration health check ki?
- [ ] Audit log mein unusual actions dekhe?
- [ ] Policies/workflows enabled versions verify kiye?
- [ ] People/roles/entity assignments review kiye?

---

# QUICK DEMO LOGIN ORDER

Puri application ka clean demo is login order mein karein:

```text
1. employee@acme.test
   Create spend, reimbursement, procurement and travel requests

2. manager@acme.test
   Approve employee-level tasks

3. admin@acme.test
   Complete final approvals and card transaction

4. employee@acme.test
   Complete and submit generated expense

5. manager@acme.test
   Approve expense

6. treasury@acme.test
   Create bill, schedule payment, code accounting

7. ap@acme.test
   Approve bill at AP step

8. admin@acme.test
   Final bill approval, payment release and settlement

9. treasury@acme.test
   Final accounting sync
```

## 53. Important operating cautions

- Har demo record ka unique name/invoice number rakhein.
- Creator apna approval/release na kare.
- Reject aur Request info se pehle comment likhein.
- Payment scheduled amount remaining bill amount se zyada na ho.
- PO receiving PO total se zyada na ho.
- Spend amount program maximum se kam ho.
- Merchant-lock card mein exact merchant name use karein.
- Receipt files sirf PDF/PNG/JPG/JPEG hon.
- Travel end date start date ke baad ho.
- `Terminate`, `Cancel`, `Archive` aur `Deactivate` history/status ko materially change karte hain; sirf intended demo mein use karein.
- Card, payout, travel booking aur ERP operations local environment mein mock/sandbox hain.

## 54. Feature-flagged/non-primary pages

Disputes, tax, receivables, advanced banking, contracts, sourcing, renewals, AI tools, rewards aur developer platform current primary user demo ka hissa nahi hain. User-wise demo active workflows par rakhein:

- Employee self-service
- Manager approvals
- AP bill review
- Treasury payments/accounting
- Admin final approvals/configuration
