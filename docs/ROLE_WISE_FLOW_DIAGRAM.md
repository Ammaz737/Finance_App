# Role-wise application flow diagrams

Use the actual assigned approver in Inbox. AP and Treasury are job responsibilities; seeded accounts both have Finance Admin role. Diagrams describe the intended operating sequence supported by current code; they do not certify every live deployment journey.

## Accounts

| Actor | Seeded account | Responsibility |
|---|---|---|
| Admin / Owner | admin@acme.test | People, roles, organization, policies and workflows |
| Employee / Elena | employee@acme.test | Own requests, expenses, claims and travel |
| Manager / Miles | manager@acme.test | Assigned direct-report approvals |
| AP / Aiden | ap@acme.test | Vendors, bills, payment scheduling |
| Finance / Treasury | treasury@acme.test | Assigned finance approval, payouts, release and accounting |

## 1. User creation and role assignment

```mermaid
flowchart TD
  A["ADMIN · /app/company/people<br/>Invite person: name, email, role, manager"] --> B["SYSTEM<br/>DRAFT user + activation link"]
  B --> C["NEW USER · /activate<br/>Set password and activate"]
  C --> D["SYSTEM<br/>User ACTIVE"]
  D --> E["ADMIN · /app/company/people/:id<br/>Verify manager, department, location<br/>Assign role and entity scope"]
  E --> F["USER · /login<br/>Workspace acme + own credentials"]
  F --> G["SYSTEM<br/>Permitted pages and actions<br/>Role + scope + record state"]
```

## 2. Spend request, shared ordinary card and expense

```mermaid
flowchart TD
  A["ADMIN / FINANCE · /app/spend/programs<br/>Configure active spend program"] --> B["EMPLOYEE · /app/me/requests<br/>Enter purpose, amount, entity, program<br/>Select Virtual card and Submit"]
  B --> C["ASSIGNED MANAGER · /app/inbox<br/>Review and Approve"]
  C --> D{"Another approval step?"}
  D -->|Yes| E["ASSIGNED FINANCE APPROVER · /app/inbox<br/>Review and Approve"]
  D -->|No| F["SYSTEM<br/>Final approval → FULFILLED"]
  E --> F
  F --> G{"Ordinary card already exists?"}
  G -->|Yes| H["SYSTEM<br/>Reuse ordinary card<br/>Top up its wallet"]
  G -->|No| I["SYSTEM<br/>Create ordinary card and fund"]
  H --> J["EMPLOYEE · /app/me/cards<br/>View ordinary card and balance"]
  I --> J
  J --> K["AUTHORIZED CARD OPERATOR · exact card detail<br/>Sandbox spend:<br/>Mock: Authorize → Capture<br/>Stripe test: Authorize & capture"]
  K --> L{"Charge clears?"}
  L -->|Declined| M["No cleared expense<br/>No successful purchase debit"]
  L -->|Yes| N["SYSTEM<br/>Transaction + expense"]
  N --> O["EMPLOYEE · /app/me/expenses<br/>Open own INCOMPLETE expense"]
  O --> P["EMPLOYEE · /app/expenses/:id<br/>Save memo → Choose receipt<br/>Upload & link → Submit expense"]
  P --> Q["ASSIGNED MANAGER · /app/inbox<br/>Approve expense"]
  Q --> R["FINANCE · /app/accounting/review<br/>Code → Mark ready"]
  R --> S["FINANCE · /app/accounting/ready-to-sync<br/>Sync → Verify success or correct error"]
```

FUND_ONLY fulfillment produces a fund without card fulfillment. An APPROVED expense does not show the normal receipt-edit form. Expense approval does not charge company cash a second time. Corporate Cards currently can select a travel card instead of the ordinary card; use the request's exact card link or My card to verify the ordinary wallet.

## 3. Reimbursement and company cash

```mermaid
flowchart TD
  A["EMPLOYEE · /app/me/reimbursements<br/>Create claim: entity, type, purpose<br/>Amount or mileage / per-diem inputs"] --> B["EMPLOYEE · claim detail<br/>Attach policy-required receipt<br/>Submit"]
  B --> C["ASSIGNED APPROVER · /app/inbox<br/>Manager / configured reviewers approve"]
  C --> D["SYSTEM<br/>APPROVED — payout still pending"]
  D --> E["FINANCE / TREASURY · /app/expenses/reimbursements/:id<br/>Schedule payout"]
  E --> F["SYSTEM<br/>SCHEDULED"]
  F --> G["FINANCE / TREASURY · same detail<br/>Confirm payout in sandbox"]
  G --> H{"Provider result and cash checks succeed?"}
  H -->|No| I["No successful cash deduction<br/>Correct issue / retry valid action"]
  H -->|Yes| J["SYSTEM · one transaction<br/>PAID + accounting + audit<br/>Cash settlement once"]
  J --> K["Mock issuer: local bank decreases<br/>Stripe test: app-ledger adjustment<br/>Displayed cash decreases; external Stripe unchanged"]
```

Stripe-test reimbursement is simulated, not an external employee transfer. Existing historical PAID claims are not automatically backfilled. Production requires provider-backed confirmation.

## 4. Vendor, bill and payment — individual or batch

```mermaid
flowchart TD
  A["AP / AIDEN · /app/vendors<br/>Create vendor and masked payment details"] --> B["DIFFERENT AUTHORIZED VERIFIER · vendor detail<br/>Verify payment details"]
  B --> C["AP / AIDEN · /app/bill-pay/bills/new<br/>Invoice fields + lines + coding + document<br/>Save DRAFT → Submit"]
  C --> D["ASSIGNED BILL APPROVERS · /app/inbox<br/>AP / Finance steps from active workflow"]
  D --> E["SYSTEM<br/>Bill APPROVED"]
  E --> F["AP / PAYMENT CREATOR · /app/bill-pay/bills/:id<br/>Schedule payment against remaining balance"]
  F --> G["SYSTEM<br/>Payment SCHEDULED"]
  G --> H{"Choose one release path"}
  H -->|Individual| I["DIFFERENT TREASURY USER · /app/bill-pay/payments/:id<br/>Release payment"]
  H -->|Batch| J["AP / RUN CREATOR · /app/bill-pay/payment-runs<br/>Create OPEN run: entity + source account"]
  J --> K["RUN CREATOR · /app/bill-pay/payment-runs/:id<br/>Add SCHEDULED payments<br/>Check count, total and issues"]
  K --> L["TREASURY · same run detail<br/>Different from run and payment creators<br/>Release run"]
  I --> M["SYSTEM<br/>Payments PROCESSING / SENT"]
  L --> M
  M --> N["TREASURY · payment detail<br/>Valid sandbox settlement confirmation<br/>or provider-backed settlement"]
  N --> O["SYSTEM<br/>Payment SETTLED<br/>Bill remaining reduced once<br/>Accounting source created"]
```

Never add an already settled payment to a run. A second batch demonstration needs another scheduled payment. Bill approval is separate from payment creation, release and settlement. Cash behavior depends on the configured rail; do not assume the reimbursement cash adjustment applies to bill payments.

## 5. Procurement, receiving and invoice exception

```mermaid
flowchart TD
  A["EMPLOYEE · /app/procurement/requests<br/>Program + vendor + amount<br/>Outcome Purchase order → Submit"] --> B["ASSIGNED MANAGER / FINANCE · /app/inbox<br/>Complete approval steps"]
  B --> C["SYSTEM<br/>Issue purchase order after final approval"]
  C --> D["AUTHORIZED RECEIVER · /app/procurement/purchase-orders/:id<br/>Record actual receiving"]
  D --> E["AP · /app/bill-pay/bills/new<br/>Create invoice linked to same PO"]
  E --> F["FINANCE / REVIEWER · PO detail<br/>Select invoice → Run 2/3-way match"]
  F --> G{"Within tolerance?"}
  G -->|Yes| H["Continue bill approval and payment flow"]
  G -->|No| I["AUTHORIZED REVIEWER · /app/procurement/match-exceptions<br/>Inspect variance and comment"]
  I --> J{"Choose valid resolution"}
  J --> K["Request receiving correction<br/>Receiver updates actual receipt"]
  J --> L["Request corrected invoice<br/>AP obtains valid correction"]
  J --> M["Authorized override or reject<br/>Authority and SoD enforced"]
  K --> N["REVIEWER · exception / PO detail<br/>Re-evaluate and resolve when valid"]
  L --> N
  M --> N
```

## 6. Travel — separate temporary wallet

```mermaid
flowchart TD
  A["EMPLOYEE · /app/travel/trips<br/>Create trip with future dates<br/>Search → Select offer → Reprice"] --> B["EMPLOYEE · trip detail<br/>Submit"]
  B --> C{"Approval required?"}
  C -->|Yes| D["ASSIGNED MANAGER / FINANCE · /app/inbox<br/>Approve"]
  C -->|No| E["AUTHORIZED TRAVEL USER · /app/travel/trips/:id<br/>Continue supported booking path"]
  D --> E
  E --> F{"Mock booking supported?"}
  F -->|No| G["Provider capability limitation<br/>Do not claim confirmed live tickets"]
  F -->|Yes| H["TRAVEL USER · trip detail<br/>Place mock hold → Confirm sandbox booking"]
  H --> I["SYSTEM<br/>CONFIRMED trip / booking<br/>Dedicated travel fund and card"]
  I --> J["Optional cleared card spend<br/>Creates expense → expense flow"]
  I --> K["TRAVEL USER · same trip detail<br/>Review terms → Cancel eligible booking"]
  K --> L["TRAVEL USER · same trip detail<br/>Refund / Simulate refund when eligible"]
  L --> M["SYSTEM / VIEWER<br/>Refund amount, state and timeline"]
```

Travel currently has dedicated instruments, unlike ordinary spend top-ups. Booking confirmation does not prove a captured card charge. Duffel search alone does not enable live order/refund fulfillment.

## 7. Daily administration and controls

```mermaid
flowchart LR
  A["ADMIN / OWNER"] --> B["People / Roles<br/>Assign access, manager, entity<br/>Suspend / terminate / reset"]
  A --> C["Policies<br/>Create → Simulate → Enable<br/>Version / Disable"]
  A --> D["Approval workflows<br/>Configure → Preview / Simulate<br/>Enable / Version / Disable"]
  E["AUTHORIZED FINANCE"] --> F["Accounting dimensions<br/>Controlled coding values"]
  E --> G["Accounting queues<br/>Review → Ready → Sync / Retry"]
  H["EACH RECIPIENT"] --> I["Inbox / Notifications<br/>Open exact assigned source record"]
  A --> J["Audit<br/>Inspect actor, action, state and time"]
```

Use account permissions, entity scope, record state and SoD checks at every handoff. Owner access does not eliminate all self-approval/creator-release restrictions.
