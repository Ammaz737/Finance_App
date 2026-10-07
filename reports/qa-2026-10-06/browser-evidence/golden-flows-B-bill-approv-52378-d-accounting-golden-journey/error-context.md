# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: golden-flows.spec.ts >> B: bill approval, release, settlement, and accounting golden journey
- Location: e2e\golden-flows.spec.ts:125:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/BILL|PAYMENT/).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/BILL|PAYMENT/).first() with timeout 5000ms
  - waiting for getByText(/BILL|PAYMENT/).first()

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
  - navigation "Accounting sections":
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
    - link "Cards":
      - /url: /app/accounting/card
    - link "Reimbursements":
      - /url: /app/accounting/reimbursements
    - link "Bill Pay":
      - /url: /app/accounting/bill-pay
    - link "Rules":
      - /url: /app/accounting/rules
    - link "Integrations":
      - /url: /app/accounting/integrations
  - toolbar "Bill Pay source filters":
    - link "All":
      - /url: /app/accounting/bill-pay
    - link "Bills":
      - /url: /app/accounting/bill-pay?source=BILL
    - link "Payments":
      - /url: /app/accounting/bill-pay?source=PAYMENT
  - heading "Bill Pay accounting" [level=1]
  - paragraph: Review and code financial activity before export or ERP sync.
  - text: Search Bill Pay accounting
  - textbox "Search Bill Pay accounting":
    - /placeholder: Search bill pay accounting…
  - text: Saved view name
  - textbox "Saved view name":
    - /placeholder: Save view name
  - button "Save view" [disabled]
  - text: 2 records
  - table:
    - rowgroup:
      - row "Entry Amount Status Category":
        - columnheader "Entry"
        - columnheader "Amount"
        - columnheader "Status"
        - columnheader "Category"
        - columnheader
    - rowgroup:
      - row "Bill Invoice GOLD-1791286876198 USD 125.00 NEEDS REVIEW — Open →":
        - cell "Bill Invoice GOLD-1791286876198":
          - strong: Bill
          - text: Invoice GOLD-1791286876198
        - cell "USD 125.00"
        - cell "NEEDS REVIEW"
        - cell "—"
        - cell "Open →"
      - row "Payment Payment ACH USD 125.00 NEEDS REVIEW — Open →":
        - cell "Payment Payment ACH":
          - strong: Payment
          - text: Payment ACH
        - cell "USD 125.00"
        - cell "NEEDS REVIEW"
        - cell "—"
        - cell "Open →"
  - paragraph:
    - text: Operational documents live in
    - link "Bill Pay":
      - /url: /app/bill-pay/bills
    - text: . Coding still happens from the row drawer here.
```

# Test source

```ts
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
  168 |   await expect(page.getByRole("heading", { name: "Bill Pay accounting" })).toBeVisible();
> 169 |   await expect(page.getByText(/BILL|PAYMENT/).first()).toBeVisible();
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  170 | 
  171 |   const dash = await api<{ pendingBills: number; paidBills?: number; openPayablesByCurrency: unknown[] }>(page, admin, "get", "/reporting");
  172 |   expect(dash.openPayablesByCurrency).toBeTruthy();
  173 | });
  174 | 
  175 | test("B2: partial payment then settle remaining", async ({ page }) => {
  176 |   const treasury = await login(page, "treasury@acme.test");
  177 |   const [entities, vendors] = await Promise.all([
  178 |     api<Row[]>(page, treasury, "get", "/entities"),
  179 |     api<Row[]>(page, treasury, "get", "/vendors"),
  180 |   ]);
  181 |   const bill = await api<Row>(page, treasury, "post", "/bills", {
  182 |     vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber: `PART-${Date.now()}`,
  183 |     amount: "200.00", currency: "USD", memo: "Partial E2E",
  184 |   });
  185 |   const ap = await login(page, "ap@acme.test");
  186 |   await api(page, ap, "post", `/bills/${bill.id}/approve`, {});
  187 |   const admin = await login(page, "admin@acme.test");
  188 |   await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  189 | 
  190 |   const first = await api<Row>(page, treasury, "post", "/payments", {
  191 |     billId: bill.id, amount: "80.00", rail: "ACH", idempotencyKey: `part-a-${Date.now()}`,
  192 |   });
  193 |   await api(page, admin, "post", `/payments/${first.id}/release`, {});
  194 |   await api(page, admin, "post", `/payments/${first.id}/confirm-settlement`, {});
  195 |   const afterFirst = await api<{ bill: { status: string; remainingAmount: string | number } }>(page, admin, "get", `/bills/${bill.id}`);
  196 |   expect(afterFirst.bill.status).toBe("PARTIAL");
  197 |   expect(Number(afterFirst.bill.remainingAmount)).toBe(120);
  198 | 
  199 |   const second = await api<Row>(page, treasury, "post", "/payments", {
  200 |     billId: bill.id, amount: "120.00", rail: "ACH", idempotencyKey: `part-b-${Date.now()}`,
  201 |   });
  202 |   await api(page, admin, "post", `/payments/${second.id}/release`, {});
  203 |   await api(page, admin, "post", `/payments/${second.id}/confirm-settlement`, {});
  204 |   const afterSecond = await api<{ bill: { status: string; remainingAmount: string | number } }>(page, admin, "get", `/bills/${bill.id}`);
  205 |   expect(afterSecond.bill.status).toBe("PAID");
  206 |   expect(Number(afterSecond.bill.remainingAmount)).toBe(0);
  207 | });
  208 | 
  209 | test("B3: AP negatives — duplicate, creator SoD, tenant isolation", async ({ page }) => {
  210 |   const treasury = await login(page, "treasury@acme.test");
  211 |   const [entities, vendors] = await Promise.all([
  212 |     api<Row[]>(page, treasury, "get", "/entities"),
  213 |     api<Row[]>(page, treasury, "get", "/vendors"),
  214 |   ]);
  215 |   const invoiceNumber = `DUP-${Date.now()}`;
  216 |   const bill = await api<Row>(page, treasury, "post", "/bills", {
  217 |     vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber,
  218 |     amount: "55.00", currency: "USD",
  219 |   });
  220 |   await apiExpectStatus(page, treasury, "post", "/bills", 409, {
  221 |     vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber,
  222 |     amount: "55.00", currency: "USD",
  223 |   });
  224 |   await apiExpectStatus(page, treasury, "post", `/bills/${bill.id}/approve`, 403);
  225 | 
  226 |   const employee = await login(page, "employee@acme.test");
  227 |   await apiExpectStatus(page, employee, "post", `/bills/${bill.id}/approve`, 403);
  228 |   const denied = await page.request.get(`/api/v1/bills/${bill.id}`, {
  229 |     headers: { authorization: `Bearer ${employee}` },
  230 |   });
  231 |   expect([403, 404]).toContain(denied.status());
  232 | });
  233 | 
  234 | test("C: procurement request → PO → receiving → bill match → GF2 settle", async ({ page }) => {
  235 |   const adminBootstrap = await login(page, "admin@acme.test");
  236 |   const [vendors, programs] = await Promise.all([
  237 |     api<Row[]>(page, adminBootstrap, "get", "/vendors"),
  238 |     api<Array<Row & { defaultOutcomeType?: string }>>(page, adminBootstrap, "get", "/procurement-programs"),
  239 |   ]);
  240 |   const program = programs.find((p) => p.defaultOutcomeType === "PURCHASE_ORDER") ?? programs[0];
  241 |   const entityId = await primaryEntityId(page, adminBootstrap);
  242 | 
  243 |   const employee = await login(page, "employee@acme.test");
  244 |   const created = await api<Row & { status: string; policyResult?: string }>(page, employee, "post", "/procurement", {
  245 |     name: `Laptops ${Date.now()}`,
  246 |     legalEntityId: entityId,
  247 |     programId: program.id,
  248 |     vendorId: vendors[0].id,
  249 |     amount: "100.00",
  250 |     currency: "USD",
  251 |     memo: "Engineering laptops",
  252 |     outcomeType: "PURCHASE_ORDER",
  253 |     lines: [
  254 |       { description: "Laptop", quantity: 2, unitAmount: "40" },
  255 |       { description: "Dock", amount: "20" },
  256 |     ],
  257 |   });
  258 |   expect(created.status).toBe("DRAFT");
  259 |   const submitted = await api<Row & { status: string; policyResult?: string | null }>(page, employee, "post", `/procurement/${created.id}/submit`, {});
  260 |   expect(submitted.status).toBe("IN_REVIEW");
  261 |   expect(submitted.policyResult).toBeTruthy();
  262 | 
  263 |   await apiExpectStatus(page, employee, "post", `/procurement/${created.id}/approve`, 403);
  264 | 
  265 |   const manager = await login(page, "manager@acme.test");
  266 |   await page.goto("/app/inbox");
  267 |   await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  268 |   await api(page, manager, "post", `/procurement/${created.id}/approve`, {});
  269 | 
```