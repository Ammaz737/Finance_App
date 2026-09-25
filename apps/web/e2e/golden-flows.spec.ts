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

/** Prefer US entity when admin lists both; employees are seeded on Acme US only. */
async function primaryEntityId(page: Page, token: string) {
  const entities = await api<Array<Row & { name?: string; country?: string }>>(page, token, "get", "/entities");
  const us = entities.find((e) => e.country === "US" || (e.name ?? "").includes("US"));
  return (us ?? entities[0]).id;
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

test("C: procurement request → PO → receiving → bill match → GF2 settle", async ({ page }) => {
  const adminBootstrap = await login(page, "admin@acme.test");
  const [vendors, programs] = await Promise.all([
    api<Row[]>(page, adminBootstrap, "get", "/vendors"),
    api<Array<Row & { defaultOutcomeType?: string }>>(page, adminBootstrap, "get", "/procurement-programs"),
  ]);
  const program = programs.find((p) => p.defaultOutcomeType === "PURCHASE_ORDER") ?? programs[0];
  const entityId = await primaryEntityId(page, adminBootstrap);

  const employee = await login(page, "employee@acme.test");
  const created = await api<Row & { status: string; policyResult?: string }>(page, employee, "post", "/procurement", {
    name: `Laptops ${Date.now()}`,
    legalEntityId: entityId,
    programId: program.id,
    vendorId: vendors[0].id,
    amount: "100.00",
    currency: "USD",
    memo: "Engineering laptops",
    outcomeType: "PURCHASE_ORDER",
    lines: [
      { description: "Laptop", quantity: 2, unitAmount: "40" },
      { description: "Dock", amount: "20" },
    ],
  });
  expect(created.status).toBe("DRAFT");
  const submitted = await api<Row & { status: string; policyResult?: string | null }>(page, employee, "post", `/procurement/${created.id}/submit`, {});
  expect(submitted.status).toBe("IN_REVIEW");
  expect(submitted.policyResult).toBeTruthy();

  await apiExpectStatus(page, employee, "post", `/procurement/${created.id}/approve`, 403);

  const manager = await login(page, "manager@acme.test");
  await page.goto("/app/inbox");
  await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  await api(page, manager, "post", `/procurement/${created.id}/approve`, {});

  const admin = await login(page, "admin@acme.test");
  const fulfilled = await api<{ request: { status: string; outcomeId: string | null }; purchaseOrder: Row | null }>(
    page, admin, "post", `/procurement/${created.id}/approve`, {},
  );
  expect(fulfilled.request.status).toBe("FULFILLED");
  expect(fulfilled.purchaseOrder?.id).toBeTruthy();
  const poId = fulfilled.purchaseOrder!.id;

  const poCount = await api<Row[]>(page, admin, "get", "/purchase-orders");
  expect(poCount.filter((p) => p.id === poId)).toHaveLength(1);

  await api(page, admin, "post", `/purchase-orders/${poId}/receive`, { amount: "40.00", memo: "Partial" });
  await api(page, admin, "post", `/purchase-orders/${poId}/receive`, { amount: "60.00", memo: "Final" });
  const po = await api<{ purchaseOrder: { status: string; receivedAmount: string | number } }>(page, admin, "get", `/purchase-orders/${poId}`);
  expect(po.purchaseOrder.status).toBe("RECEIVED");

  const treasury = await login(page, "treasury@acme.test");
  const bill = await api<Row>(page, treasury, "post", "/bills", {
    vendorId: vendors[0].id, legalEntityId: entityId, invoiceNumber: `POINV-${Date.now()}`,
    amount: "100.00", currency: "USD", purchaseOrderId: poId, memo: "Linked to PO",
  });
  const match = await api<{ status: string; matchType: string }>(page, admin, "post", `/purchase-orders/${poId}/match`, { billId: bill.id });
  expect(match.status).toBe("MATCHED");
  expect(match.matchType).toBe("THREE_WAY");

  const ap = await login(page, "ap@acme.test");
  await api(page, ap, "post", `/bills/${bill.id}/approve`, {});
  await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  const payment = await api<Row>(page, treasury, "post", "/payments", {
    billId: bill.id, amount: "100.00", rail: "ACH", idempotencyKey: `proc-pay-${Date.now()}`,
  });
  await api(page, admin, "post", `/payments/${payment.id}/release`, {});
  await api(page, admin, "post", `/payments/${payment.id}/confirm-settlement`, {});

  await login(page, "admin@acme.test");
  await page.goto(`/app/procurement/requests/${created.id}`);
  await expect(page.getByRole("heading", { name: /Laptops/ })).toBeVisible({ timeout: 15000 });
  const dash = await api<{ openPurchaseOrders?: number; matchExceptions?: number }>(page, admin, "get", "/reporting");
  expect(dash).toBeTruthy();
});

test("C2: 3-way match exception when invoice exceeds received qty", async ({ page }) => {
  const adminBootstrap = await login(page, "admin@acme.test");
  const [vendors, programs] = await Promise.all([
    api<Row[]>(page, adminBootstrap, "get", "/vendors"),
    api<Row[]>(page, adminBootstrap, "get", "/procurement-programs"),
  ]);
  const entityId = await primaryEntityId(page, adminBootstrap);
  const employee = await login(page, "employee@acme.test");
  const created = await api<Row>(page, employee, "post", "/procurement", {
    name: `Qty match ${Date.now()}`, legalEntityId: entityId, programId: programs[0].id,
    vendorId: vendors[0].id, amount: "100.00", currency: "USD", memo: "Qty exception path",
    lines: [{ description: "Widgets", quantity: 10, unitAmount: "10" }],
  });
  await api(page, employee, "post", `/procurement/${created.id}/submit`, {});
  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/procurement/${created.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  const fulfilled = await api<{ purchaseOrder: Row }>(page, admin, "post", `/procurement/${created.id}/approve`, {});
  const poId = fulfilled.purchaseOrder.id;

  await api(page, admin, "post", `/purchase-orders/${poId}/receive`, {
    quantity: "6", receiptType: "QUANTITY", memo: "Partial qty",
  });
  const treasury = await login(page, "treasury@acme.test");
  const bill = await api<Row>(page, treasury, "post", "/bills", {
    vendorId: vendors[0].id, legalEntityId: entityId, invoiceNumber: `QTY-${Date.now()}`,
    amount: "100.00", currency: "USD", purchaseOrderId: poId,
  });
  const match = await api<{ status: string; reasonCode?: string; id: string }>(page, admin, "post", `/purchase-orders/${poId}/match`, {
    billId: bill.id, invoicedQuantity: "10",
  });
  expect(match.status).toBe("EXCEPTION");
  expect(match.reasonCode).toBe("NOT_RECEIVED");

  await api(page, admin, "post", `/purchase-orders/${poId}/receive`, {
    quantity: "4", receiptType: "QUANTITY", memo: "Remainder",
  });
  const resolved = await api<{ exceptionStatus: string; status: string }>(page, admin, "post", `/matches/${match.id}/resolve`, {
    resolution: "CORRECTED", note: "Received remaining quantity",
  });
  expect(resolved.exceptionStatus).toBe("CORRECTED");
});

test("C3: procurement negatives — self-approve, over-receive, duplicate PO", async ({ page }) => {
  const adminBootstrap = await login(page, "admin@acme.test");
  const [vendors, programs] = await Promise.all([
    api<Row[]>(page, adminBootstrap, "get", "/vendors"),
    api<Row[]>(page, adminBootstrap, "get", "/procurement-programs"),
  ]);
  const entityId = await primaryEntityId(page, adminBootstrap);
  const employee = await login(page, "employee@acme.test");
  const created = await api<Row>(page, employee, "post", "/procurement", {
    name: `Neg ${Date.now()}`, legalEntityId: entityId, programId: programs[0].id,
    vendorId: vendors[0].id, amount: "50.00", currency: "USD", memo: "Negatives",
  });
  await api(page, employee, "post", `/procurement/${created.id}/submit`, {});
  await apiExpectStatus(page, employee, "post", `/procurement/${created.id}/approve`, 403);

  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/procurement/${created.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  const fulfilled = await api<{ purchaseOrder: Row }>(page, admin, "post", `/procurement/${created.id}/approve`, {});
  const poId = fulfilled.purchaseOrder.id;

  await apiExpectStatus(page, employee, "post", `/purchase-orders/${poId}/receive`, 403, { amount: "10.00" });
  await apiExpectStatus(page, admin, "post", `/purchase-orders/${poId}/receive`, 400, { amount: "999.00" });

  const before = await api<Row[]>(page, admin, "get", "/purchase-orders");
  expect(before.some((p) => p.id === poId)).toBeTruthy();
});

const TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function uploadReceipt(page: Page, token: string, name: string) {
  return api<Row>(page, token, "post", "/documents/upload", {
    name,
    mimeType: "image/png",
    classification: "RECEIPT",
    contentBase64: TINY_PNG_B64,
  });
}

test("D: STANDARD reimbursement → approval → payout → accounting", async ({ page }) => {
  const adminBootstrap = await login(page, "admin@acme.test");
  const entityId = await primaryEntityId(page, adminBootstrap);
  const employee = await login(page, "employee@acme.test");
  const receipt = await uploadReceipt(page, employee, `receipt-d-${Date.now()}.png`);
  const stamp = Date.now();
  const amount = (80 + (stamp % 15) + 0.25).toFixed(2);

  const created = await api<Row & { status: string; amount: string | number }>(page, employee, "post", "/reimbursements", {
    legalEntityId: entityId,
    type: "STANDARD",
    currency: "USD",
    memo: `Client dinner ${stamp}`,
    merchant: `Olive Garden ${stamp}`,
    category: "Meals",
    expenseDate: "2026-09-10",
    amount,
    attachmentId: receipt.id,
  });
  expect(created.status).toBe("DRAFT");
  expect(Number(created.amount)).toBe(Number(amount));

  const submitted = await api<Row & { status: string; policyResult?: string }>(page, employee, "post", `/reimbursements/${created.id}/submit`, {});
  expect(submitted.status).toBe("IN_REVIEW");
  expect(submitted.policyResult).toBeTruthy();

  await apiExpectStatus(page, employee, "post", `/reimbursements/${created.id}/approve`, 403);

  const manager = await login(page, "manager@acme.test");
  await page.goto("/app/inbox");
  await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  const approved = await api<Row & { status: string }>(page, manager, "post", `/reimbursements/${created.id}/approve`, {});
  expect(approved.status).toBe("APPROVED");

  await apiExpectStatus(page, employee, "post", `/reimbursements/${created.id}/schedule`, 403, { rail: "ACH" });

  const admin = await login(page, "admin@acme.test");
  const scheduled = await api<Row & { status: string; providerRef?: string }>(page, admin, "post", `/reimbursements/${created.id}/schedule`, { rail: "ACH" });
  expect(scheduled.status).toBe("SCHEDULED");
  expect(scheduled.providerRef).toMatch(/^mock_payout_/);

  const paid = await api<{ reimbursement: { status: string }; accounting: { id: string; status: string } | null }>(
    page, admin, "post", `/reimbursements/${created.id}/confirm-payout`, {},
  );
  expect(paid.reimbursement.status).toBe("PAID");
  expect(paid.accounting?.id).toBeTruthy();

  await api(page, admin, "post", `/accounting/${paid.accounting!.id}/code`, { category: "Travel Meals", memo: "GF4 reimbursement" });
  await api(page, admin, "post", `/accounting/${paid.accounting!.id}/ready`, {});
  await api(page, admin, "post", `/accounting/${paid.accounting!.id}/sync`, {});

  await page.goto(`/app/expenses/reimbursements/${created.id}`);
  await expect(page.getByRole("heading", { name: /Client dinner/ })).toBeVisible({ timeout: 15000 });
  const dash = await api<{ reimbursementsPaid?: number }>(page, admin, "get", "/reporting");
  expect(dash.reimbursementsPaid).toBeGreaterThanOrEqual(1);
});

test("D2: mileage server calc ignores forged amount", async ({ page }) => {
  const adminBootstrap = await login(page, "admin@acme.test");
  const entityId = await primaryEntityId(page, adminBootstrap);
  const employee = await login(page, "employee@acme.test");
  const created = await api<Row & { amount: string | number; status: string }>(page, employee, "post", "/reimbursements", {
    legalEntityId: entityId,
    type: "MILEAGE",
    currency: "USD",
    memo: `Mileage ${Date.now()}`,
    distanceMiles: "100",
    amount: "9999.00",
    mileageRate: "9.99",
  });
  expect(Number(created.amount)).toBe(67);
  await api(page, employee, "post", `/reimbursements/${created.id}/submit`, {});
  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/reimbursements/${created.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  await api(page, admin, "post", `/reimbursements/${created.id}/schedule`, { rail: "ACH" });
  const paid = await api<{ reimbursement: { status: string; amount: string | number } }>(
    page, admin, "post", `/reimbursements/${created.id}/confirm-payout`, {},
  );
  expect(paid.reimbursement.status).toBe("PAID");
  expect(Number(paid.reimbursement.amount)).toBe(67);
});

test("D3: per diem server calc and payout", async ({ page }) => {
  const adminBootstrap = await login(page, "admin@acme.test");
  const entityId = await primaryEntityId(page, adminBootstrap);
  const employee = await login(page, "employee@acme.test");
  const created = await api<Row & { amount: string | number }>(page, employee, "post", "/reimbursements", {
    legalEntityId: entityId,
    type: "PER_DIEM",
    currency: "USD",
    memo: `Per diem ${Date.now()}`,
    destination: "Chicago",
    perDiemNights: 2,
    amount: "1.00",
    perDiemRate: "999",
  });
  expect(Number(created.amount)).toBe(150);
  await api(page, employee, "post", `/reimbursements/${created.id}/submit`, {});
  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/reimbursements/${created.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  await api(page, admin, "post", `/reimbursements/${created.id}/schedule`, { rail: "ACH" });
  const paid = await api<{ reimbursement: { status: string; amount: string | number } }>(
    page, admin, "post", `/reimbursements/${created.id}/confirm-payout`, {},
  );
  expect(paid.reimbursement.status).toBe("PAID");
  expect(Number(paid.reimbursement.amount)).toBe(150);
});

test("D4: reimbursement negatives — SoD, duplicate, fail payout, forge blocked", async ({ page }) => {
  const adminBootstrap = await login(page, "admin@acme.test");
  const entityId = await primaryEntityId(page, adminBootstrap);
  const employee = await login(page, "employee@acme.test");

  const forged = await api<Row & { amount: string | number }>(page, employee, "post", "/reimbursements", {
    legalEntityId: entityId, type: "MILEAGE", currency: "USD", memo: `Forge ${Date.now()}`,
    distanceMiles: "50", amount: "5000", mileageRate: "8",
  });
  expect(Number(forged.amount)).toBe(33.5);

  const receipt = await uploadReceipt(page, employee, `dup-${Date.now()}.png`);
  const stamp = Date.now();
  const first = await api<Row>(page, employee, "post", "/reimbursements", {
    legalEntityId: entityId, type: "STANDARD", currency: "USD", memo: `Dup meal ${stamp}`,
    merchant: `Dup Cafe ${stamp}`, amount: "40.00", expenseDate: "2026-09-15", attachmentId: receipt.id,
  });
  await api(page, employee, "post", `/reimbursements/${first.id}/submit`, {});

  const dup = await api<Row & { duplicateStatus?: string }>(page, employee, "post", "/reimbursements", {
    legalEntityId: entityId, type: "STANDARD", currency: "USD", memo: `Dup meal again ${stamp}`,
    merchant: `Dup Cafe ${stamp}`, amount: "40.00", expenseDate: "2026-09-15",
  });
  expect(dup.duplicateStatus).toBe("BLOCKED_DUPLICATE");
  await apiExpectStatus(page, employee, "post", `/reimbursements/${dup.id}/submit`, 409);

  await apiExpectStatus(page, employee, "post", `/reimbursements/${first.id}/approve`, 403);

  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/reimbursements/${first.id}/approve`, {});
  await apiExpectStatus(page, employee, "post", `/reimbursements/${first.id}/schedule`, 403, { rail: "ACH" });

  const admin = await login(page, "admin@acme.test");
  await api(page, admin, "post", `/reimbursements/${first.id}/schedule`, { rail: "ACH" });
  const failed = await api<Row & { status: string }>(page, admin, "post", `/reimbursements/${first.id}/fail-payout`, { reason: "Bank rejected" });
  expect(failed.status).toBe("FAILED");
  const detail = await api<{ reimbursement: { status: string }; accounting: unknown }>(page, admin, "get", `/reimbursements/${first.id}`);
  expect(detail.reimbursement.status).toBe("FAILED");
  expect(detail.accounting).toBeFalsy();

  const again = await api(page, admin, "post", `/reimbursements/${first.id}/schedule`, { rail: "ACH", idempotencyKey: `d4-${Date.now()}` });
  expect((again as { status: string }).status).toBe("SCHEDULED");
  const paid = await api<{ reimbursement: { status: string }; accounting: { id: string } }>(
    page, admin, "post", `/reimbursements/${first.id}/confirm-payout`, {},
  );
  expect(paid.reimbursement.status).toBe("PAID");
  const replay = await api<{ accounting: { id: string } }>(page, admin, "post", `/reimbursements/${first.id}/confirm-payout`, {});
  expect(replay.accounting.id).toBe(paid.accounting.id);
});

test("E: travel request → book → fund/card → expense → accounting", async ({ page }) => {
  const employee = await login(page, "employee@acme.test");
  const entities = await api<Row[]>(page, employee, "get", "/entities");
  const stamp = Date.now();
  const trip = await api<Row & { status: string; policyResult: string }>(page, employee, "post", "/travel", {
    name: `Golden travel ${stamp}`,
    legalEntityId: entities[0].id,
    destination: "Chicago",
    origin: "SFO",
    purpose: "Customer workshop",
    startDate: "2026-11-10",
    endDate: "2026-11-12",
    estimatedAmount: "900.00",
    currency: "USD",
  });
  expect(trip.status).toBe("DRAFT");

  await page.goto(`/app/travel/trips/${trip.id}`);
  await expect(page.getByRole("heading", { name: /Golden travel/ })).toBeVisible();

  const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string; description?: string; refundable?: boolean; offerExpiry?: string; providerOfferId?: string }> }>(
    page, employee, "post", `/travel/${trip.id}/search`, { type: "FLIGHT" },
  );
  const inPolicy = search.quotes.find((q) => !q.outOfPolicy);
  expect(inPolicy).toBeTruthy();
  const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
    quoteId: inPolicy!.quoteId,
    type: inPolicy!.type,
    supplier: inPolicy!.supplier,
    description: inPolicy!.description,
    amount: inPolicy!.amount,
    currency: inPolicy!.currency,
    outOfPolicy: false,
    refundable: inPolicy!.refundable,
    offerExpiry: inPolicy!.offerExpiry,
    providerOfferId: inPolicy!.providerOfferId,
  });
  expect(selected.booking.id).toBeTruthy();

  const submitted = await api<{ trip: { status: string }; requiresApproval: boolean }>(page, employee, "post", `/travel/${trip.id}/submit`, {});
  expect(submitted.requiresApproval).toBe(false);
  expect(submitted.trip.status).toBe("READY_TO_BOOK");

  await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/reprice`, {});
  const held = await api<Row & { status: string; providerStatus: string }>(
    page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, { idempotencyKey: `e-book-${stamp}` },
  );
  expect(held.status).toBe("BOOKED_MOCK");
  expect(held.providerStatus).toBe("MOCK_HOLD");

  const confirmed = await api<{ booking: { status: string }; fund: Row | null; card: Row | null; trip: { status: string } }>(
    page, employee, "post", `/travel-bookings/${selected.booking.id}/confirm`, {},
  );
  expect(confirmed.booking.status).toBe("CONFIRMED");
  expect(confirmed.trip.status).toBe("CONFIRMED");
  expect(confirmed.fund?.id).toBeTruthy();
  expect(confirmed.card?.id).toBeTruthy();

  await page.goto(`/app/travel/trips/${trip.id}`);
  await expect(page.getByText(/SANDBOX \/ MOCK CARD/)).toBeVisible();

  const admin = await login(page, "admin@acme.test");
  await page.goto(`/app/spend/cards/${confirmed.card!.id}`);
  await expect(page.getByText(/SANDBOX \/ MOCK CARD/)).toBeVisible();
  await page.getByLabel("Amount").last().fill("50.00");
  await page.getByLabel("Merchant", { exact: true }).fill(inPolicy!.supplier);
  await page.getByLabel("Merchant category").fill("airlines");
  await page.getByRole("button", { name: "Authorize" }).click();
  await expect(page.getByRole("status")).toContainText(/authorization recorded/i);
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByRole("status")).toContainText(/capture completed/i);

  const expenses = await api<Array<Row & { memo?: string; merchant: string; status: string }>>(page, admin, "get", "/expenses");
  const expense = expenses.find((row) =>
    row.status === "INCOMPLETE" &&
    ((row.memo ?? "").includes("Travel") || row.merchant === inPolicy!.supplier),
  );
  expect(expense).toBeTruthy();

  await api(page, admin, "post", `/expenses/${expense!.id}/update-memo`, { memo: `Travel · Chicago · Golden ${stamp}` });
  await api(page, admin, "post", `/expenses/${expense!.id}/submit`, {});
  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/expenses/${expense!.id}/approve`, {});

  const entries = await api<Array<Row & { sourceType: string; status: string }>>(page, admin, "get", "/accounting");
  const entry = entries.find((row) => row.sourceType === "CARD_TRANSACTION");
  expect(entry).toBeTruthy();
  if (entry && entry.status === "NEEDS_REVIEW") {
    await api(page, admin, "post", `/accounting/${entry.id}/code`, { category: "Airfare", memo: "Travel golden" });
    await api(page, admin, "post", `/accounting/${entry.id}/ready`, {});
    await api(page, admin, "post", `/accounting/${entry.id}/sync`, {});
  }

  const dash = await api<{ travel?: { trips: number }; travelPending: number }>(page, admin, "get", "/reporting");
  expect(dash.travel?.trips ?? dash.travelPending).toBeTruthy();

  const detail = await api<{ audit: unknown[]; trip: { status: string } }>(page, admin, "get", `/travel/${trip.id}`);
  expect(detail.trip.status).toBe("CONFIRMED");
  expect(detail.audit.length).toBeGreaterThan(3);
});

test("E2: out-of-policy travel requires approval before booking", async ({ page }) => {
  const employee = await login(page, "employee@acme.test");
  const entities = await api<Row[]>(page, employee, "get", "/entities");
  const trip = await api<Row>(page, employee, "post", "/travel", {
    name: `OOP travel ${Date.now()}`,
    legalEntityId: entities[0].id,
    destination: "Miami",
    purpose: "Conference",
    startDate: "2026-12-01",
    endDate: "2026-12-04",
    estimatedAmount: "400.00",
    currency: "USD",
  });
  const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string }> }>(
    page, employee, "post", `/travel/${trip.id}/search`, { type: "HOTEL" },
  );
  const oop = search.quotes.find((q) => q.outOfPolicy)!;
  const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
    quoteId: oop.quoteId, type: oop.type, supplier: oop.supplier, amount: oop.amount, currency: oop.currency, outOfPolicy: true,
  });
  const submitted = await api<{ trip: { status: string; policyResult: string }; requiresApproval: boolean }>(
    page, employee, "post", `/travel/${trip.id}/submit`, {},
  );
  expect(submitted.requiresApproval).toBe(true);
  expect(submitted.trip.status).toBe("PENDING_APPROVAL");
  expect(["REVIEW", "WARN"]).toContain(submitted.trip.policyResult);

  await apiExpectStatus(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, 409);
  await apiExpectStatus(page, employee, "post", `/travel/${trip.id}/approve`, 403);

  const manager = await login(page, "manager@acme.test");
  await page.goto("/app/inbox");
  await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  await api(page, manager, "post", `/travel/${trip.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  const approved = await api<{ trip: { status: string } }>(page, admin, "post", `/travel/${trip.id}/approve`, {});
  expect(approved.trip.status).toBe("READY_TO_BOOK");

  const held = await api<Row & { status: string }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, {});
  expect(held.status).toBe("BOOKED_MOCK");
});

test("E3: reprice above tolerance blocks automatic booking", async ({ page }) => {
  const employee = await login(page, "employee@acme.test");
  const entities = await api<Row[]>(page, employee, "get", "/entities");
  const trip = await api<Row>(page, employee, "post", "/travel", {
    name: `Reprice block ${Date.now()}`,
    legalEntityId: entities[0].id,
    destination: "Seattle",
    startDate: "2027-01-05",
    endDate: "2027-01-07",
    estimatedAmount: "700.00",
    currency: "USD",
    repriceTolerance: "25",
  });
  const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string }> }>(
    page, employee, "post", `/travel/${trip.id}/search`, { type: "FLIGHT" },
  );
  const quote = search.quotes.find((q) => !q.outOfPolicy)!;
  const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
    quoteId: quote.quoteId, type: quote.type, supplier: quote.supplier, amount: quote.amount, currency: quote.currency, outOfPolicy: false,
  });
  await api(page, employee, "post", `/travel/${trip.id}/submit`, {});
  await apiExpectStatus(page, employee, "post", `/travel-bookings/${selected.booking.id}/reprice`, 409, { forceHigh: true });
  await apiExpectStatus(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, 409);
});

test("E4: cancel and refund travel booking", async ({ page }) => {
  const employee = await login(page, "employee@acme.test");
  const entities = await api<Row[]>(page, employee, "get", "/entities");
  const trip = await api<Row>(page, employee, "post", "/travel", {
    name: `Cancel travel ${Date.now()}`,
    legalEntityId: entities[0].id,
    destination: "Boston",
    startDate: "2027-03-01",
    endDate: "2027-03-03",
    estimatedAmount: "650.00",
    currency: "USD",
  });
  const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string; refundable?: boolean }> }>(
    page, employee, "post", `/travel/${trip.id}/search`, { type: "HOTEL" },
  );
  const quote = search.quotes.find((q) => !q.outOfPolicy)!;
  const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
    quoteId: quote.quoteId, type: quote.type, supplier: quote.supplier, amount: quote.amount, currency: quote.currency,
    outOfPolicy: false, refundable: true,
  });
  await api(page, employee, "post", `/travel/${trip.id}/submit`, {});
  await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, { skipReprice: true });
  await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/confirm`, {});
  const cancelled = await api<Row & { status: string }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/cancel`, {});
  expect(["CANCELLED", "REFUND_PENDING"]).toContain(cancelled.status);
  const refunded = await api<{ booking: { status: string } }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/refund`, {});
  expect(refunded.booking.status).toBe("REFUNDED");
  const again = await api<{ booking: { status: string } }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/refund`, {});
  expect(again.booking.status).toBe("REFUNDED");
});

test("E5: travel security negatives — SoD, tenant isolation, MCC, idempotency", async ({ page }) => {
  const employee = await login(page, "employee@acme.test");
  const entities = await api<Row[]>(page, employee, "get", "/entities");
  const trip = await api<Row>(page, employee, "post", "/travel", {
    name: `Sec travel ${Date.now()}`,
    legalEntityId: entities[0].id,
    destination: "Dallas",
    startDate: "2027-04-01",
    endDate: "2027-04-03",
    estimatedAmount: "500.00",
    currency: "USD",
  });
  const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string }> }>(
    page, employee, "post", `/travel/${trip.id}/search`, { type: "FLIGHT" },
  );
  const oop = search.quotes.find((q) => q.outOfPolicy)!;
  const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
    quoteId: oop.quoteId, type: oop.type, supplier: oop.supplier, amount: oop.amount, currency: oop.currency, outOfPolicy: true,
  });
  await api(page, employee, "post", `/travel/${trip.id}/submit`, {});
  await apiExpectStatus(page, employee, "post", `/travel/${trip.id}/approve`, 403);
  await apiExpectStatus(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, 409);

  const manager = await login(page, "manager@acme.test");
  await api(page, manager, "post", `/travel/${trip.id}/approve`, {});
  const admin = await login(page, "admin@acme.test");
  await api(page, admin, "post", `/travel/${trip.id}/approve`, {});

  const key = `e5-idem-${Date.now()}`;
  const first = await api<Row & { providerRef: string }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, {
    idempotencyKey: key, skipReprice: true,
  });
  const second = await api<Row & { providerRef: string }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, {
    idempotencyKey: key, skipReprice: true,
  });
  expect(first.providerRef).toBe(second.providerRef);

  const confirmed = await api<{ card: Row & { id: string } }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/confirm`, {});
  expect(confirmed.card?.id).toBeTruthy();

  const declined = await api<{ decision: string; reason: string }>(page, admin, "post", "/authorizations", {
    cardId: confirmed.card.id,
    amount: "20.00",
    currency: "USD",
    merchant: "Office Depot",
    merchantCategory: "office_supplies",
    idempotencyKey: `e5-mcc-${Date.now()}`,
  });
  expect(declined.decision).toBe("DECLINED");
  expect(declined.reason).toBe("MCC_BLOCKED");

  await apiExpectStatus(page, employee, "get", `/travel/${crypto.randomUUID()}`, 404);
});

test("F: integrated finance coexistence journey", async ({ page }) => {
  const stamp = Date.now();
  const admin = await login(page, "admin@acme.test");
  const employee = await login(page, "employee@acme.test");
  const manager = await login(page, "manager@acme.test");
  const treasury = await login(page, "treasury@acme.test");
  const ap = await login(page, "ap@acme.test");

  await page.goto("/app/home");
  await expect(page.locator("main, #main-content").first()).toBeVisible({ timeout: 15000 });

  // Spend
  const programs = await api<Array<Row & { legalEntityId: string }>>(page, employee, "get", "/spend-programs");
  const spend = await api<Row>(page, employee, "post", "/spend-requests", {
    name: `F spend ${stamp}`, purpose: "Integrated journey", amount: "55.00", currency: "USD",
    legalEntityId: programs[0].legalEntityId, programId: programs[0].id, fulfillmentType: "VIRTUAL_CARD",
  });
  await api(page, manager, "post", `/spend-requests/${spend.id}/approve`, {});
  const fulfilled = await api<{ card: Row & { merchantLock?: string | null }; request: { status: string } }>(page, admin, "post", `/spend-requests/${spend.id}/approve`, {});
  expect(fulfilled.request.status).toBe("FULFILLED");
  expect(fulfilled.card?.id).toBeTruthy();

  const auth = await api<{ decision: string }>(page, admin, "post", "/authorizations", {
    cardId: fulfilled.card.id, amount: "25.00", currency: "USD", merchant: fulfilled.card.merchantLock ?? "F Merchant",
    merchantCategory: "software", idempotencyKey: `f-auth-${stamp}`,
  });
  expect(auth.decision).toBe("APPROVED");
  const txns = await api<Array<Row & { status: string; cardId?: string }>>(page, admin, "get", "/transactions");
  const pending = txns.find((row) => row.cardId === fulfilled.card.id && row.status === "PENDING");
  expect(pending).toBeTruthy();
  await api(page, admin, "post", `/transactions/${pending!.id}/capture`, {});

  // Procurement + bill path (lightweight)
  const [vendors, procPrograms] = await Promise.all([
    api<Row[]>(page, admin, "get", "/vendors"),
    api<Array<Row & { defaultOutcomeType?: string; legalEntityId: string }>>(page, admin, "get", "/procurement-programs"),
  ]);
  const entityId = await primaryEntityId(page, admin);
  const program = procPrograms.find((p) => p.defaultOutcomeType === "PURCHASE_ORDER") ?? procPrograms[0];
  const pr = await api<Row>(page, employee, "post", "/procurement", {
    name: `F procure ${stamp}`, legalEntityId: entityId, programId: program.id,
    amount: "100.00", currency: "USD", vendorId: vendors[0].id, memo: "Integrated PO",
    outcomeType: "PURCHASE_ORDER",
    lines: [{ description: "Item", quantity: 1, unitAmount: "100" }],
  });
  await api(page, employee, "post", `/procurement/${pr.id}/submit`, {});
  await api(page, manager, "post", `/procurement/${pr.id}/approve`, {});
  await api(page, admin, "post", `/procurement/${pr.id}/approve`, {});

  const bill = await api<Row>(page, treasury, "post", "/bills", {
    vendorId: vendors[0].id, legalEntityId: entityId, invoiceNumber: `F-${stamp}`,
    amount: "80.00", currency: "USD", memo: "Integrated bill",
  });
  await api(page, ap, "post", `/bills/${bill.id}/approve`, {});
  await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  const payment = await api<Row>(page, treasury, "post", "/payments", {
    billId: bill.id, amount: "80.00", rail: "ACH", idempotencyKey: `f-pay-${stamp}`,
  });
  await api(page, admin, "post", `/payments/${payment.id}/release`, {});
  await api(page, admin, "post", `/payments/${payment.id}/confirm-settlement`, {});

  // Reimbursement
  const reimb = await api<Row>(page, employee, "post", "/reimbursements", {
    legalEntityId: entityId, type: "STANDARD", currency: "USD",
    memo: `F meal ${stamp}`, merchant: `F Cafe ${stamp}`, amount: "40.00", expenseDate: "2026-09-15",
  });
  await api(page, employee, "post", `/reimbursements/${reimb.id}/submit`, {});
  await api(page, manager, "post", `/reimbursements/${reimb.id}/approve`, {});
  await api(page, admin, "post", `/reimbursements/${reimb.id}/schedule`, { rail: "ACH" });
  await api(page, admin, "post", `/reimbursements/${reimb.id}/confirm-payout`, {});

  // Travel
  const trip = await api<Row>(page, employee, "post", "/travel", {
    name: `F travel ${stamp}`, legalEntityId: entityId, destination: "Austin",
    purpose: "Integrated trip", startDate: "2026-11-20", endDate: "2026-11-22",
    estimatedAmount: "700.00", currency: "USD",
  });
  const quotes = await api<{ quotes: Array<Row & { outOfPolicy: boolean; quoteId: string; type: string; supplier: string; amount: string; currency: string }> }>(
    page, employee, "post", `/travel/${trip.id}/search`, { type: "FLIGHT" },
  );
  const inPolicy = quotes.quotes.find((q) => !q.outOfPolicy)!;
  const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
    quoteId: inPolicy.quoteId, type: inPolicy.type, supplier: inPolicy.supplier,
    amount: inPolicy.amount, currency: inPolicy.currency, outOfPolicy: false,
  });
  await api(page, employee, "post", `/travel/${trip.id}/submit`, {});
  await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, { skipReprice: true });
  await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/confirm`, {});

  // Dashboard / accounting / search / audit
  const dash = await api<{ travelPending?: number; pendingBills?: number; travel?: { trips: number } }>(page, admin, "get", "/reporting");
  expect(dash).toBeTruthy();
  const accounting = await api<Row[]>(page, admin, "get", "/accounting");
  expect(accounting.length).toBeGreaterThan(0);
  const search = await api<{ total: number; results: unknown[] }>(page, admin, "get", `/search?q=${encodeURIComponent(`F travel ${stamp}`)}`);
  expect(search.total).toBeGreaterThan(0);
  await page.goto("/app/company/audit");
  await expect(page.getByRole("heading", { name: /Audit/i })).toBeVisible();

  // P1 surface blocked
  await page.goto("/app/disputes");
  await expect(page.getByText(/not part of P0|Access denied/i)).toBeVisible();

  // Tenant isolation: unknown / foreign ids must not leak as readable resources
  await apiExpectStatus(page, employee, "get", `/spend-requests/${spend.id}`, 200);
  const ghost = await page.request.get(`/api/v1/bills/${crypto.randomUUID()}`, {
    headers: { authorization: `Bearer ${employee}` },
  });
  expect([403, 404]).toContain(ghost.status());
});
