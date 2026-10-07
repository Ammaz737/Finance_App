# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: golden-flows.spec.ts >> F: integrated finance coexistence journey
- Location: e2e\golden-flows.spec.ts:806:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "APPROVED"
Received: "DECLINED"
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
          - link "Spend programs" [ref=e34] [cursor=pointer]:
            - /url: /app/spend/programs
          - link "Spend requests" [ref=e35] [cursor=pointer]:
            - /url: /app/spend/requests
          - link "Cards" [ref=e36] [cursor=pointer]:
            - /url: /app/cards
          - link "Funds" [ref=e37] [cursor=pointer]:
            - /url: /app/spend/funds
          - link "Transactions" [ref=e38] [cursor=pointer]:
            - /url: /app/spend/transactions
        - generic [ref=e39]:
          - generic [ref=e40]: Expenses
          - link "Expense review" [ref=e41] [cursor=pointer]:
            - /url: /app/expenses/transactions
          - link "Receipts" [ref=e42] [cursor=pointer]:
            - /url: /app/expenses/receipts
          - link "Reimbursements" [ref=e43] [cursor=pointer]:
            - /url: /app/expenses/reimbursements
          - link "For approval" [ref=e44] [cursor=pointer]:
            - /url: /app/expenses/reimbursements?status=IN_REVIEW
          - link "For payout" [ref=e45] [cursor=pointer]:
            - /url: /app/expenses/reimbursements?status=APPROVED
          - link "Paid / History" [ref=e46] [cursor=pointer]:
            - /url: /app/expenses/reimbursements?status=PAID
          - link "Failures" [ref=e47] [cursor=pointer]:
            - /url: /app/expenses/reimbursements?status=FAILED
        - generic [ref=e48]:
          - generic [ref=e49]: Procurement
          - link "Requests" [ref=e50] [cursor=pointer]:
            - /url: /app/procurement/requests
          - link "Programs" [ref=e51] [cursor=pointer]:
            - /url: /app/procurement/programs
          - link "Purchase Orders" [ref=e52] [cursor=pointer]:
            - /url: /app/procurement/purchase-orders
          - link "Receiving" [ref=e53] [cursor=pointer]:
            - /url: /app/procurement/receiving
          - link "Match Exceptions" [ref=e54] [cursor=pointer]:
            - /url: /app/procurement/match-exceptions
        - generic [ref=e55]:
          - generic [ref=e56]: Vendors & Bill Pay
          - link "Vendors" [ref=e57] [cursor=pointer]:
            - /url: /app/vendors
          - link "Bills" [ref=e58] [cursor=pointer]:
            - /url: /app/bill-pay/bills
          - link "For approval" [ref=e59] [cursor=pointer]:
            - /url: /app/bill-pay/bills?stage=approval
          - link "For payment" [ref=e60] [cursor=pointer]:
            - /url: /app/bill-pay/bills?stage=payment
          - link "Payments" [ref=e61] [cursor=pointer]:
            - /url: /app/bill-pay/payments
          - link "Payment runs" [ref=e62] [cursor=pointer]:
            - /url: /app/bill-pay/payment-runs
          - link "History" [ref=e63] [cursor=pointer]:
            - /url: /app/bill-pay/bills?stage=history
        - generic [ref=e64]:
          - generic [ref=e65]: Accounting
          - link "Overview" [ref=e66] [cursor=pointer]:
            - /url: /app/accounting/overview
          - link "Needs review" [ref=e67] [cursor=pointer]:
            - /url: /app/accounting/review
          - link "Ready to sync" [ref=e68] [cursor=pointer]:
            - /url: /app/accounting/ready-to-sync
          - link "Synced" [ref=e69] [cursor=pointer]:
            - /url: /app/accounting/synced
          - link "Sync errors" [ref=e70] [cursor=pointer]:
            - /url: /app/accounting/errors
          - link "Rules" [ref=e71] [cursor=pointer]:
            - /url: /app/accounting/rules
          - link "Integrations" [ref=e72] [cursor=pointer]:
            - /url: /app/accounting/integrations
        - generic [ref=e73]:
          - generic [ref=e74]: Insights
          - link "Dashboard" [ref=e75] [cursor=pointer]:
            - /url: /app/insights/dashboard
          - link "Budgets" [ref=e76] [cursor=pointer]:
            - /url: /app/insights/budgets
          - link "Notifications" [ref=e77] [cursor=pointer]:
            - /url: /app/notifications
        - generic [ref=e78]:
          - generic [ref=e79]: Travel
          - link "Trips" [ref=e80] [cursor=pointer]:
            - /url: /app/travel/trips
          - link "Trip requests" [ref=e81] [cursor=pointer]:
            - /url: /app/travel/requests
          - link "Search" [ref=e82] [cursor=pointer]:
            - /url: /app/travel/search
          - link "Reports" [ref=e83] [cursor=pointer]:
            - /url: /app/travel/reports
        - generic [ref=e84]:
          - generic [ref=e85]: Company
          - link "Settings" [ref=e86] [cursor=pointer]:
            - /url: /app/company/settings
          - link "Entities" [ref=e87] [cursor=pointer]:
            - /url: /app/company/entities
          - link "Departments" [ref=e88] [cursor=pointer]:
            - /url: /app/company/departments
          - link "Locations" [ref=e89] [cursor=pointer]:
            - /url: /app/company/locations
          - link "People" [ref=e90] [cursor=pointer]:
            - /url: /app/company/people
          - link "Roles" [ref=e91] [cursor=pointer]:
            - /url: /app/company/roles
          - link "Policies" [ref=e92] [cursor=pointer]:
            - /url: /app/company/policy
          - link "Approval rules" [ref=e93] [cursor=pointer]:
            - /url: /app/company/approvals
          - link "Accounting dimensions" [ref=e94] [cursor=pointer]:
            - /url: /app/company/accounting-dimensions
          - link "Integrations" [ref=e95] [cursor=pointer]:
            - /url: /app/company/integrations
          - link "Audit log" [ref=e96] [cursor=pointer]:
            - /url: /app/company/audit
      - generic [ref=e97]:
        - generic [aria-hidden] [ref=e98]: AP
        - generic [ref=e99]:
          - strong [ref=e100]: Aiden Payable
          - generic [ref=e101]: Finance Admin
    - generic [ref=e102]:
      - banner [ref=e103]:
        - generic [ref=e104]:
          - generic [ref=e105]: Workspace
          - strong [ref=e106]: Overview
        - generic [ref=e107]:
          - link "Search" [ref=e108] [cursor=pointer]:
            - /url: /app/search
          - link "Inbox" [ref=e109] [cursor=pointer]:
            - /url: /app/inbox
          - link "Notifications" [ref=e110] [cursor=pointer]:
            - /url: /app/notifications
          - button "Sign out" [ref=e111] [cursor=pointer]
      - main [ref=e112]:
        - generic [ref=e113]:
          - generic [ref=e114]:
            - generic [ref=e115]:
              - paragraph [ref=e116]: Tuesday, October 6
              - heading "Good afternoon, Aiden" [level=1] [ref=e117]
              - paragraph [ref=e118]: Finish your tasks, check balances, and move spend forward — all in one place.
            - generic "Quick actions" [ref=e119]:
              - link "Request spend" [ref=e120] [cursor=pointer]:
                - /url: /app/me/requests
              - link "Complete expenses" [ref=e121] [cursor=pointer]:
                - /url: /app/me/expenses
              - link "New reimbursement" [ref=e122] [cursor=pointer]:
                - /url: /app/me/reimbursements
              - link "Book travel" [ref=e123] [cursor=pointer]:
                - /url: /app/me/travel
              - link "Create bill" [ref=e124] [cursor=pointer]:
                - /url: /app/bill-pay/bills/new
              - link "Open inbox" [ref=e125] [cursor=pointer]:
                - /url: /app/inbox
          - region [ref=e126]:
            - generic [ref=e127]:
              - heading "Needs your attention" [level=2] [ref=e128]
              - generic [ref=e129]: 4 items
            - list [ref=e130]:
              - listitem [ref=e131]:
                - link "Inbox approvals Waiting on your decision 18" [ref=e132] [cursor=pointer]:
                  - /url: /app/inbox
                  - generic [ref=e133]:
                    - strong [ref=e134]: Inbox approvals
                    - generic [ref=e135]: Waiting on your decision
                  - emphasis [ref=e136]: "18"
              - listitem [ref=e137]:
                - link "Bills for approval Accounts payable queue 2" [ref=e138] [cursor=pointer]:
                  - /url: /app/bill-pay/bills?stage=approval
                  - generic [ref=e139]:
                    - strong [ref=e140]: Bills for approval
                    - generic [ref=e141]: Accounts payable queue
                  - emphasis [ref=e142]: "2"
              - listitem [ref=e143]:
                - link "Accounting review Entries needing coding 16" [ref=e144] [cursor=pointer]:
                  - /url: /app/accounting/review
                  - generic [ref=e145]:
                    - strong [ref=e146]: Accounting review
                    - generic [ref=e147]: Entries needing coding
                  - emphasis [ref=e148]: "16"
              - listitem [ref=e149]:
                - link "Travel pending Trips awaiting review 5" [ref=e150] [cursor=pointer]:
                  - /url: /app/travel/requests
                  - generic [ref=e151]:
                    - strong [ref=e152]: Travel pending
                    - generic [ref=e153]: Trips awaiting review
                  - emphasis [ref=e154]: "5"
          - region [ref=e155]:
            - generic [ref=e156]:
              - heading "My work" [level=2] [ref=e157]
              - generic [ref=e158]: Personal balances and status
            - generic [ref=e159]:
              - link "Available funds — No balances yet" [ref=e160] [cursor=pointer]:
                - /url: /app/me/cards
                - generic [ref=e161]: Available funds
                - strong [ref=e162]: —
                - generic [ref=e163]: No balances yet
              - link "Open expenses 0 Receipts and review" [ref=e164] [cursor=pointer]:
                - /url: /app/me/expenses
                - generic [ref=e165]: Open expenses
                - strong [ref=e166]: "0"
                - generic [ref=e167]: Receipts and review
              - link "My requests 0 Awaiting a decision" [ref=e168] [cursor=pointer]:
                - /url: /app/me/requests
                - generic [ref=e169]: My requests
                - strong [ref=e170]: "0"
                - generic [ref=e171]: Awaiting a decision
              - link "Notifications 0 Unread for you" [ref=e172] [cursor=pointer]:
                - /url: /app/notifications
                - generic [ref=e173]: Notifications
                - strong [ref=e174]: "0"
                - generic [ref=e175]: Unread for you
          - region [ref=e176]:
            - generic [ref=e177]:
              - heading "Company overview" [level=2] [ref=e178]
              - generic [ref=e179]: As of 10/6/2026, 4:48:45 PM
            - generic [ref=e180]:
              - article [ref=e181]:
                - generic [ref=e182]: Company cash
                - strong [ref=e183]: USD 620,000.00
                - generic [ref=e184]: Local bank accounts (mock)
              - link "Cleared card spend USD 88.00 By transaction currency (synced from Stripe events)" [ref=e185] [cursor=pointer]:
                - /url: /app/spend/transactions
                - generic [ref=e186]: Cleared card spend
                - strong [ref=e187]: USD 88.00
                - generic [ref=e188]: By transaction currency (synced from Stripe events)
              - link "Open payables USD 4,655.00 2 bills pending approval" [ref=e189] [cursor=pointer]:
                - /url: /app/bill-pay/bills?stage=approval
                - generic [ref=e190]: Open payables
                - strong [ref=e191]: USD 4,655.00
                - generic [ref=e192]: 2 bills pending approval
              - link "Budget remaining USD 99,900.00 Used USD 100.00 · internal budgets" [ref=e193] [cursor=pointer]:
                - /url: /app/insights/budgets
                - generic [ref=e194]: Budget remaining
                - strong [ref=e195]: USD 99,900.00
                - generic [ref=e196]: Used USD 100.00 · internal budgets
              - link "Open PO commitments USD 50.00 Unbilled PO balance" [ref=e197] [cursor=pointer]:
                - /url: /app/procurement/purchase-orders
                - generic [ref=e198]: Open PO commitments
                - strong [ref=e199]: USD 50.00
                - generic [ref=e200]: Unbilled PO balance
              - link "Accounting review 16 Entries needing attention" [ref=e201] [cursor=pointer]:
                - /url: /app/accounting/overview
                - generic [ref=e202]: Accounting review
                - strong [ref=e203]: "16"
                - generic [ref=e204]: Entries needing attention
              - link "Integrations 4/4 0 degraded" [ref=e205] [cursor=pointer]:
                - /url: /app/company/integrations
                - generic [ref=e206]: Integrations
                - strong [ref=e207]: 4/4
                - generic [ref=e208]: 0 degraded
          - generic [ref=e209]:
            - region [ref=e210]:
              - heading "Action queues" [level=2] [ref=e211]
              - link "Spend requests 0" [ref=e212] [cursor=pointer]:
                - /url: /app/spend/requests
                - generic [ref=e213]: Spend requests
                - strong [ref=e214]: "0"
              - link "Bills for approval 2" [ref=e215] [cursor=pointer]:
                - /url: /app/bill-pay/bills?stage=approval
                - generic [ref=e216]: Bills for approval
                - strong [ref=e217]: "2"
              - link "Travel pending 5" [ref=e218] [cursor=pointer]:
                - /url: /app/travel/requests
                - generic [ref=e219]: Travel pending
                - strong [ref=e220]: "5"
              - link "Accounting review 16" [ref=e221] [cursor=pointer]:
                - /url: /app/accounting/overview
                - generic [ref=e222]: Accounting review
                - strong [ref=e223]: "16"
            - region [ref=e224]:
              - heading "Freshness" [level=2] [ref=e225]
              - paragraph [ref=e226]: Dashboard as of 10/6/2026, 4:48:45 PM
              - paragraph [ref=e227]: Budget read model 10/6/2026, 4:41:13 PM
              - paragraph [ref=e228]: Currency totals are server-calculated. Actual and committed budget amounts are not double-counted.
              - generic [ref=e229]:
                - link "Integration health" [ref=e230] [cursor=pointer]:
                  - /url: /app/company/integrations
                - link "Budgets" [ref=e231] [cursor=pointer]:
                  - /url: /app/insights/budgets
                - link "Audit log" [ref=e232] [cursor=pointer]:
                  - /url: /app/company/audit
```

# Test source

```ts
  732 |   });
  733 |   const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string; refundable?: boolean }> }>(
  734 |     page, employee, "post", `/travel/${trip.id}/search`, { type: "HOTEL" },
  735 |   );
  736 |   const quote = search.quotes.find((q) => !q.outOfPolicy)!;
  737 |   const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
  738 |     quoteId: quote.quoteId, type: quote.type, supplier: quote.supplier, amount: quote.amount, currency: quote.currency,
  739 |     outOfPolicy: false, refundable: true,
  740 |   });
  741 |   await api(page, employee, "post", `/travel/${trip.id}/submit`, {});
  742 |   await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, { skipReprice: true });
  743 |   await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/confirm`, {});
  744 |   const cancelled = await api<Row & { status: string }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/cancel`, {});
  745 |   expect(["CANCELLED", "REFUND_PENDING"]).toContain(cancelled.status);
  746 |   const refunded = await api<{ booking: { status: string } }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/refund`, {});
  747 |   expect(refunded.booking.status).toBe("REFUNDED");
  748 |   const again = await api<{ booking: { status: string } }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/refund`, {});
  749 |   expect(again.booking.status).toBe("REFUNDED");
  750 | });
  751 | 
  752 | test("E5: travel security negatives — SoD, tenant isolation, MCC, idempotency", async ({ page }) => {
  753 |   const employee = await login(page, "employee@acme.test");
  754 |   const entities = await api<Row[]>(page, employee, "get", "/entities");
  755 |   const trip = await api<Row>(page, employee, "post", "/travel", {
  756 |     name: `Sec travel ${Date.now()}`,
  757 |     legalEntityId: entities[0].id,
  758 |     destination: "Dallas",
  759 |     startDate: "2027-04-01",
  760 |     endDate: "2027-04-03",
  761 |     estimatedAmount: "500.00",
  762 |     currency: "USD",
  763 |   });
  764 |   const search = await api<{ quotes: Array<Row & { outOfPolicy: boolean; amount: string; supplier: string; type: string; currency: string; quoteId: string }> }>(
  765 |     page, employee, "post", `/travel/${trip.id}/search`, { type: "FLIGHT" },
  766 |   );
  767 |   const oop = search.quotes.find((q) => q.outOfPolicy)!;
  768 |   const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
  769 |     quoteId: oop.quoteId, type: oop.type, supplier: oop.supplier, amount: oop.amount, currency: oop.currency, outOfPolicy: true,
  770 |   });
  771 |   await api(page, employee, "post", `/travel/${trip.id}/submit`, {});
  772 |   await apiExpectStatus(page, employee, "post", `/travel/${trip.id}/approve`, 403);
  773 |   await apiExpectStatus(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, 409);
  774 | 
  775 |   const manager = await login(page, "manager@acme.test");
  776 |   await api(page, manager, "post", `/travel/${trip.id}/approve`, {});
  777 |   const admin = await login(page, "admin@acme.test");
  778 |   await api(page, admin, "post", `/travel/${trip.id}/approve`, {});
  779 | 
  780 |   const key = `e5-idem-${Date.now()}`;
  781 |   const first = await api<Row & { providerRef: string }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, {
  782 |     idempotencyKey: key, skipReprice: true,
  783 |   });
  784 |   const second = await api<Row & { providerRef: string }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, {
  785 |     idempotencyKey: key, skipReprice: true,
  786 |   });
  787 |   expect(first.providerRef).toBe(second.providerRef);
  788 | 
  789 |   const confirmed = await api<{ card: Row & { id: string } }>(page, employee, "post", `/travel-bookings/${selected.booking.id}/confirm`, {});
  790 |   expect(confirmed.card?.id).toBeTruthy();
  791 | 
  792 |   const declined = await api<{ decision: string; reason: string }>(page, admin, "post", "/authorizations", {
  793 |     cardId: confirmed.card.id,
  794 |     amount: "20.00",
  795 |     currency: "USD",
  796 |     merchant: "Office Depot",
  797 |     merchantCategory: "office_supplies",
  798 |     idempotencyKey: `e5-mcc-${Date.now()}`,
  799 |   });
  800 |   expect(declined.decision).toBe("DECLINED");
  801 |   expect(declined.reason).toBe("MCC_BLOCKED");
  802 | 
  803 |   await apiExpectStatus(page, employee, "get", `/travel/${crypto.randomUUID()}`, 404);
  804 | });
  805 | 
  806 | test("F: integrated finance coexistence journey", async ({ page }) => {
  807 |   const stamp = Date.now();
  808 |   const admin = await login(page, "admin@acme.test");
  809 |   const employee = await login(page, "employee@acme.test");
  810 |   const manager = await login(page, "manager@acme.test");
  811 |   const treasury = await login(page, "treasury@acme.test");
  812 |   const ap = await login(page, "ap@acme.test");
  813 | 
  814 |   await page.goto("/app/home");
  815 |   await expect(page.locator("main, #main-content").first()).toBeVisible({ timeout: 15000 });
  816 | 
  817 |   // Spend
  818 |   const programs = await api<Array<Row & { legalEntityId: string }>>(page, employee, "get", "/spend-programs");
  819 |   const spend = await api<Row>(page, employee, "post", "/spend-requests", {
  820 |     name: `F spend ${stamp}`, purpose: "Integrated journey", amount: "55.00", currency: "USD",
  821 |     legalEntityId: programs[0].legalEntityId, programId: programs[0].id, fulfillmentType: "VIRTUAL_CARD",
  822 |   });
  823 |   await api(page, manager, "post", `/spend-requests/${spend.id}/approve`, {});
  824 |   const fulfilled = await api<{ card: Row & { merchantLock?: string | null }; request: { status: string } }>(page, admin, "post", `/spend-requests/${spend.id}/approve`, {});
  825 |   expect(fulfilled.request.status).toBe("FULFILLED");
  826 |   expect(fulfilled.card?.id).toBeTruthy();
  827 | 
  828 |   const auth = await api<{ decision: string }>(page, admin, "post", "/authorizations", {
  829 |     cardId: fulfilled.card.id, amount: "25.00", currency: "USD", merchant: fulfilled.card.merchantLock ?? "F Merchant",
  830 |     merchantCategory: "software", idempotencyKey: `f-auth-${stamp}`,
  831 |   });
> 832 |   expect(auth.decision).toBe("APPROVED");
      |                         ^ Error: expect(received).toBe(expected) // Object.is equality
  833 |   const txns = await api<Array<Row & { status: string; cardId?: string }>>(page, admin, "get", "/transactions");
  834 |   const pending = txns.find((row) => row.cardId === fulfilled.card.id && row.status === "PENDING");
  835 |   expect(pending).toBeTruthy();
  836 |   await api(page, admin, "post", `/transactions/${pending!.id}/capture`, {});
  837 | 
  838 |   // Procurement + bill path (lightweight)
  839 |   const [vendors, procPrograms] = await Promise.all([
  840 |     api<Row[]>(page, admin, "get", "/vendors"),
  841 |     api<Array<Row & { defaultOutcomeType?: string; legalEntityId: string }>>(page, admin, "get", "/procurement-programs"),
  842 |   ]);
  843 |   const entityId = await primaryEntityId(page, admin);
  844 |   const program = procPrograms.find((p) => p.defaultOutcomeType === "PURCHASE_ORDER") ?? procPrograms[0];
  845 |   const pr = await api<Row>(page, employee, "post", "/procurement", {
  846 |     name: `F procure ${stamp}`, legalEntityId: entityId, programId: program.id,
  847 |     amount: "100.00", currency: "USD", vendorId: vendors[0].id, memo: "Integrated PO",
  848 |     outcomeType: "PURCHASE_ORDER",
  849 |     lines: [{ description: "Item", quantity: 1, unitAmount: "100" }],
  850 |   });
  851 |   await api(page, employee, "post", `/procurement/${pr.id}/submit`, {});
  852 |   await api(page, manager, "post", `/procurement/${pr.id}/approve`, {});
  853 |   await api(page, admin, "post", `/procurement/${pr.id}/approve`, {});
  854 | 
  855 |   const bill = await api<Row>(page, treasury, "post", "/bills", {
  856 |     vendorId: vendors[0].id, legalEntityId: entityId, invoiceNumber: `F-${stamp}`,
  857 |     amount: "80.00", currency: "USD", memo: "Integrated bill",
  858 |   });
  859 |   await api(page, ap, "post", `/bills/${bill.id}/approve`, {});
  860 |   await api(page, admin, "post", `/bills/${bill.id}/approve`, {});
  861 |   const payment = await api<Row>(page, treasury, "post", "/payments", {
  862 |     billId: bill.id, amount: "80.00", rail: "ACH", idempotencyKey: `f-pay-${stamp}`,
  863 |   });
  864 |   await api(page, admin, "post", `/payments/${payment.id}/release`, {});
  865 |   await api(page, admin, "post", `/payments/${payment.id}/confirm-settlement`, {});
  866 | 
  867 |   // Reimbursement
  868 |   const reimb = await api<Row>(page, employee, "post", "/reimbursements", {
  869 |     legalEntityId: entityId, type: "STANDARD", currency: "USD",
  870 |     memo: `F meal ${stamp}`, merchant: `F Cafe ${stamp}`, amount: "40.00", expenseDate: "2026-09-15",
  871 |   });
  872 |   await api(page, employee, "post", `/reimbursements/${reimb.id}/submit`, {});
  873 |   await api(page, manager, "post", `/reimbursements/${reimb.id}/approve`, {});
  874 |   await api(page, admin, "post", `/reimbursements/${reimb.id}/schedule`, { rail: "ACH" });
  875 |   await api(page, admin, "post", `/reimbursements/${reimb.id}/confirm-payout`, {});
  876 | 
  877 |   // Travel
  878 |   const trip = await api<Row>(page, employee, "post", "/travel", {
  879 |     name: `F travel ${stamp}`, legalEntityId: entityId, destination: "Austin",
  880 |     purpose: "Integrated trip", startDate: "2026-11-20", endDate: "2026-11-22",
  881 |     estimatedAmount: "700.00", currency: "USD",
  882 |   });
  883 |   const quotes = await api<{ quotes: Array<Row & { outOfPolicy: boolean; quoteId: string; type: string; supplier: string; amount: string; currency: string }> }>(
  884 |     page, employee, "post", `/travel/${trip.id}/search`, { type: "FLIGHT" },
  885 |   );
  886 |   const inPolicy = quotes.quotes.find((q) => !q.outOfPolicy)!;
  887 |   const selected = await api<{ booking: Row }>(page, employee, "post", `/travel/${trip.id}/select-quote`, {
  888 |     quoteId: inPolicy.quoteId, type: inPolicy.type, supplier: inPolicy.supplier,
  889 |     amount: inPolicy.amount, currency: inPolicy.currency, outOfPolicy: false,
  890 |   });
  891 |   await api(page, employee, "post", `/travel/${trip.id}/submit`, {});
  892 |   await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, { skipReprice: true });
  893 |   await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/confirm`, {});
  894 | 
  895 |   // Dashboard / accounting / search / audit
  896 |   const dash = await api<{ travelPending?: number; pendingBills?: number; travel?: { trips: number } }>(page, admin, "get", "/reporting");
  897 |   expect(dash).toBeTruthy();
  898 |   const accounting = await api<Row[]>(page, admin, "get", "/accounting");
  899 |   expect(accounting.length).toBeGreaterThan(0);
  900 |   const search = await api<{ total: number; results: unknown[] }>(page, admin, "get", `/search?q=${encodeURIComponent(`F travel ${stamp}`)}`);
  901 |   expect(search.total).toBeGreaterThan(0);
  902 |   await page.goto("/app/company/audit");
  903 |   await expect(page.getByRole("heading", { name: /Audit/i })).toBeVisible();
  904 | 
  905 |   // P1 surface blocked
  906 |   await page.goto("/app/disputes");
  907 |   await expect(page.getByText(/not part of P0|Access denied/i)).toBeVisible();
  908 | 
  909 |   // Tenant isolation: unknown / foreign ids must not leak as readable resources
  910 |   await apiExpectStatus(page, employee, "get", `/spend-requests/${spend.id}`, 200);
  911 |   const ghost = await page.request.get(`/api/v1/bills/${crypto.randomUUID()}`, {
  912 |     headers: { authorization: `Bearer ${employee}` },
  913 |   });
  914 |   expect([403, 404]).toContain(ghost.status());
  915 | });
  916 | 
```