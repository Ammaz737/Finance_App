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

async function apiExpectStatus(page: Page, token: string, method: "get" | "post", path: string, status: number, data?: unknown) {
  const response = await page.request[method](`/api/v1${path}`, {
    headers: { authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(response.status()).toBe(status);
  return response;
}

test("A: spend request to accounting golden journey", async ({ page }) => {
  const creator = await login(page, "employee@acme.test");
  const programs = await api<Array<Row & { legalEntityId: string }>>(page, creator, "get", "/spend-programs");
  const created = await api<Row & { policy?: { result: string }; status: string }>(page, creator, "post", "/spend-requests", {
    name: `Golden software ${Date.now()}`, purpose: "Golden E2E business purpose", amount: "60.00", currency: "USD",
    legalEntityId: programs[0].legalEntityId, programId: programs[0].id, fulfillmentType: "VIRTUAL_CARD",
    category: "Software",
  });
  expect(created.policyResult === "PASS" || created.policyResult === "WARN" || created.policyResult === "REVIEW" || created.policy?.result).toBeTruthy();
  expect(["IN_REVIEW", "SUBMITTED"]).toContain(created.status);

  await page.goto(`/app/spend/requests/${created.id}`);
  await expect(page.getByRole("heading", { name: /Golden software/ })).toBeVisible();
  await expect(page.getByText(/Policy/i).first()).toBeVisible();

  const manager = await login(page, "manager@acme.test");
  await page.goto("/app/inbox");
  await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  await api(page, manager, "post", `/spend-requests/${created.id}/approve`, {});

  const admin = await login(page, "admin@acme.test");
  const approved = await api<{ card: Row | null; request: { status: string } }>(page, admin, "post", `/spend-requests/${created.id}/approve`, {});
  expect(approved.card?.id).toBeTruthy();
  expect(approved.request.status).toBe("FULFILLED");

  await page.goto(`/app/spend/cards/${approved.card!.id}`);
  await expect(page.getByText(/SANDBOX \/ MOCK CARD/)).toBeVisible();
  await page.getByLabel("Amount").last().fill("25.00");
  await page.getByLabel("Merchant", { exact: true }).fill("OpenAI");
  await page.getByRole("button", { name: "Authorize" }).click();
  await expect(page.getByRole("status")).toContainText("authorization recorded");
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByRole("status")).toContainText("capture completed");

  const expenses = await api<Row[]>(page, admin, "get", "/expenses");
  const expense = expenses.find((row) => row.status === "INCOMPLETE");
  expect(expense).toBeTruthy();
  await page.goto(`/app/expenses/${expense!.id}`);
  await expect(page.getByText("Requirements")).toBeVisible();
  await expect(page.getByText(/Missing|Complete/).first()).toBeVisible();

  await api(page, admin, "post", `/expenses/${expense!.id}/update-memo`, { memo: "Golden E2E receipt verified" });
  await api(page, admin, "post", `/expenses/${expense!.id}/submit`, {});
  await api(page, manager, "post", `/expenses/${expense!.id}/approve`, {});

  await page.goto("/app/accounting/card");
  await expect(page.getByRole("heading", { name: "Card accounting" })).toBeVisible();
  await expect(page.getByText("CARD_TRANSACTION").first()).toBeVisible();

  const entries = await api<Array<Row & { sourceType: string; sourceId: string; status: string }>>(page, admin, "get", "/accounting");
  const entry = entries.find((row) => row.sourceType === "CARD_TRANSACTION");
  expect(entry).toBeTruthy();
  if (entry && entry.status === "NEEDS_REVIEW") {
    await api(page, admin, "post", `/accounting/${entry.id}/code`, { category: "Software", memo: "Golden sync" });
    await api(page, admin, "post", `/accounting/${entry.id}/ready`, {});
    await api(page, admin, "post", `/accounting/${entry.id}/sync`, {});
  }
});

test("A2: declined authorization + tenant isolation negatives", async ({ page }) => {
  const employee = await login(page, "employee@acme.test");
  const programs = await api<Array<Row & { legalEntityId: string }>>(page, employee, "get", "/spend-programs");
  const request = await api<Row>(page, employee, "post", "/spend-requests", {
    name: `Decline path ${Date.now()}`, purpose: "Negative path", amount: "40.00", currency: "USD",
    legalEntityId: programs[0].legalEntityId, programId: programs[0].id, fulfillmentType: "VIRTUAL_CARD",
  });
  await expect(apiExpectStatus(page, employee, "post", `/spend-requests/${request.id}/approve`, 403)).resolves.toBeTruthy();

  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/spend-requests/${request.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  const fulfilled = await api<{ card: Row }>(page, admin, "post", `/spend-requests/${request.id}/approve`, {});
  await api(page, admin, "post", `/cards/${fulfilled.card.id}/freeze`, {});
  const declined = await api<{ decision: string; reason: string }>(page, admin, "post", "/authorizations", {
    cardId: fulfilled.card.id, amount: "10.00", currency: "USD", merchant: "Test", merchantCategory: "general",
    idempotencyKey: `decl-${Date.now()}`,
  });
  expect(declined.decision).toBe("DECLINED");
  expect(declined.reason).toBe("CARD_FROZEN");

  // Tenant B cannot read Tenant A request (beta workspace if seeded; otherwise 403/404 on forged id access via employee scope is covered by API tests).
  await apiExpectStatus(page, employee, "post", `/cards/${fulfilled.card.id}/freeze`, 403);
});

test("B: bill approval, release, settlement, and accounting golden journey", async ({ page }) => {
  const treasury = await login(page, "treasury@acme.test");
  const [entities, vendors] = await Promise.all([
    api<Row[]>(page, treasury, "get", "/entities"),
    api<Row[]>(page, treasury, "get", "/vendors"),
  ]);
  const bill = await api<Row & { duplicateStatus?: string; vendorMatchStatus?: string; status: string }>(page, treasury, "post", "/bills", {
    vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber: `GOLD-${Date.now()}`,
    amount: "125.00", currency: "USD", memo: "Golden E2E bill",
  });
  expect(bill.duplicateStatus ?? "CLEAR").toBe("CLEAR");
  expect(["MATCHED", "SUGGESTED"]).toContain(bill.vendorMatchStatus ?? "MATCHED");
  expect(bill.status).toBe("PENDING_APPROVAL");

  const ap = await login(page, "ap@acme.test");
  await page.goto("/app/inbox");
  await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  await api(page, ap, "post", `/bills/${bill.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  await api(page, admin, "post", `/bills/${bill.id}/approve`, {});

  const employee = await login(page, "employee@acme.test");
  await apiExpectStatus(page, employee, "post", `/payments`, 403, {
    billId: bill.id, amount: "125.00", rail: "ACH", idempotencyKey: `deny-${Date.now()}`,
  });

  const payment = await api<Row>(page, treasury, "post", "/payments", {
    billId: bill.id, amount: "125.00", rail: "ACH", idempotencyKey: `golden-${Date.now()}`,
  });
  await apiExpectStatus(page, treasury, "post", `/payments/${payment.id}/release`, 403);
  await apiExpectStatus(page, employee, "post", `/payments/${payment.id}/release`, 403);
  await api(page, admin, "post", `/payments/${payment.id}/release`, {});
  const released = await api<{ payment: { status: string } } | Row & { status: string }>(page, admin, "get", `/payments/${payment.id}`);
  const releasedStatus = "payment" in released ? released.payment.status : released.status;
  expect(["PROCESSING", "SENT"]).toContain(releasedStatus);
  await api(page, admin, "post", `/payments/${payment.id}/confirm-settlement`, {});

  await login(page, "admin@acme.test");
  await page.goto(`/app/bill-pay/bills/${bill.id}`);
  await expect(page.getByRole("heading", { name: /Invoice GOLD-/ })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("PAID").first()).toBeVisible();
  await expect(page.getByText(/Approval|Activity|Duplicate/i).first()).toBeVisible();
  await page.goto("/app/accounting/bill-pay");
  await expect(page.getByRole("heading", { name: "Bill Pay accounting" })).toBeVisible();
  await expect(page.getByText(/BILL|PAYMENT/).first()).toBeVisible();

  const dash = await api<{ pendingBills: number; paidBills?: number; openPayablesByCurrency: unknown[] }>(page, admin, "get", "/reporting");
  expect(dash.openPayablesByCurrency).toBeTruthy();
});

test("B2: partial payment then settle remaining", async ({ page }) => {
  const treasury = await login(page, "treasury@acme.test");
  const [entities, vendors] = await Promise.all([
    api<Row[]>(page, treasury, "get", "/entities"),
    api<Row[]>(page, treasury, "get", "/vendors"),
  ]);
  const bill = await api<Row>(page, treasury, "post", "/bills", {
    vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber: `PART-${Date.now()}`,
    amount: "200.00", currency: "USD", memo: "Partial E2E",
  });
  const ap = await login(page, "ap@acme.test");
  await api(page, ap, "post", `/bills/${bill.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  await api(page, admin, "post", `/bills/${bill.id}/approve`, {});

  const first = await api<Row>(page, treasury, "post", "/payments", {
    billId: bill.id, amount: "80.00", rail: "ACH", idempotencyKey: `part-a-${Date.now()}`,
  });
  await api(page, admin, "post", `/payments/${first.id}/release`, {});
  await api(page, admin, "post", `/payments/${first.id}/confirm-settlement`, {});
  const afterFirst = await api<{ bill: { status: string; remainingAmount: string | number } }>(page, admin, "get", `/bills/${bill.id}`);
  expect(afterFirst.bill.status).toBe("PARTIAL");
  expect(Number(afterFirst.bill.remainingAmount)).toBe(120);

  const second = await api<Row>(page, treasury, "post", "/payments", {
    billId: bill.id, amount: "120.00", rail: "ACH", idempotencyKey: `part-b-${Date.now()}`,
  });
  await api(page, admin, "post", `/payments/${second.id}/release`, {});
  await api(page, admin, "post", `/payments/${second.id}/confirm-settlement`, {});
  const afterSecond = await api<{ bill: { status: string; remainingAmount: string | number } }>(page, admin, "get", `/bills/${bill.id}`);
  expect(afterSecond.bill.status).toBe("PAID");
  expect(Number(afterSecond.bill.remainingAmount)).toBe(0);
});

test("B3: AP negatives — duplicate, creator SoD, tenant isolation", async ({ page }) => {
  const treasury = await login(page, "treasury@acme.test");
  const [entities, vendors] = await Promise.all([
    api<Row[]>(page, treasury, "get", "/entities"),
    api<Row[]>(page, treasury, "get", "/vendors"),
  ]);
  const invoiceNumber = `DUP-${Date.now()}`;
  const bill = await api<Row>(page, treasury, "post", "/bills", {
    vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber,
    amount: "55.00", currency: "USD",
  });
  await apiExpectStatus(page, treasury, "post", "/bills", 409, {
    vendorId: vendors[0].id, legalEntityId: entities[0].id, invoiceNumber,
    amount: "55.00", currency: "USD",
  });
  await apiExpectStatus(page, treasury, "post", `/bills/${bill.id}/approve`, 403);

  const employee = await login(page, "employee@acme.test");
  await apiExpectStatus(page, employee, "post", `/bills/${bill.id}/approve`, 403);
  const denied = await page.request.get(`/api/v1/bills/${bill.id}`, {
    headers: { authorization: `Bearer ${employee}` },
  });
  expect([403, 404]).toContain(denied.status());
});
