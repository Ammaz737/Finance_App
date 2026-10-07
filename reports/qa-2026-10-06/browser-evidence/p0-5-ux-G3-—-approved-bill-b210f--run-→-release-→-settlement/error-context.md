# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p0-5-ux.spec.ts >> G3 — approved bill payment → run → release → settlement
- Location: e2e\p0-5-ux.spec.ts:20:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('status')
Expected substring: "Payment added"
Received string:    "Payments added to run."
Timeout: 5000ms

Call log:
  - Expect "toContainText" getByRole('status') with timeout 5000ms
  - waiting for getByRole('status')
    8 × locator resolved to <p role="status" class="notice">Payments added to run.</p>
      - unexpected value "Payments added to run."

```

```yaml
- status: Payments added to run.
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | 
  3  | type Row = Record<string, unknown> & { id: string };
  4  | async function login(page: Page, email: string, password = "password123") { const response = await page.request.post("/api/v1/identity/login", { data: { email, password, workspace: "acme" } }); expect(response.ok()).toBeTruthy(); const body = await response.json() as { data: { token: string } }; return body.data.token; }
  5  | async function useToken(page: Page, token: string) { await page.addInitScript((value) => localStorage.setItem("finance.token", value), token); }
  6  | async function api<T>(page: Page, token: string, method: "get" | "post", path: string, data?: unknown): Promise<T> { const response = await page.request[method](`/api/v1${path}`, { headers: { authorization: `Bearer ${token}` }, ...(data === undefined ? {} : { data }) }); expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy(); return ((await response.json()) as { data: T }).data; }
  7  | 
  8  | test("G1 — Invite → Activate → Login", async ({ page }) => {
  9  |   const admin = await login(page, "admin@acme.test"); const roles = await api<Row[]>(page, admin, "get", "/rbac"); const email = `g1.${Date.now()}@acme.test`;
  10 |   const invited = await api<Row & { activationPath: string }>(page, admin, "post", "/people", { email, firstName: "Golden", lastName: "Invite", roleId: roles[0].id });
  11 |   await page.goto(invited.activationPath); await page.getByLabel("New password").fill("ActivationPass123"); await page.getByLabel("Confirm password").fill("ActivationPass123"); await page.getByRole("button", { name: "Activate account" }).click(); await expect(page.getByText("Your account is active.")).toBeVisible();
  12 |   await page.getByRole("link", { name: "Sign in" }).click(); await page.locator('input[autocomplete="organization"]').fill("acme"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill("ActivationPass123"); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/app\/home/);
  13 | });
  14 | 
  15 | test("G2 — Forgot Password → Reset → Login", async ({ page }) => {
  16 |   const admin = await login(page, "admin@acme.test"); const roles = await api<Row[]>(page, admin, "get", "/rbac"); const email = `g2.${Date.now()}@acme.test`; const invited = await api<Row & { activationToken: string }>(page, admin, "post", "/people", { email, firstName: "Reset", lastName: "User", roleId: roles[0].id }); await page.request.post("/api/v1/identity/activate", { data: { email, workspace: "acme", token: invited.activationToken, password: "OriginalPassword123" } });
  17 |   await page.goto("/forgot-password"); await page.getByLabel("Workspace", { exact: true }).fill("acme"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByRole("button", { name: "Send reset link" }).click(); await expect(page.getByText("Sandbox delivery")).toBeVisible(); await page.getByRole("link", { name: "Open link" }).click(); await page.getByLabel("New password").fill("EmployeeReset123"); await page.getByLabel("Confirm password").fill("EmployeeReset123"); await page.getByRole("button", { name: "Reset password" }).click(); await page.getByRole("link", { name: "Sign in" }).click(); await page.locator('input[autocomplete="organization"]').fill("acme"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill("EmployeeReset123"); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/app\/home/);
  18 | });
  19 | 
  20 | test("G3 — approved bill payment → run → release → settlement", async ({ page }) => {
  21 |   const treasury = await login(page, "treasury@acme.test"); const admin = await login(page, "admin@acme.test"); const ap = await login(page, "ap@acme.test"); const entities = await api<Row[]>(page, admin, "get", "/entities"); const vendors = await api<Row[]>(page, admin, "get", "/vendors");
  22 |   const entityId = String(vendors[0].legalEntityId ?? entities[0].id);
  23 |   const invoiceNumber = `G3-${Date.now()}`;
  24 |   const bill = await api<Row>(page, treasury, "post", "/bills", { vendorId: vendors[0].id, legalEntityId: entityId, invoiceNumber, amount: "31.00", currency: "USD", memo: "G3" }); await api(page, ap, "post", `/bills/${bill.id}/approve`, {}); const afterFirst = await api<{ bill: { status: string } }>(page, admin, "get", `/bills/${bill.id}`); if (afterFirst.bill.status === "PENDING_APPROVAL") await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  25 |   const payment = await api<Row>(page, treasury, "post", "/payments", { billId: bill.id, amount: "31.00", rail: "ACH", idempotencyKey: `g3-${Date.now()}` }); const accounts = await api<Row[]>(page, admin, "get", "/banking"); const run = await api<Row>(page, treasury, "post", "/payment-runs", { name: `G3 run ${Date.now()}`, legalEntityId: entityId, sourceAccountId: accounts.find((row) => row.legalEntityId === entityId)?.id });
> 26 |   await useToken(page, admin); await page.goto(`/app/bill-pay/payment-runs/${run.id}`); await page.locator("label.checkbox").filter({ hasText: invoiceNumber }).getByRole("checkbox").check(); await page.getByRole("button", { name: "Add selected payments" }).click(); await expect(page.getByRole("status")).toContainText("Payment added"); await page.getByRole("button", { name: "Release run" }).click(); await expect(page.getByRole("status")).toContainText("Run released"); await api(page, admin, "post", `/payments/${payment.id}/confirm-settlement`, {}); const settled = await api<Row>(page, admin, "get", `/payments/${payment.id}`); expect((settled.payment as { status: string }).status).toBe("SETTLED");
     |                                                                                                                                                                                                                                                                                                                  ^ Error: expect(locator).toContainText(expected) failed
  27 | });
  28 | 
  29 | test("G4 — Vendor payment details → Bill → Payment permission path", async ({ page }) => {
  30 |   const admin = await login(page, "admin@acme.test"); const vendors = await api<Row[]>(page, admin, "get", "/vendors"); await useToken(page, admin); await page.goto(`/app/vendors/${vendors[0].id}`); await expect(page.getByRole("heading", { name: "Banking / payment details" })).toBeVisible(); await expect(page.getByText(/masked details only/i)).toBeVisible(); await expect(page.getByRole("heading", { name: "Bills" })).toBeVisible();
  31 | });
  32 | 
  33 | test("G5 — Procurement match exception → Resolve", async ({ page }) => {
  34 |   const admin = await login(page, "admin@acme.test"); await useToken(page, admin); await page.goto("/app/procurement/match-exceptions"); await expect(page.getByRole("heading", { name: "Match exceptions" })).toBeVisible(); const first = page.locator(".plain-list button.text-button").first(); if (await first.count()) { await first.click(); await page.getByLabel("Comment").fill("G5 reviewed"); await page.getByRole("button", { name: "Resolve", exact: true }).click(); await expect(page.getByRole("status")).toContainText("updated"); }
  35 | });
  36 | 
  37 | test("G6 — Admin policy + approval workflow configuration", async ({ page }) => {
  38 |   const admin = await login(page, "admin@acme.test"); await useToken(page, admin); await page.goto("/app/company/policy"); await page.getByLabel("Policy name").fill(`G6 policy ${Date.now()}`); await page.getByRole("button", { name: "Save policy" }).click(); await expect(page.getByText("Policy created.")).toBeVisible(); await page.goto("/app/company/approvals"); await page.getByLabel("Workflow name").fill(`G6 workflow ${Date.now()}`); await page.getByRole("button", { name: "Preview / simulate" }).click(); await expect(page.getByText(/applicable steps/)).toBeVisible(); await page.getByRole("button", { name: "Save workflow" }).click(); await expect(page.getByText("Workflow created.")).toBeVisible();
  39 | });
  40 | 
  41 | test("G7 — Spend request form loads entity and program options", async ({ page }) => {
  42 |   const admin = await login(page, "admin@acme.test");
  43 |   await useToken(page, admin);
  44 |   await page.goto("/app/me/requests");
  45 |   await page.getByRole("button", { name: "New spend request" }).click();
  46 | 
  47 |   const entity = page.getByLabel(/^Legal entity/);
  48 |   const program = page.getByLabel(/^Spend program/);
  49 |   await expect(entity).toBeEnabled();
  50 |   await expect(program).toBeEnabled();
  51 |   expect(await entity.locator("option").count()).toBeGreaterThan(1);
  52 |   expect(await program.locator("option").count()).toBeGreaterThan(1);
  53 | });
  54 | 
```