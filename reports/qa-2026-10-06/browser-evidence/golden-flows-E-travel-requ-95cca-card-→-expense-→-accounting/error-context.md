# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: golden-flows.spec.ts >> E: travel request → book → fund/card → expense → accounting
- Location: e2e\golden-flows.spec.ts:553:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]
  - generic [ref=e12]:
    - link "Skip to main content" [ref=e13] [cursor=pointer]:
      - /url: "#main-content"
    - complementary "Primary navigation" [ref=e14]:
      - link "F Finance Control center" [ref=e15] [cursor=pointer]:
        - /url: /app/home
        - generic [ref=e16]: F
        - generic [ref=e17]:
          - text: Finance
          - generic [ref=e18]: Control center
      - navigation [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Workspace
          - link "Overview" [ref=e22] [cursor=pointer]:
            - /url: /app/home
          - link "Inbox" [ref=e23] [cursor=pointer]:
            - /url: /app/inbox
          - link "Search" [ref=e24] [cursor=pointer]:
            - /url: /app/search
        - generic [ref=e25]:
          - generic [ref=e26]: My work
          - link "My card" [ref=e27] [cursor=pointer]:
            - /url: /app/me/cards
          - link "My expenses" [ref=e28] [cursor=pointer]:
            - /url: /app/me/expenses
          - link "My requests" [ref=e29] [cursor=pointer]:
            - /url: /app/me/requests
          - link "My reimbursements" [ref=e30] [cursor=pointer]:
            - /url: /app/me/reimbursements
          - link "My travel" [ref=e31] [cursor=pointer]:
            - /url: /app/me/travel
        - generic [ref=e32]:
          - generic [ref=e33]: Spend
          - link "Funds" [ref=e34] [cursor=pointer]:
            - /url: /app/spend/funds
          - link "Transactions" [ref=e35] [cursor=pointer]:
            - /url: /app/spend/transactions
        - generic [ref=e36]:
          - generic [ref=e37]: Expenses
          - link "Receipts" [ref=e38] [cursor=pointer]:
            - /url: /app/expenses/receipts
        - generic [ref=e39]:
          - generic [ref=e40]: Procurement
          - link "Requests" [ref=e41] [cursor=pointer]:
            - /url: /app/procurement/requests
        - generic [ref=e42]:
          - generic [ref=e43]: Vendors & Bill Pay
          - link "Vendors" [ref=e44] [cursor=pointer]:
            - /url: /app/vendors
        - generic [ref=e45]:
          - generic [ref=e46]: Insights
          - link "Notifications" [ref=e47] [cursor=pointer]:
            - /url: /app/notifications
        - generic [ref=e48]:
          - generic [ref=e49]: Travel
          - link "Trips" [ref=e50] [cursor=pointer]:
            - /url: /app/travel/trips
          - link "Search" [ref=e51] [cursor=pointer]:
            - /url: /app/travel/search
      - generic [ref=e52]:
        - generic [aria-hidden] [ref=e53]: EE
        - generic [ref=e54]:
          - strong [ref=e55]: Elena Employee
          - generic [ref=e56]: Employee
    - generic [ref=e57]:
      - banner [ref=e58]:
        - generic [ref=e59]:
          - generic [ref=e60]: Workspace
          - strong [ref=e61]: Trips
        - generic [ref=e62]:
          - link "Search" [ref=e63] [cursor=pointer]:
            - /url: /app/search
          - link "Inbox" [ref=e64] [cursor=pointer]:
            - /url: /app/inbox
          - link "1 unread notifications" [ref=e65] [cursor=pointer]:
            - /url: /app/notifications
            - text: Notifications (1)
          - button "Sign out" [ref=e66] [cursor=pointer]
      - main [ref=e67]:
        - generic [ref=e68]:
          - generic [ref=e69]:
            - generic [ref=e71]:
              - heading "Golden travel 1791287111608" [level=1] [ref=e72]
              - paragraph [ref=e73]: SFO → Chicago · USD 900.00
            - link "Back to my travel" [ref=e74] [cursor=pointer]:
              - /url: /app/me/travel
          - generic [ref=e75]:
            - article [ref=e76]:
              - generic [ref=e77]: Status
              - strong [ref=e78]:
                - generic [ref=e79]: DRAFT
              - generic [ref=e80]: No approval instance
            - article [ref=e81]:
              - generic [ref=e82]: Policy
              - strong [ref=e83]:
                - generic [ref=e84]: PASS
              - generic [ref=e85]: No blocking policy matched.
            - article [ref=e86]:
              - generic [ref=e87]: Dates
              - strong [ref=e88]: 11/10/2026 – 11/12/2026
              - generic [ref=e89]: Customer workshop
          - generic [ref=e90]:
            - generic [ref=e91]:
              - heading "Itinerary & Bookings" [level=2] [ref=e92]
              - list [ref=e93]:
                - listitem [ref=e94]: No quotes selected yet. Search below.
              - generic [ref=e95]:
                - combobox "Search type" [ref=e96]:
                  - option "Flights" [selected]
                  - option "Hotels"
                  - option "Cars"
                - button "Search quotes" [ref=e97] [cursor=pointer]
              - button "Submit" [ref=e99] [cursor=pointer]
            - generic [ref=e100]:
              - heading "Fund / Card / Expense" [level=2] [ref=e101]
              - generic [ref=e102]:
                - generic [ref=e103]:
                  - term [ref=e104]: Fund
                  - definition [ref=e105]: —
                - generic [ref=e106]:
                  - term [ref=e107]: Travel card
                  - definition [ref=e108]: —
                - generic [ref=e109]:
                  - term [ref=e110]: Expense
                  - definition [ref=e111]: —
              - generic [ref=e112]:
                - generic [ref=e113]:
                  - text: Fund ID
                  - textbox "Fund ID" [ref=e114]:
                    - /placeholder: Link spend fund
                - button "Link fund" [disabled] [ref=e115]
                - generic [ref=e116]:
                  - text: Expense ID
                  - textbox "Expense ID" [ref=e117]:
                    - /placeholder: Link expense
                - button "Link expense" [disabled] [ref=e118]
            - generic [ref=e119]:
              - heading "Activity" [level=2] [ref=e120]
              - list [ref=e121]:
                - listitem [ref=e122]:
                  - code [ref=e123]: travel.trip_create
                  - text: · 10/6/2026
```

# Test source

```ts
  493 |   await api(page, manager, "post", `/reimbursements/${created.id}/approve`, {});
  494 |   const admin = await login(page, "admin@acme.test");
  495 |   await api(page, admin, "post", `/reimbursements/${created.id}/schedule`, { rail: "ACH" });
  496 |   const paid = await api<{ reimbursement: { status: string; amount: string | number } }>(
  497 |     page, admin, "post", `/reimbursements/${created.id}/confirm-payout`, {},
  498 |   );
  499 |   expect(paid.reimbursement.status).toBe("PAID");
  500 |   expect(Number(paid.reimbursement.amount)).toBe(150);
  501 | });
  502 | 
  503 | test("D4: reimbursement negatives — SoD, duplicate, fail payout, forge blocked", async ({ page }) => {
  504 |   const adminBootstrap = await login(page, "admin@acme.test");
  505 |   const entityId = await primaryEntityId(page, adminBootstrap);
  506 |   const employee = await login(page, "employee@acme.test");
  507 | 
  508 |   const forged = await api<Row & { amount: string | number }>(page, employee, "post", "/reimbursements", {
  509 |     legalEntityId: entityId, type: "MILEAGE", currency: "USD", memo: `Forge ${Date.now()}`,
  510 |     distanceMiles: "50", amount: "5000", mileageRate: "8",
  511 |   });
  512 |   expect(Number(forged.amount)).toBe(33.5);
  513 | 
  514 |   const receipt = await uploadReceipt(page, employee, `dup-${Date.now()}.png`);
  515 |   const stamp = Date.now();
  516 |   const first = await api<Row>(page, employee, "post", "/reimbursements", {
  517 |     legalEntityId: entityId, type: "STANDARD", currency: "USD", memo: `Dup meal ${stamp}`,
  518 |     merchant: `Dup Cafe ${stamp}`, amount: "40.00", expenseDate: "2026-09-15", attachmentId: receipt.id,
  519 |   });
  520 |   await api(page, employee, "post", `/reimbursements/${first.id}/submit`, {});
  521 | 
  522 |   const dup = await api<Row & { duplicateStatus?: string }>(page, employee, "post", "/reimbursements", {
  523 |     legalEntityId: entityId, type: "STANDARD", currency: "USD", memo: `Dup meal again ${stamp}`,
  524 |     merchant: `Dup Cafe ${stamp}`, amount: "40.00", expenseDate: "2026-09-15",
  525 |   });
  526 |   expect(dup.duplicateStatus).toBe("BLOCKED_DUPLICATE");
  527 |   await apiExpectStatus(page, employee, "post", `/reimbursements/${dup.id}/submit`, 409);
  528 | 
  529 |   await apiExpectStatus(page, employee, "post", `/reimbursements/${first.id}/approve`, 403);
  530 | 
  531 |   const manager = await login(page, "manager@acme.test");
  532 |   await api(page, manager, "post", `/reimbursements/${first.id}/approve`, {});
  533 |   await apiExpectStatus(page, employee, "post", `/reimbursements/${first.id}/schedule`, 403, { rail: "ACH" });
  534 | 
  535 |   const admin = await login(page, "admin@acme.test");
  536 |   await api(page, admin, "post", `/reimbursements/${first.id}/schedule`, { rail: "ACH" });
  537 |   const failed = await api<Row & { status: string }>(page, admin, "post", `/reimbursements/${first.id}/fail-payout`, { reason: "Bank rejected" });
  538 |   expect(failed.status).toBe("FAILED");
  539 |   const detail = await api<{ reimbursement: { status: string }; accounting: unknown }>(page, admin, "get", `/reimbursements/${first.id}`);
  540 |   expect(detail.reimbursement.status).toBe("FAILED");
  541 |   expect(detail.accounting).toBeFalsy();
  542 | 
  543 |   const again = await api(page, admin, "post", `/reimbursements/${first.id}/schedule`, { rail: "ACH", idempotencyKey: `d4-${Date.now()}` });
  544 |   expect((again as { status: string }).status).toBe("SCHEDULED");
  545 |   const paid = await api<{ reimbursement: { status: string }; accounting: { id: string } }>(
  546 |     page, admin, "post", `/reimbursements/${first.id}/confirm-payout`, {},
  547 |   );
  548 |   expect(paid.reimbursement.status).toBe("PAID");
  549 |   const replay = await api<{ accounting: { id: string } }>(page, admin, "post", `/reimbursements/${first.id}/confirm-payout`, {});
  550 |   expect(replay.accounting.id).toBe(paid.accounting.id);
  551 | });
  552 | 
  553 | test("E: travel request → book → fund/card → expense → accounting", async ({ page }) => {
  554 |   const employee = await login(page, "employee@acme.test");
  555 |   const entities = await api<Row[]>(page, employee, "get", "/entities");
  556 |   const stamp = Date.now();
  557 |   const trip = await api<Row & { status: string; policyResult: string }>(page, employee, "post", "/travel", {
  558 |     name: `Golden travel ${stamp}`,
  559 |     legalEntityId: entities[0].id,
  560 |     destination: "Chicago",
  561 |     origin: "SFO",
  562 |     purpose: "Customer workshop",
  563 |     startDate: "2026-11-10",
  564 |     endDate: "2026-11-12",
  565 |     estimatedAmount: "900.00",
  566 |     currency: "USD",
  567 |   });
  568 |   expect(trip.status).toBe("DRAFT");
  569 | 
  570 |   await page.goto(`/app/travel/trips/${trip.id}`);
  571 |   await expect(page.getByRole("heading", { name: /Golden travel/ })).toBeVisible();
  572 | 
  573 |   const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string; description?: string; refundable?: boolean; offerExpiry?: string; providerOfferId?: string }> }>(
  574 |     page, employee, "post", `/travel/${trip.id}/search`, { type: "FLIGHT" },
  575 |   );
  576 |   const inPolicy = search.quotes.find((q) => !q.outOfPolicy);
  577 |   expect(inPolicy).toBeTruthy();
  578 |   const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
  579 |     quoteId: inPolicy!.quoteId,
  580 |     type: inPolicy!.type,
  581 |     supplier: inPolicy!.supplier,
  582 |     description: inPolicy!.description,
  583 |     amount: inPolicy!.amount,
  584 |     currency: inPolicy!.currency,
  585 |     outOfPolicy: false,
  586 |     refundable: inPolicy!.refundable,
  587 |     offerExpiry: inPolicy!.offerExpiry,
  588 |     providerOfferId: inPolicy!.providerOfferId,
  589 |   });
  590 |   expect(selected.booking.id).toBeTruthy();
  591 | 
  592 |   const submitted = await api<{ trip: { status: string }; requiresApproval: boolean }>(page, employee, "post", `/travel/${trip.id}/submit`, {});
> 593 |   expect(submitted.requiresApproval).toBe(false);
      |                                      ^ Error: expect(received).toBe(expected) // Object.is equality
  594 |   expect(submitted.trip.status).toBe("READY_TO_BOOK");
  595 | 
  596 |   await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/reprice`, {});
  597 |   const held = await api<Row & { status: string; providerStatus: string }>(
  598 |     page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, { idempotencyKey: `e-book-${stamp}` },
  599 |   );
  600 |   expect(held.status).toBe("BOOKED_MOCK");
  601 |   expect(held.providerStatus).toBe("MOCK_HOLD");
  602 | 
  603 |   const confirmed = await api<{ booking: { status: string }; fund: Row | null; card: Row | null; trip: { status: string } }>(
  604 |     page, employee, "post", `/travel-bookings/${selected.booking.id}/confirm`, {},
  605 |   );
  606 |   expect(confirmed.booking.status).toBe("CONFIRMED");
  607 |   expect(confirmed.trip.status).toBe("CONFIRMED");
  608 |   expect(confirmed.fund?.id).toBeTruthy();
  609 |   expect(confirmed.card?.id).toBeTruthy();
  610 | 
  611 |   await page.goto(`/app/travel/trips/${trip.id}`);
  612 |   await expect(page.getByText(/SANDBOX \/ MOCK CARD/)).toBeVisible();
  613 | 
  614 |   const admin = await login(page, "admin@acme.test");
  615 |   await page.goto(`/app/spend/cards/${confirmed.card!.id}`);
  616 |   await expect(page.getByText(/SANDBOX \/ MOCK CARD/)).toBeVisible();
  617 |   await page.getByLabel("Amount").last().fill("50.00");
  618 |   await page.getByLabel("Merchant", { exact: true }).fill(inPolicy!.supplier);
  619 |   await page.getByLabel("Merchant category").fill("airlines");
  620 |   await page.getByRole("button", { name: "Authorize" }).click();
  621 |   await expect(page.getByRole("status")).toContainText(/authorization recorded/i);
  622 |   await page.getByRole("button", { name: "Capture" }).click();
  623 |   await expect(page.getByRole("status")).toContainText(/capture completed/i);
  624 | 
  625 |   const expenses = await api<Array<Row & { memo?: string; merchant: string; status: string }>>(page, admin, "get", "/expenses");
  626 |   const expense = expenses.find((row) =>
  627 |     row.status === "INCOMPLETE" &&
  628 |     ((row.memo ?? "").includes("Travel") || row.merchant === inPolicy!.supplier),
  629 |   );
  630 |   expect(expense).toBeTruthy();
  631 | 
  632 |   await api(page, admin, "post", `/expenses/${expense!.id}/update-memo`, { memo: `Travel · Chicago · Golden ${stamp}` });
  633 |   await api(page, admin, "post", `/expenses/${expense!.id}/submit`, {});
  634 |   const manager = await login(page, "manager@acme.test");
  635 |   await api(page, manager, "post", `/expenses/${expense!.id}/approve`, {});
  636 | 
  637 |   const entries = await api<Array<Row & { sourceType: string; status: string }>>(page, admin, "get", "/accounting");
  638 |   const entry = entries.find((row) => row.sourceType === "CARD_TRANSACTION");
  639 |   expect(entry).toBeTruthy();
  640 |   if (entry && entry.status === "NEEDS_REVIEW") {
  641 |     await api(page, admin, "post", `/accounting/${entry.id}/code`, { category: "Airfare", memo: "Travel golden" });
  642 |     await api(page, admin, "post", `/accounting/${entry.id}/ready`, {});
  643 |     await api(page, admin, "post", `/accounting/${entry.id}/sync`, {});
  644 |   }
  645 | 
  646 |   const dash = await api<{ travel?: { trips: number }; travelPending: number }>(page, admin, "get", "/reporting");
  647 |   expect(dash.travel?.trips ?? dash.travelPending).toBeTruthy();
  648 | 
  649 |   const detail = await api<{ audit: unknown[]; trip: { status: string } }>(page, admin, "get", `/travel/${trip.id}`);
  650 |   expect(detail.trip.status).toBe("CONFIRMED");
  651 |   expect(detail.audit.length).toBeGreaterThan(3);
  652 | });
  653 | 
  654 | test("E2: out-of-policy travel requires approval before booking", async ({ page }) => {
  655 |   const employee = await login(page, "employee@acme.test");
  656 |   const entities = await api<Row[]>(page, employee, "get", "/entities");
  657 |   const trip = await api<Row>(page, employee, "post", "/travel", {
  658 |     name: `OOP travel ${Date.now()}`,
  659 |     legalEntityId: entities[0].id,
  660 |     destination: "Miami",
  661 |     purpose: "Conference",
  662 |     startDate: "2026-12-01",
  663 |     endDate: "2026-12-04",
  664 |     estimatedAmount: "400.00",
  665 |     currency: "USD",
  666 |   });
  667 |   const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string }> }>(
  668 |     page, employee, "post", `/travel/${trip.id}/search`, { type: "HOTEL" },
  669 |   );
  670 |   const oop = search.quotes.find((q) => q.outOfPolicy)!;
  671 |   const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
  672 |     quoteId: oop.quoteId, type: oop.type, supplier: oop.supplier, amount: oop.amount, currency: oop.currency, outOfPolicy: true,
  673 |   });
  674 |   const submitted = await api<{ trip: { status: string; policyResult: string }; requiresApproval: boolean }>(
  675 |     page, employee, "post", `/travel/${trip.id}/submit`, {},
  676 |   );
  677 |   expect(submitted.requiresApproval).toBe(true);
  678 |   expect(submitted.trip.status).toBe("PENDING_APPROVAL");
  679 |   expect(["REVIEW", "WARN"]).toContain(submitted.trip.policyResult);
  680 | 
  681 |   await apiExpectStatus(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, 409);
  682 |   await apiExpectStatus(page, employee, "post", `/travel/${trip.id}/approve`, 403);
  683 | 
  684 |   const manager = await login(page, "manager@acme.test");
  685 |   await page.goto("/app/inbox");
  686 |   await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  687 |   await api(page, manager, "post", `/travel/${trip.id}/approve`, {});
  688 |   const admin = await login(page, "admin@acme.test");
  689 |   const approved = await api<{ trip: { status: string } }>(page, admin, "post", `/travel/${trip.id}/approve`, {});
  690 |   expect(approved.trip.status).toBe("READY_TO_BOOK");
  691 | 
  692 |   const held = await api<Row & { status: string }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, {});
  693 |   expect(held.status).toBe("BOOKED_MOCK");
```