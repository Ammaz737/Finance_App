# Flow verification — 15 October 2026

## Verification scope

Current source was checked against the operating manual, role training, mounted actions, card selection helpers, and specialized pages. Six focused unit suites were executed. No live sign-in, database inspection, browser journey, provider call, reseeding or financial mutation was performed. Findings explain code behavior; they do not assert the contents of a running deployment. Existing user changes were preserved. Application fixes are not implemented in this diagnostic pass.

## Cards: confirmed discrepancies

1. Corporate Cards calls `primaryPerHolder`, which picks one live virtual card per holder, preferring Stripe-linked cards, ACTIVE status and newest creation time. It does not exclude travel funds. A newer travel card can therefore hide the ordinary card. This is consistent with the reported travel-only view; live data would establish which records are selected.
2. Ordinary fulfillment calls `ensureHolderVirtualCard` with the default `consolidate` attachment. It searches for a non-travel ordinary card. If one exists, it moves the new request fund's available balance into the existing card fund and increments its limit. It reuses that card ID. Without an ordinary card, it provisions one. The old manual's unconditional “creates a card” wording was inaccurate.
3. Travel provisioning explicitly uses `fundAttachment: reassign` and a trip fund. It keeps separate travel instruments and controls. Thus the implementation does not currently mean one card for all ordinary AND travel transactions. That requested product behavior requires a domain change, not just documentation.
4. My Cards already attempts to exclude travel funds from the ordinary primary selection and lists Travel wallets separately. Corporate Cards uses different selection logic. If travel data fails to load, exclusion may be incomplete.
5. Corporate overview sums only selected primary funds and uses one display currency. It does not represent all wallets or a currency-safe aggregate transaction spend.
6. Ordinary card lookup is scoped by organization and holder but not legal entity/currency. Reusing across differently scoped requests needs investigation before claiming safe cross-entity consolidation.
7. Reuse updates card controls and sets status ACTIVE in the non-provisioning path, including a previously FROZEN candidate. A top-up is therefore not guaranteed to preserve a deliberate freeze or old restrictions. Review before implementation changes.

Evidence: `apps/api/src/application/actions.ts` (`findHolderLiveCard`, `ensureHolderVirtualCard`, spend approval, request detail, `provisionTravelInstruments`); `apps/web/src/lib/card-primary.ts`; Corporate Cards and My Cards pages.

## Correct ordinary-spend demo

| Step | User and page | Action | Verify |
|---|---|---|---|
| 1 | Employee — `/app/me/cards` | Note ordinary card ID and available wallet balance | Separate travel wallet is not the baseline |
| 2 | Employee — `/app/me/requests` | Create VIRTUAL_CARD request with active program, same entity/currency, amount 100; submit | IN_REVIEW; assigned task exists |
| 3 | Assigned Manager — `/app/inbox` | Approve that exact request | Next assigned task, if configured |
| 4 | Assigned Finance approver — `/app/inbox` | Final approval | FULFILLED |
| 5 | Employee — `/app/spend/requests/:id` | Open linked card or My card | Same ordinary card ID; wallet increased by 100 without intervening spend |
| 6 | Authorized card operator — exact card detail | Use permitted authorization/capture helper in configured provider mode | Transaction belongs to that card and fund; expense follows clearing |

If no ordinary card exists, expect first issuance instead. Request fund may show zero after consolidation; the money is on the shared wallet. FUND_ONLY does not invoke card provisioning. Do not describe this as a fresh isolated vendor card on each approval.

## Other flow checks and corrections

| Flow | Source finding | Operator correction |
|---|---|---|
| Invite/roles | Invite creates DRAFT pending activation; seeded AP/Treasury are Finance Admin accounts | Use Owner for onboarding; assign scope/entity on person detail; do not promise all organization fields exist on invite form |
| RBAC | Seeded Finance grants are narrowed by entity assignment; Owner differs | UI access is permission + scope + state, not job label alone |
| Approvals | Active workflow resolves actual actors | Follow assigned task; fixed Manager → Admin or Finance → Admin cannot be assumed for every record |
| Expense | Expense follows cleared transaction; receipt/memo rules govern submission | Create/capture transaction before expecting a new expense; do not confuse booking confirmation with expense creation |
| Reimbursement | Server calculates mileage/per diem; payout is separate from approval | Approve, schedule payout and confirm only when appropriate controls exist; full rejected-edit/resubmit journey is limited |
| Vendor | Changer/verifier separation and masked details are enforced | Use a different verifier; successful save alone is not verification |
| Bill/payment | APPROVED bill and SCHEDULED payment are separate records; release and settlement are separate | Schedule from approved bill; creator must not release; manual settlement is sandbox/mode dependent |
| Payment run | Only eligible scheduled payments compose OPEN run; different authorized releaser | Use batch release OR individual release for a payment, not both; do not try adding an already-settled payment |
| Procurement | PO issuance/receiving/matching are separate; non-PO outcome does not guarantee actual fulfillment | Use PO journey; non-PO card/vendor references require their own real operational workflow |
| Procurement documents | Quote support in backend does not guarantee a usable generic upload form | Document policy blockers instead of inventing buttons |
| Travel | Hold precedes sandbox confirmation; dedicated fund/card; expense only after clearing | Use future dates, correct travel MCC and actual booking state; cancellation/refund is a separate branch |
| Accounting | Local/mock and QuickBooks paths coexist; provider mappings matter | Check configured provider before Sync; successful unit tests do not prove ERP posting |
| Policy/workflow | Create/version actions exist, but permission/routing edge cases remain | Preview/simulate and inspect runtime assignment; empty conditional preview does not prove no approval is needed |
| Correction actions | Backend support does not always imply complete detail form | Do not promise full budget edit or PO change-order UI without checking actual control |
| Notifications | Exact source routes are intended | Verify each recipient's target and access in browser; static code cannot prove every live notification link |

Further source-grounded details: [coverage and boundaries](role-based-training/coverage-and-verification.md), [task-wise training](role-based-training/COMPLETE-TASK-WISE-TRAINING.md).

## Checks executed

- Vitest: policy, workflow, reimbursement calculation, procurement match, mock travel, resource access — 6 suites / 25 tests passed.
- API and Web TypeScript checks passed against the current working tree.
- No new A–F/G1–G6 Playwright pass is claimed. Those journeys mutate database records and require a confirmed isolated sandbox/provider setup before replay.

## Remaining verification

Read-only deployment data inspection and authenticated browser checks are still needed for the reported exact card rows, live workflow assignments, all form controls, and provider modes. The current manual has been corrected for the confirmed card reuse, invite state, workflow assignment, overview metric and expired travel-date issues. Production/provider success remains unverified.
