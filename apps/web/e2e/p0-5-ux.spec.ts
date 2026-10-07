import { expect, test, type Page } from "@playwright/test";

type Row = Record<string, unknown> & { id: string };
async function login(page: Page, email: string, password = "password123") { const response = await page.request.post("/api/v1/identity/login", { data: { email, password, workspace: "acme" } }); expect(response.ok()).toBeTruthy(); const body = await response.json() as { data: { token: string } }; return body.data.token; }
async function useToken(page: Page, token: string) { await page.addInitScript((value) => localStorage.setItem("finance.token", value), token); }
async function api<T>(page: Page, token: string, method: "get" | "post", path: string, data?: unknown): Promise<T> { const response = await page.request[method](`/api/v1${path}`, { headers: { authorization: `Bearer ${token}` }, ...(data === undefined ? {} : { data }) }); expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy(); return ((await response.json()) as { data: T }).data; }

test("G1 — Invite → Activate → Login", async ({ page }) => {
  const admin = await login(page, "admin@acme.test"); const roles = await api<Row[]>(page, admin, "get", "/rbac"); const email = `g1.${Date.now()}@acme.test`;
  const invited = await api<Row & { activationPath: string }>(page, admin, "post", "/people", { email, firstName: "Golden", lastName: "Invite", roleId: roles[0].id });
  await page.goto(invited.activationPath); await expect(page.getByLabel("Workspace", { exact: true })).toHaveValue("acme"); await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email); await page.getByLabel("New password").fill("ActivationPass123"); await page.getByLabel("Confirm password").fill("ActivationPass123"); await page.getByRole("button", { name: "Activate account" }).click(); await expect(page.getByText("Your account is active.")).toBeVisible({ timeout: 15000 });
  await page.getByRole("link", { name: "Sign in" }).click(); await page.locator('input[autocomplete="organization"]').fill("acme"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill("ActivationPass123"); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/app\/home/, { timeout: 20000 });
});

test("G2 — Forgot Password → Reset → Login", async ({ page }) => {
  const admin = await login(page, "admin@acme.test"); const roles = await api<Row[]>(page, admin, "get", "/rbac"); const email = `g2.${Date.now()}@acme.test`; const invited = await api<Row & { activationToken: string }>(page, admin, "post", "/people", { email, firstName: "Reset", lastName: "User", roleId: roles[0].id }); await page.request.post("/api/v1/identity/activate", { data: { email, workspace: "acme", token: invited.activationToken, password: "OriginalPassword123" } });
  await page.goto("/forgot-password"); await page.getByLabel("Workspace", { exact: true }).fill("acme"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByRole("button", { name: "Send reset link" }).click(); await expect(page.getByText("Sandbox delivery")).toBeVisible(); await page.getByRole("link", { name: "Open link" }).click(); await page.getByLabel("New password").fill("EmployeeReset123"); await page.getByLabel("Confirm password").fill("EmployeeReset123"); await page.getByRole("button", { name: "Reset password" }).click(); await expect(page.getByText("Password reset complete.")).toBeVisible({ timeout: 15000 }); await page.getByRole("link", { name: "Sign in" }).click(); await page.locator('input[autocomplete="organization"]').fill("acme"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill("EmployeeReset123"); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/app\/home/, { timeout: 20000 });
});

test("G3 — approved bill payment → run → release → settlement", async ({ page }) => {
  const treasury = await login(page, "treasury@acme.test"); const admin = await login(page, "admin@acme.test"); const ap = await login(page, "ap@acme.test"); const entities = await api<Row[]>(page, admin, "get", "/entities"); const vendors = await api<Row[]>(page, admin, "get", "/vendors");
  const entityId = String(vendors[0].legalEntityId ?? entities[0].id);
  const invoiceNumber = `G3-${Date.now()}`;
  const bill = await api<Row>(page, treasury, "post", "/bills", { vendorId: vendors[0].id, legalEntityId: entityId, invoiceNumber, amount: "31.00", currency: "USD", memo: "G3" }); await api(page, ap, "post", `/bills/${bill.id}/approve`, {}); const afterFirst = await api<{ bill: { status: string } }>(page, admin, "get", `/bills/${bill.id}`); if (afterFirst.bill.status === "PENDING_APPROVAL") await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  const payment = await api<Row>(page, treasury, "post", "/payments", { billId: bill.id, amount: "31.00", rail: "ACH", idempotencyKey: `g3-${Date.now()}` }); const accounts = await api<Row[]>(page, admin, "get", "/banking"); const run = await api<Row>(page, treasury, "post", "/payment-runs", { name: `G3 run ${Date.now()}`, legalEntityId: entityId, sourceAccountId: accounts.find((row) => row.legalEntityId === entityId)?.id });
  await useToken(page, admin); await page.goto(`/app/bill-pay/payment-runs/${run.id}`); await page.locator("label.checkbox").filter({ hasText: invoiceNumber }).getByRole("checkbox").check(); await page.getByRole("button", { name: "Add selected payments" }).click(); await expect(page.getByRole("status")).toContainText("Payments added to run."); await page.getByRole("button", { name: "Release run" }).click(); await expect(page.getByRole("status")).toContainText("Run released"); await api(page, admin, "post", `/payments/${payment.id}/confirm-settlement`, {}); const settled = await api<Row>(page, admin, "get", `/payments/${payment.id}`); expect((settled.payment as { status: string }).status).toBe("SETTLED");
});

test("G4 — Vendor payment details → Bill → Payment permission path", async ({ page }) => {
  const admin = await login(page, "admin@acme.test"); const vendors = await api<Row[]>(page, admin, "get", "/vendors"); await useToken(page, admin); await page.goto(`/app/vendors/${vendors[0].id}`); await expect(page.getByRole("heading", { name: "Banking / payment details" })).toBeVisible(); await expect(page.getByText(/masked details only/i)).toBeVisible(); await expect(page.getByRole("heading", { name: "Bills" })).toBeVisible();
});

test("G5 — Procurement match exception → Resolve", async ({ page }) => {
  const admin = await login(page, "admin@acme.test"); await useToken(page, admin); await page.goto("/app/procurement/match-exceptions"); await expect(page.getByRole("heading", { name: "Match exceptions" })).toBeVisible(); const first = page.locator(".plain-list button.text-button").first(); if (await first.count()) { await first.click(); await page.getByLabel("Comment").fill("G5 reviewed"); await page.getByRole("button", { name: "Resolve", exact: true }).click(); await expect(page.getByRole("status")).toContainText("updated"); }
});

test("G6 — Admin policy + approval workflow configuration", async ({ page }) => {
  const admin = await login(page, "admin@acme.test"); await useToken(page, admin); await page.goto("/app/company/policy"); await page.getByLabel("Policy name").fill(`G6 policy ${Date.now()}`); await page.getByRole("button", { name: "Save policy" }).click(); await expect(page.getByText("Policy created.")).toBeVisible(); await page.goto("/app/company/approvals"); await page.getByLabel("Workflow name").fill(`G6 workflow ${Date.now()}`); await page.getByRole("button", { name: "Preview / simulate" }).click(); await expect(page.getByText(/applicable steps/)).toBeVisible(); await page.getByRole("button", { name: "Save workflow" }).click(); await expect(page.getByText("Workflow created.")).toBeVisible();
});

test("G7 — Spend request form loads entity and program options", async ({ page }) => {
  const admin = await login(page, "admin@acme.test");
  await useToken(page, admin);
  await page.goto("/app/me/requests");
  await page.getByRole("button", { name: "New spend request" }).click();

  const entity = page.getByLabel(/^Legal entity/);
  const program = page.getByLabel(/^Spend program/);
  await expect(entity).toBeEnabled();
  await expect(program).toBeEnabled();
  expect(await entity.locator("option").count()).toBeGreaterThan(1);
  expect(await program.locator("option").count()).toBeGreaterThan(1);
});
