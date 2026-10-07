# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: golden-flows.spec.ts >> A: spend request to accounting golden journey
- Location: e2e\golden-flows.spec.ts:41:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/SANDBOX \/ MOCK CARD/)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/SANDBOX \/ MOCK CARD/) with timeout 5000ms
  - waiting for getByText(/SANDBOX \/ MOCK CARD/)

```

```yaml
- alert
- link "Skip to main content":
  - /url: "#main-content"
- complementary "Primary navigation":
  - link "F Finance Control center":
    - /url: /app/home
  - navigation:
    - text: Workspace
    - link "Overview":
      - /url: /app/home
    - link "Inbox":
      - /url: /app/inbox
    - link "Search":
      - /url: /app/search
    - text: My work
    - link "My card":
      - /url: /app/me/cards
    - link "My expenses":
      - /url: /app/me/expenses
    - link "My requests":
      - /url: /app/me/requests
    - link "My reimbursements":
      - /url: /app/me/reimbursements
    - link "My travel":
      - /url: /app/me/travel
    - text: Spend
    - link "Spend programs":
      - /url: /app/spend/programs
    - link "Spend requests":
      - /url: /app/spend/requests
    - link "Cards":
      - /url: /app/cards
    - link "Funds":
      - /url: /app/spend/funds
    - link "Transactions":
      - /url: /app/spend/transactions
    - text: Expenses
    - link "Expense review":
      - /url: /app/expenses/transactions
    - link "Receipts":
      - /url: /app/expenses/receipts
    - link "Reimbursements":
      - /url: /app/expenses/reimbursements
    - link "For approval":
      - /url: /app/expenses/reimbursements?status=IN_REVIEW
    - link "For payout":
      - /url: /app/expenses/reimbursements?status=APPROVED
    - link "Paid / History":
      - /url: /app/expenses/reimbursements?status=PAID
    - link "Failures":
      - /url: /app/expenses/reimbursements?status=FAILED
    - text: Procurement
    - link "Requests":
      - /url: /app/procurement/requests
    - link "Programs":
      - /url: /app/procurement/programs
    - link "Purchase Orders":
      - /url: /app/procurement/purchase-orders
    - link "Receiving":
      - /url: /app/procurement/receiving
    - link "Match Exceptions":
      - /url: /app/procurement/match-exceptions
    - text: Vendors & Bill Pay
    - link "Vendors":
      - /url: /app/vendors
    - link "Bills":
      - /url: /app/bill-pay/bills
    - link "For approval":
      - /url: /app/bill-pay/bills?stage=approval
    - link "For payment":
      - /url: /app/bill-pay/bills?stage=payment
    - link "Payments":
      - /url: /app/bill-pay/payments
    - link "Payment runs":
      - /url: /app/bill-pay/payment-runs
    - link "History":
      - /url: /app/bill-pay/bills?stage=history
    - text: Accounting
    - link "Overview":
      - /url: /app/accounting/overview
    - link "Needs review":
      - /url: /app/accounting/review
    - link "Ready to sync":
      - /url: /app/accounting/ready-to-sync
    - link "Synced":
      - /url: /app/accounting/synced
    - link "Sync errors":
      - /url: /app/accounting/errors
    - link "Rules":
      - /url: /app/accounting/rules
    - link "Integrations":
      - /url: /app/accounting/integrations
    - text: Insights
    - link "Dashboard":
      - /url: /app/insights/dashboard
    - link "Budgets":
      - /url: /app/insights/budgets
    - link "Notifications":
      - /url: /app/notifications
    - text: Travel
    - link "Trips":
      - /url: /app/travel/trips
    - link "Trip requests":
      - /url: /app/travel/requests
    - link "Search":
      - /url: /app/travel/search
    - link "Reports":
      - /url: /app/travel/reports
    - text: Company
    - link "Settings":
      - /url: /app/company/settings
    - link "Entities":
      - /url: /app/company/entities
    - link "Departments":
      - /url: /app/company/departments
    - link "Locations":
      - /url: /app/company/locations
    - link "People":
      - /url: /app/company/people
    - link "Roles":
      - /url: /app/company/roles
    - link "Policies":
      - /url: /app/company/policy
    - link "Approval rules":
      - /url: /app/company/approvals
    - link "Accounting dimensions":
      - /url: /app/company/accounting-dimensions
    - link "Integrations":
      - /url: /app/company/integrations
    - link "Audit log":
      - /url: /app/company/audit
  - strong: Ava Admin
  - text: Owner
- banner:
  - text: Workspace
  - strong: Finance
  - link "Search":
    - /url: /app/search
  - link "Inbox":
    - /url: /app/inbox
  - link "Notifications":
    - /url: /app/notifications
  - button "Sign out"
- main:
  - heading "Card ···4530" [level=1]
  - paragraph: VIRTUAL · MOCK · Elena Employee
  - link "Back to cards":
    - /url: /app/cards
  - button "Freeze"
  - button "Terminate"
  - article "Virtual card ending 4530":
    - text: Issuing Virtual
    - paragraph: •••• •••• •••• 4530
    - text: Cardholder
    - strong: Elena Employee
    - text: VISA
    - strong: VIRTUAL
    - text: USD 2,560.00 Locked · OpenAI
  - article:
    - text: Status
    - strong: ACTIVE
    - text: Sandbox / mock issuer
  - article:
    - text: Available
    - strong: USD 2,560.00
    - text: Fund Elena software fund
  - article:
    - text: Pending / cleared
    - strong: USD 0.00 · USD 42.00
    - text: Holds vs captured
  - heading "Linked records" [level=2]
  - term: Holder
  - definition: Elena Employee · employee@acme.test
  - term: Fund
  - definition:
    - link "Elena software fund":
      - /url: /app/spend/funds/f73e6c1b-22e5-4af4-9e12-7ba10fefad94
  - term: Spend request
  - definition: —
  - term: Created
  - definition: 10/6/2026, 4:30:12 PM
  - heading "Controls" [level=2]
  - text: Merchant lock
  - textbox "Merchant lock": OpenAI
  - text: Allowed categories (comma-separated)
  - 'textbox "Allowed categories (comma-separated) Aliases work in Stripe mode: software, saas, office, grocery, meals, airlines, hotels. Or use Stripe enums such as computer_software_stores."':
    - /placeholder: software,office
  - text: "Aliases work in Stripe mode: software, saas, office, grocery, meals, airlines, hotels. Or use Stripe enums such as computer_software_stores. Blocked categories"
  - textbox "Blocked categories":
    - /placeholder: grocery,betting_casino_gambling
  - text: Allowed countries
  - textbox "Allowed countries":
    - /placeholder: US,CA
  - text: Blocked countries
  - textbox "Blocked countries"
  - text: Per-transaction limit
  - spinbutton "Per-transaction limit"
  - text: Daily / weekly / monthly limits
  - spinbutton "Daily / weekly / monthly limits"
  - spinbutton "Weekly"
  - spinbutton "Monthly"
  - text: Velocity max amount
  - spinbutton "Velocity max amount"
  - text: Velocity max count
  - spinbutton "Velocity max count"
  - text: Velocity window (hours)
  - spinbutton "Velocity window (hours)": "24"
  - button "Save controls"
  - heading "Sandbox authorize" [level=2]
  - paragraph: Records a mock authorization hold. Capture it from the transactions table.
  - text: Amount
  - spinbutton "Amount": "25.00"
  - text: Merchant
  - textbox "Merchant": Amazon
  - text: Merchant category
  - textbox "Merchant category":
    - /placeholder: software or computer_software_stores
    - text: software
  - button "Authorize"
  - heading "Authorizations" [level=2]
  - text: 0 recent
  - paragraph: No records.
  - heading "Transactions" [level=2]
  - text: 1 recent
  - table:
    - rowgroup:
      - row "Authorized Merchant Amount Status Actions":
        - columnheader "Authorized"
        - columnheader "Merchant"
        - columnheader "Amount"
        - columnheader "Status"
        - columnheader "Actions"
    - rowgroup:
      - row "10/6/2026, 4:30:12 PM OpenAI USD 42.00 CLEARED Reverse":
        - cell "10/6/2026, 4:30:12 PM"
        - cell "OpenAI"
        - cell "USD 42.00"
        - cell "CLEARED"
        - cell "Reverse":
          - button "Reverse"
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | type Row = Record<string, unknown> & { id: string };
  4   | 
  5   | async function login(page: Page, email: string) {
  6   |   const response = await page.request.post("/api/v1/identity/login", {
  7   |     data: { email, password: "password123", workspace: "acme" },
  8   |   });
  9   |   expect(response.ok()).toBeTruthy();
  10  |   const envelope = await response.json() as { data: { token: string } };
  11  |   await page.addInitScript((token) => localStorage.setItem("finance.token", token), envelope.data.token);
  12  |   return envelope.data.token;
  13  | }
  14  | 
  15  | async function api<T>(page: Page, token: string, method: "get" | "post", path: string, data?: unknown): Promise<T> {
  16  |   const response = await page.request[method](`/api/v1${path}`, {
  17  |     headers: { authorization: `Bearer ${token}` },
  18  |     ...(data === undefined ? {} : { data }),
  19  |   });
  20  |   expect(response.ok(), `${method.toUpperCase()} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  21  |   const envelope = await response.json() as { data: T };
  22  |   return envelope.data;
  23  | }
  24  | 
  25  | async function apiExpectStatus(page: Page, token: string, method: "get" | "post", path: string, status: number, data?: unknown) {
  26  |   const response = await page.request[method](`/api/v1${path}`, {
  27  |     headers: { authorization: `Bearer ${token}` },
  28  |     ...(data === undefined ? {} : { data }),
  29  |   });
  30  |   expect(response.status()).toBe(status);
  31  |   return response;
  32  | }
  33  | 
  34  | /** Prefer US entity when admin lists both; employees are seeded on Acme US only. */
  35  | async function primaryEntityId(page: Page, token: string) {
  36  |   const entities = await api<Array<Row & { name?: string; country?: string }>>(page, token, "get", "/entities");
  37  |   const us = entities.find((e) => e.country === "US" || (e.name ?? "").includes("US"));
  38  |   return (us ?? entities[0]).id;
  39  | }
  40  | 
  41  | test("A: spend request to accounting golden journey", async ({ page }) => {
  42  |   const creator = await login(page, "employee@acme.test");
  43  |   const programs = await api<Array<Row & { legalEntityId: string }>>(page, creator, "get", "/spend-programs");
  44  |   const created = await api<Row & { policy?: { result: string }; status: string }>(page, creator, "post", "/spend-requests", {
  45  |     name: `Golden software ${Date.now()}`, purpose: "Golden E2E business purpose", amount: "60.00", currency: "USD",
  46  |     legalEntityId: programs[0].legalEntityId, programId: programs[0].id, fulfillmentType: "VIRTUAL_CARD",
  47  |     category: "Software",
  48  |   });
  49  |   expect(created.policyResult === "PASS" || created.policyResult === "WARN" || created.policyResult === "REVIEW" || created.policy?.result).toBeTruthy();
  50  |   expect(["IN_REVIEW", "SUBMITTED"]).toContain(created.status);
  51  | 
  52  |   await page.goto(`/app/spend/requests/${created.id}`);
  53  |   await expect(page.getByRole("heading", { name: /Golden software/ })).toBeVisible();
  54  |   await expect(page.getByText(/Policy/i).first()).toBeVisible();
  55  | 
  56  |   const manager = await login(page, "manager@acme.test");
  57  |   await page.goto("/app/inbox");
  58  |   await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  59  |   await api(page, manager, "post", `/spend-requests/${created.id}/approve`, {});
  60  | 
  61  |   const admin = await login(page, "admin@acme.test");
  62  |   const approved = await api<{ card: Row | null; request: { status: string } }>(page, admin, "post", `/spend-requests/${created.id}/approve`, {});
  63  |   expect(approved.card?.id).toBeTruthy();
  64  |   expect(approved.request.status).toBe("FULFILLED");
  65  | 
  66  |   await page.goto(`/app/spend/cards/${approved.card!.id}`);
> 67  |   await expect(page.getByText(/SANDBOX \/ MOCK CARD/)).toBeVisible();
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  68  |   await page.getByLabel("Amount").last().fill("25.00");
  69  |   await page.getByLabel("Merchant", { exact: true }).fill("OpenAI");
  70  |   await page.getByRole("button", { name: "Authorize" }).click();
  71  |   await expect(page.getByRole("status")).toContainText("authorization recorded");
  72  |   await page.getByRole("button", { name: "Capture" }).click();
  73  |   await expect(page.getByRole("status")).toContainText("capture completed");
  74  | 
  75  |   const expenses = await api<Row[]>(page, admin, "get", "/expenses");
  76  |   const expense = expenses.find((row) => row.status === "INCOMPLETE");
  77  |   expect(expense).toBeTruthy();
  78  |   await page.goto(`/app/expenses/${expense!.id}`);
  79  |   await expect(page.getByText("Requirements")).toBeVisible();
  80  |   await expect(page.getByText(/Missing|Complete/).first()).toBeVisible();
  81  | 
  82  |   await api(page, admin, "post", `/expenses/${expense!.id}/update-memo`, { memo: "Golden E2E receipt verified" });
  83  |   await api(page, admin, "post", `/expenses/${expense!.id}/submit`, {});
  84  |   await api(page, manager, "post", `/expenses/${expense!.id}/approve`, {});
  85  | 
  86  |   await page.goto("/app/accounting/card");
  87  |   await expect(page.getByRole("heading", { name: "Card accounting" })).toBeVisible();
  88  |   await expect(page.getByText("CARD_TRANSACTION").first()).toBeVisible();
  89  | 
  90  |   const entries = await api<Array<Row & { sourceType: string; sourceId: string; status: string }>>(page, admin, "get", "/accounting");
  91  |   const entry = entries.find((row) => row.sourceType === "CARD_TRANSACTION");
  92  |   expect(entry).toBeTruthy();
  93  |   if (entry && entry.status === "NEEDS_REVIEW") {
  94  |     await api(page, admin, "post", `/accounting/${entry.id}/code`, { category: "Software", memo: "Golden sync" });
  95  |     await api(page, admin, "post", `/accounting/${entry.id}/ready`, {});
  96  |     await api(page, admin, "post", `/accounting/${entry.id}/sync`, {});
  97  |   }
  98  | });
  99  | 
  100 | test("A2: declined authorization + tenant isolation negatives", async ({ page }) => {
  101 |   const employee = await login(page, "employee@acme.test");
  102 |   const programs = await api<Array<Row & { legalEntityId: string }>>(page, employee, "get", "/spend-programs");
  103 |   const request = await api<Row>(page, employee, "post", "/spend-requests", {
  104 |     name: `Decline path ${Date.now()}`, purpose: "Negative path", amount: "40.00", currency: "USD",
  105 |     legalEntityId: programs[0].legalEntityId, programId: programs[0].id, fulfillmentType: "VIRTUAL_CARD",
  106 |   });
  107 |   await expect(apiExpectStatus(page, employee, "post", `/spend-requests/${request.id}/approve`, 403)).resolves.toBeTruthy();
  108 | 
  109 |   const manager = await login(page, "manager@acme.test");
  110 |   await api(page, manager, "post", `/spend-requests/${request.id}/approve`, {});
  111 |   const admin = await login(page, "admin@acme.test");
  112 |   const fulfilled = await api<{ card: Row }>(page, admin, "post", `/spend-requests/${request.id}/approve`, {});
  113 |   await api(page, admin, "post", `/cards/${fulfilled.card.id}/freeze`, {});
  114 |   const declined = await api<{ decision: string; reason: string }>(page, admin, "post", "/authorizations", {
  115 |     cardId: fulfilled.card.id, amount: "10.00", currency: "USD", merchant: "Test", merchantCategory: "general",
  116 |     idempotencyKey: `decl-${Date.now()}`,
  117 |   });
  118 |   expect(declined.decision).toBe("DECLINED");
  119 |   expect(declined.reason).toBe("CARD_FROZEN");
  120 | 
  121 |   // Tenant B cannot read Tenant A request (beta workspace if seeded; otherwise 403/404 on forged id access via employee scope is covered by API tests).
  122 |   await apiExpectStatus(page, employee, "post", `/cards/${fulfilled.card.id}/freeze`, 403);
  123 | });
  124 | 
  125 | test("B: bill approval, release, settlement, and accounting golden journey", async ({ page }) => {
  126 |   const treasury = await login(page, "treasury@acme.test");
  127 |   const [entities, vendors] = await Promise.all([
  128 |     api<Row[]>(page, treasury, "get", "/entities"),
  129 |     api<Row[]>(page, treasury, "get", "/vendors"),
  130 |   ]);
  131 |   const bill = await api<Row & { duplicateStatus?: string; vendorMatchStatus?: string; status: string }>(page, treasury, "post", "/bills", {
  132 |     vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber: `GOLD-${Date.now()}`,
  133 |     amount: "125.00", currency: "USD", memo: "Golden E2E bill",
  134 |   });
  135 |   expect(bill.duplicateStatus ?? "CLEAR").toBe("CLEAR");
  136 |   expect(["MATCHED", "SUGGESTED"]).toContain(bill.vendorMatchStatus ?? "MATCHED");
  137 |   expect(bill.status).toBe("PENDING_APPROVAL");
  138 | 
  139 |   const ap = await login(page, "ap@acme.test");
  140 |   await page.goto("/app/inbox");
  141 |   await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  142 |   await api(page, ap, "post", `/bills/${bill.id}/approve`, {});
  143 |   const admin = await login(page, "admin@acme.test");
  144 |   await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  145 | 
  146 |   const employee = await login(page, "employee@acme.test");
  147 |   await apiExpectStatus(page, employee, "post", `/payments`, 403, {
  148 |     billId: bill.id, amount: "125.00", rail: "ACH", idempotencyKey: `deny-${Date.now()}`,
  149 |   });
  150 | 
  151 |   const payment = await api<Row>(page, treasury, "post", "/payments", {
  152 |     billId: bill.id, amount: "125.00", rail: "ACH", idempotencyKey: `golden-${Date.now()}`,
  153 |   });
  154 |   await apiExpectStatus(page, treasury, "post", `/payments/${payment.id}/release`, 403);
  155 |   await apiExpectStatus(page, employee, "post", `/payments/${payment.id}/release`, 403);
  156 |   await api(page, admin, "post", `/payments/${payment.id}/release`, {});
  157 |   const released = await api<{ payment: { status: string } } | Row & { status: string }>(page, admin, "get", `/payments/${payment.id}`);
  158 |   const releasedStatus = "payment" in released ? released.payment.status : released.status;
  159 |   expect(["PROCESSING", "SENT"]).toContain(releasedStatus);
  160 |   await api(page, admin, "post", `/payments/${payment.id}/confirm-settlement`, {});
  161 | 
  162 |   await login(page, "admin@acme.test");
  163 |   await page.goto(`/app/bill-pay/bills/${bill.id}`);
  164 |   await expect(page.getByRole("heading", { name: /Invoice GOLD-/ })).toBeVisible({ timeout: 15000 });
  165 |   await expect(page.getByText("PAID").first()).toBeVisible();
  166 |   await expect(page.getByText(/Approval|Activity|Duplicate/i).first()).toBeVisible();
  167 |   await page.goto("/app/accounting/bill-pay");
```