import { expect, test, type Page } from "@playwright/test";

type Row = Record<string, unknown> & { id: string };

async function login(page: Page, email: string) {
  const response = await page.request.post("/api/v1/identity/login", {
    data: { email, password: "password123", workspace: "acme" },
  });
  expect(response.ok()).toBeTruthy();
  const envelope = await response.json() as { data: { token: string } };
  await page.addInitScript((token) => localStorage.setItem("finance.token", token), envelope.data.token);
  return envelope.data.token;
}

async function api<T>(page: Page, token: string, method: "get" | "post", path: string, data?: unknown): Promise<T> {
  const response = await page.request[method](`/api/v1${path}`, {
    headers: { authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  const envelope = await response.json() as { data: T };
  return envelope.data;
}

test("A: spend request to accounting golden journey", async ({ page }) => {
  const creator = await login(page, "employee@acme.test");
  const programs = await api<Array<Row & { legalEntityId: string }>>(page, creator, "get", "/spend-programs");
  const request = await api<Row>(page, creator, "post", "/spend-requests", {
    name: `Golden software ${Date.now()}`, purpose: "Golden E2E", amount: "60.00", currency: "USD",
    legalEntityId: programs[0].legalEntityId, programId: programs[0].id, fulfillmentType: "VIRTUAL_CARD",
  });

  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/spend-requests/${request.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  const approved = await api<{ card: Row | null }>(page, admin, "post", `/spend-requests/${request.id}/approve`, {});
  expect(approved.card?.id).toBeTruthy();
  await page.goto(`/app/spend/cards/${approved.card!.id}`);
  await expect(page.getByRole("heading", { name: /Card/ })).toBeVisible();
  await page.getByLabel("Amount").last().fill("25.00");
  await page.getByLabel("Merchant", { exact: true }).fill("OpenAI");
  await page.getByRole("button", { name: "Authorize" }).click();
  await expect(page.getByRole("status")).toContainText("authorization recorded");
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByRole("status")).toContainText("capture completed");

  const expenses = await api<Row[]>(page, admin, "get", "/expenses");
  const expense = expenses.find((row) => row.status === "INCOMPLETE");
  expect(expense).toBeTruthy();
  await api(page, admin, "post", `/expenses/${expense!.id}/update-memo`, { memo: "Golden E2E receipt verified" });
  await api(page, admin, "post", `/expenses/${expense!.id}/submit`, {});
  await api(page, manager, "post", `/expenses/${expense!.id}/approve`, {});
  await page.goto("/app/accounting/card");
  await expect(page.getByRole("heading", { name: "Card accounting" })).toBeVisible();
  await expect(page.getByText("CARD_TRANSACTION").first()).toBeVisible();
});

test("B: bill approval, release, settlement, and accounting golden journey", async ({ page }) => {
  const treasury = await login(page, "treasury@acme.test");
  const [entities, vendors] = await Promise.all([
    api<Row[]>(page, treasury, "get", "/entities"),
    api<Row[]>(page, treasury, "get", "/vendors"),
  ]);
  const bill = await api<Row>(page, treasury, "post", "/bills", {
    vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber: `GOLD-${Date.now()}`,
    amount: "125.00", currency: "USD", memo: "Golden E2E bill",
  });
  const admin = await login(page, "admin@acme.test");
  await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  const payment = await api<Row>(page, treasury, "post", "/payments", {
    billId: bill.id, amount: "125.00", rail: "ACH", idempotencyKey: `golden-${Date.now()}`,
  });
  await api(page, admin, "post", `/payments/${payment.id}/release`, {});
  await api(page, admin, "post", `/payments/${payment.id}/confirm-settlement`, {});

  await page.goto(`/app/bill-pay/bills/${bill.id}`);
  await expect(page.getByRole("heading", { name: /Invoice GOLD-/ })).toBeVisible();
  await expect(page.getByText("PAID").first()).toBeVisible();
  await page.goto("/app/accounting/bill-pay");
  await expect(page.getByRole("heading", { name: "Bill Pay accounting" })).toBeVisible();
  await expect(page.getByText(/BILL|PAYMENT/).first()).toBeVisible();
});
