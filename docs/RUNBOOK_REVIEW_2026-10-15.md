# Pasted runbook verification — 15 October 2026

## Verdict

The pasted runbook is not yet an entirely verified live operating procedure. Several task instructions require correction. Passing focused tests does not certify every account, field, balance and complete journey in the current database.

This review reads the pasted attachment, current source, existing training boundaries and historical QA report. The live Employee expense list and specified travel card were inspected earlier in this conversation. No additional users, financial transactions, permissions or provider records were changed for this review.

## Task-by-task findings

| Runbook section | Verdict | Evidence and required correction |
|---|---|---|
| 1–2 Accounts and roles | Conditional | Emails/passwords are seed defaults, not guaranteed current credentials. AP/Treasury are job labels for Finance Admin accounts. Entity assignments narrow access. Do not treat labels as independent security roles. |
| 3 Invite/activate/assign | Instructions partly incorrect | Current Invite person form has first name, last name, email, role and manager. Entity/department/location must be handled separately on person detail where supported. Generic Save action is not necessarily named Send invite. DRAFT pending activation is correct. Full live activation and reassignment was not replayed. |
| 4 Setup | Conditional | UI builders exist. GL 6100 and other example values must actually exist in the relevant dimension catalog. Receipt threshold semantics are engine-dependent (built-in receipt threshold is inclusive); don't interchange a configured > condition and >= rule. Changing active workflows affects new routing; assignments must be checked. |
| 5 Spend approval/top-up | Source verified; live handoff pending | Ordinary approvals reuse an ordinary card if present and consolidate balance. FUND_ONLY does not provision a card. Active approval assignment determines each actor. Corporate primary selection can hide the ordinary card behind travel. |
| 6 Card controls/spend | Instructions/provider dependent | Mock uses Authorize then Capture. Stripe helper mode uses Authorize & capture and webhook settlement; generic manual Capture is not the universal Stripe route. Only authorized operators see helpers. Travel MCC controls differ from ordinary software controls. |
| 7 Receipt/expense | Instructions incorrect for approved record | Employee list opens /app/expenses/:id. Own INCOMPLETE or REJECTED expense allows Save memo and Attach receipt → choose file → Upload & link → Submit expense. Direct upload already links it; candidate picker is an alternative for an existing unlinked receipt, and submission is on expense detail. APPROVED record is read-only for this edit form. |
| 7 Accounting | Conditional | Approval, coding, readiness and sync are separate. Verify actual dimensions, configured provider and mappings. An error row is a failure requiring correction, not successful sync. |
| 8 Reimbursements | Conditional | Server calculation tests pass. Standard claim example may require receipt/memo according to active policy. Create, attach required evidence, submit, assigned approval, schedule and payout confirmation are separate actions; live payout was not replayed. |
| 9 Vendor/bill/payment | Conditional; actor correction | Vendor bank changer and verifier must differ. Bill workflow's actual assigned AP/Finance reviewer must be followed, including creator SoD. Approval alone does not create payment. Schedule payment exists on bill detail; release must use another user. Settlement confirmation depends on configured rail and valid provider evidence. |
| 10 Payment run | Correct dependency; demo sequencing correction | Run uses SCHEDULED payments. Do not reuse the payment already SETTLED in section 9. Create a second approved bill/payment, or branch to batch before individual release. Run releaser must differ from run creator AND creators of included payments. |
| 11 Procurement/match | Source-supported; live pending | Requires PO, receiving, linked invoice and explicit match. Receiving alone does not create an exception. Actual tolerance, authority and SoD determine allowed resolution; all action labels are alternatives, not a mandatory sequence. |
| 12 Travel | Provider dependent | Mock supports simulated hold/confirmation/cancel/refund. Duffel search does not imply these fulfillment capabilities; unsupported buttons can be hidden. Dedicated travel fund/card is current behavior. Expense requires cleared card spend. |
| 13 Administration | Partial verification | Configuration and role interfaces exist; cannot claim all current accounts can perform every action without live assignments. Notification destinations require per-recipient access checks. |
| 14 Safety | Source supported | State and SoD checks exist; this is not proof that every child list is perfectly scoped. Existing training documents identify additional scope/permission gaps. |
| 15 Demo order | Needs correction | Replace unconditional system creates card with creates/reuses ordinary card and tops up. Payment run is a branch or separate payment, not a post-settlement step for the same payment. |

## Actual live observations already established

- Employee Elena's My expenses list contains Openai USD 200, APPROVED, receipt Attached. This is not an upload-ready expense. Request title and merchant expense title are different concepts.
- Card 93dd5f7b-bfe7-4ad0-b1d2-49e88754b9a8 is travel card ending 0187, Stripe-linked, London trip, wallet USD 38.12.
- That card shows zero transactions and two MCC_BLOCKED declines. No successful cleared charge is evidenced there.
- Company-bank helper skips local BankAccount mutation in Stripe mode. Local Company Cash cannot be assumed to decrease just because an expense is approved or a travel booking is confirmed.

## Checks run now

- Eight focused Vitest suites: auth matrix, role matrix, resource access, workflow, policy, reimbursement calculation, procurement match and mock travel.
- Result: 8 suites passed, 45 tests passed.
- Existing isolated validation runner failed before tests: Node could not resolve dotenv from its report-directory entry point. It produced no new full API, worker, typecheck or Playwright result.
- Historical 6 October QA reports are historical only; they are not a new pass for the current dirty working tree.

## What remains before saying every user task works

Current live role assignments and entity scopes, invite/activation, every approval handoff, ordinary-card top-up balances, receipt upload, vendor verification, payment/run settlement, procurement resolution, reimbursement payout, mock/provider travel capabilities and accounting posting need complete isolated browser/database journeys. No all-green end-to-end claim is made in this report.

Sources: current resource-config.ts, specialized expense/card/payment pages, actions.ts, card-primary.ts, role-based-training/coverage-and-verification.md and reports/qa-fixes-2026-10-06/FIX_REPORT.md.
