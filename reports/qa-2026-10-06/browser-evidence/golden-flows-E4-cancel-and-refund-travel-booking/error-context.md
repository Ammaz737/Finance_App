# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: golden-flows.spec.ts >> E4: cancel and refund travel booking
- Location: e2e\golden-flows.spec.ts:721:5

# Error details

```
Error: POST /travel-bookings/54aba01e-0873-4557-84c6-718a9ee38755/book-mock: 409 {"error":{"code":"APPROVAL_REQUIRED","message":"Trip must be ready to book before mock booking","details":{},"requestId":"b49c196b-ceea-46fb-8c28-ee35d2e74df6"}}

expect(received).toBeTruthy()

Received: false
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
> 20  |   expect(response.ok(), `${method.toUpperCase()} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
      |                                                                                                           ^ Error: POST /travel-bookings/54aba01e-0873-4557-84c6-718a9ee38755/book-mock: 409 {"error":{"code":"APPROVAL_REQUIRED","message":"Trip must be ready to book before mock booking","details":{},"requestId":"b49c196b-ceea-46fb-8c28-ee35d2e74df6"}}
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
  67  |   await expect(page.getByText(/SANDBOX \/ MOCK CARD/)).toBeVisible();
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
```