# Coverage, verification, and implementation boundaries

[Master training index](README.md)

**Review date:** 13 October 2026. The source inventory covers 1041 application/shared source, manifest, schema, and migration files, including 167 app page/mobile route files, 70 mounted API resources, and 84 database models. Inventory is not an assertion that every file is implemented or executed. The training procedures were traced through company-web pages, shared forms/navigation, the mounted registry, authorization, domain actions/engines, database models, adapters, and relevant workers.

No live server/database/provider test was run. Existing reports/screenshots provide historical examples only. Existing user edits and deleted top-level documents were left untouched. Dead module route/schema wrappers and empty domain scaffolds do not override the mounted registry.

## Evidence hierarchy

| Topic | Primary sources | Why it matters |
|---|---|---|
| Actual roles and assignments | [Seed](../../apps/api/prisma/seed.ts), [role builder matrix](../../packages/permissions/src/role-matrix.ts) | Four reserved seeded roles; additional names are configurable/routing references. |
| Effective scope | [Authentication](../../apps/api/src/platform/auth/index.ts), [resource access](../../apps/api/src/platform/resource-access.ts), [RBAC](../../apps/api/src/platform/rbac/index.ts) | Entity assignment narrows ORGANIZATION grants except Owner. |
| User-visible paths/forms | [Navigation](../../apps/web/src/config/navigation.ts), [form config](../../apps/web/src/config/resource-config.ts), [shared page](../../apps/web/src/components/ResourcePage.tsx), page inventory below | UI field presence is separate from model/API support. |
| Mounted functionality | [API entry](../../apps/api/src/app/routes.ts), [registry](../../apps/api/src/modules/registry.ts), [resource router](../../apps/api/src/platform/resource-router.ts) | Registry is what the app mounts; shared lists cap at 100 records. |
| Financial state changes | [Actions](../../apps/api/src/application/actions.ts), [workflow](../../apps/api/src/engines/workflow/index.ts), [Inbox](../../apps/api/src/engines/inbox/index.ts) | Approval, settlement, ownership, and independent actors. |
| Persistence | [Prisma schema](../../apps/api/prisma/schema.prisma), migrations under apps/api/prisma/migrations | Fields/status names alone do not establish an operational UI. |
| Async completion | [Dispatch](../../apps/worker/src/dispatch.ts), [event catalog](../../apps/worker/src/event-catalog.ts), processors below | Queued is not completed; providers and workers determine final outcomes. |

## Current seed versus older tests

Finance Admin has all named permissions in seed, including people/roles/audit/reporting/procurement/accounting. The older auth-matrix fixture omits many of these and grants Manager personal creation permissions that the current seed does not grant. This documentation follows seed plus current enforcement. Seeded Finance Admin role grants are ORGANIZATION, but its user-role assignments specify the US entity; authenticated grants are therefore ENTITY. The live database can differ and was not inspected.

## Known limits requiring trainer attention

| Area | Verified fact | Training treatment |
|---|---|---|
| People entity filter | Resource rule uses entityField=id for users; authenticated entity grants then filter user IDs using entity IDs. | Seeded Finance Admin People list/actions may fail; Owner should handle onboarding and support should inspect the mismatch. |
| Request information | Updates ApprovalInstance to INFO_REQUESTED; no complete requester response route; many domain Approve handlers search IN_REVIEW only. | Teach the action and its limitation; escalate recovery. |
| Expense split | UI appends one split; API requires the full exact balance. | Do not promise normal multi-line entry; full-amount single split only is demonstrable from code. |
| Procurement non-PO outcome | Approval stores a deterministic reference, not actual card/vendor fulfillment. | Hand off to the actual spend/vendor procedure. |
| Procurement quotes | API supports attachments, but generic form lacks attachment/quote upload. | Supporting-document policy blocks may need technical/operator help. |
| Policy Enable | Registry/frontend expose enable; resource access map omits its permission. | Non-Owner can encounter denial; document mismatch. |
| Workflow preview | Runtime falls back to raw steps if all conditional steps filter out. | Empty preview is not proof of zero approval steps on submit. |
| Parallel routing | Engine tracks approvals for a group and advances through outstanding steps. | Do not promise simultaneous independent task fan-out. |
| Reimbursement corrections | Limited draft receipt actions; no full edit/rejected resubmit journey. | Avoid duplicate replacement claims; seek finance decision. |
| Card/fund issuance | Supported through approval/provisioning; no general create form on card/fund list. | Teach actual originating workflow. |
| Budget update / PO changes | Backend support exists; ordinary detail UI lacks full update/change-order workflow. | Inventory backend capability without inventing screen controls. |
| Phase flags | P1/P2 navigation and route gates block many later surfaces by default. | Conditional appendix only. |
| Child catalogs | Some resources lack owner/entity columns and have broader list filtering than action handlers. | Do not promise absolute self/direct-report isolation for every child list. |
| Security page | Direct page exists but is not a primary sidebar entry. | Give exact direct route with session-access caveat. |
| Company name | Handler requires Owner by role name. | Finance Admin may view Settings but cannot save that field. |

## Provider and worker completion

| Integration | Code-verified boundary | What is unverified / limited |
|---|---|---|
| Card issuer | Mock and Stripe factories; issuer webhooks and local control lifecycle. | Active credentials, account funding, webhook delivery, real provider success. |
| Bill payment rail | Mock/Stripe adapter selection; release separate from settlement; mock worker checks PAYMENT_PROVIDER_MODE. | Certified live rail operation and real-bank settlement; adapter naming is insufficient evidence. |
| Reimbursement payout | Mock payout provider in actions; sandbox confirmation; worker completion paths. | Real provider-backed employee payouts. |
| Accounting | MOCK_QBO or QUICKBOOKS_ONLINE jobs; live QuickBooks OAuth/mappings and worker posting. | Live authorization, mapping correctness, and posting success for this deployment. Mock is blocked in production. |
| Travel | Mock/Duffel search factories; sandbox-only hold/confirm/cancel/refund. | No live ticket issuance/payment through the documented journey; travel worker processor is empty. |
| Documents/OCR | Upload, classification, scan readiness, mock OCR adapter and workers. | Correct real receipt extraction and deployed scan/OCR completion. |
| Notifications | Recipient feed and read actions; notification worker. | Real external email delivery. |
| Other adapters | Identity/HRIS/LLM/tax/e-sign/etc. include mock adapters. | A provider interface or model is not a live end-to-end feature. |

## Complete page inventory

A route with [id] uses the actual selected record ID; do not literally type brackets into the application. Source-only scaffold/conditional entries are explicitly outside the completed operating journey.

| App / route | Classification | Source |
|---|---|---|
| advisor-console: /academy | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/academy/page.tsx>) |
| advisor-console: /billing | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/billing/page.tsx>) |
| advisor-console: /clients | Scaffold; no complete authenticated role workflow | [Source](<../../apps/advisor-console/src/app/clients/page.tsx>) |
| advisor-console: /knowledge | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/knowledge/page.tsx>) |
| advisor-console: / | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/page.tsx>) |
| advisor-console: /people | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/people/page.tsx>) |
| advisor-console: /price-intelligence | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/price-intelligence/page.tsx>) |
| advisor-console: /projects | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/projects/page.tsx>) |
| advisor-console: /referrals | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/referrals/page.tsx>) |
| advisor-console: /reporting | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/advisor-console/src/app/reporting/page.tsx>) |
| mobile: /(tabs)/approvals | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/(tabs)/approvals.tsx>) |
| mobile: /(tabs)/cards | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/(tabs)/cards.tsx>) |
| mobile: /(tabs)/expenses | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/(tabs)/expenses.tsx>) |
| mobile: /(tabs)/home | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/(tabs)/home.tsx>) |
| mobile: /(tabs)/more | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/(tabs)/more.tsx>) |
| mobile: /(tabs)/_layout | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/(tabs)/_layout.tsx>) |
| mobile: /ai/ask | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/ai/ask.tsx>) |
| mobile: /approvals/[id] | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/approvals/[id].tsx>) |
| mobile: /cards/[id]/funds | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/cards/[id]/funds.tsx>) |
| mobile: /cards/[id] | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/cards/[id].tsx>) |
| mobile: /expenses/scan | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/expenses/scan.tsx>) |
| mobile: /expenses/[id] | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/expenses/[id].tsx>) |
| mobile: /reimbursements/new | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/mobile/app/reimbursements/new.tsx>) |
| mobile: /reimbursements/[id] | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/reimbursements/[id].tsx>) |
| mobile: /requests/new | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/requests/new.tsx>) |
| mobile: /requests/[id] | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/requests/[id].tsx>) |
| mobile: /settings/notifications | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/settings/notifications.tsx>) |
| mobile: /settings/profile | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/settings/profile.tsx>) |
| mobile: /settings/security | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/settings/security.tsx>) |
| mobile: /transactions/[id] | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/transactions/[id].tsx>) |
| mobile: /travel/search | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/travel/search.tsx>) |
| mobile: /travel/trips/[id] | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/mobile/app/travel/trips/[id].tsx>) |
| mobile: /travel/trips | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/mobile/app/travel/trips.tsx>) |
| mobile: /_layout | Scaffold; no complete authenticated role workflow | [Source](<../../apps/mobile/app/_layout.tsx>) |
| stack: /close-projects | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/stack/src/app/close-projects/page.tsx>) |
| stack: / | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/stack/src/app/page.tsx>) |
| stack: /reconciliations | Scaffold; no complete authenticated role workflow | [Source](<../../apps/stack/src/app/reconciliations/page.tsx>) |
| stack: /reports | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/stack/src/app/reports/page.tsx>) |
| stack: /skills | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/stack/src/app/skills/page.tsx>) |
| stack: /tasks | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/stack/src/app/tasks/page.tsx>) |
| stack: /usage | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/stack/src/app/usage/page.tsx>) |
| stack: /workspaces | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/stack/src/app/workspaces/page.tsx>) |
| vendor-portal: /bills | Scaffold; no complete authenticated role workflow | [Source](<../../apps/vendor-portal/src/app/bills/page.tsx>) |
| vendor-portal: /comments | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/vendor-portal/src/app/comments/page.tsx>) |
| vendor-portal: /documents | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/vendor-portal/src/app/documents/page.tsx>) |
| vendor-portal: / | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/vendor-portal/src/app/page.tsx>) |
| vendor-portal: /payment-tax | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/vendor-portal/src/app/payment-tax/page.tsx>) |
| vendor-portal: /profile | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/vendor-portal/src/app/profile/page.tsx>) |
| web: /activate | Identity UI; code verified; delivery conditional | [Source](<../../apps/web/src/app/activate/page.tsx>) |
| web: /app/accounting/banking | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/banking/page.tsx>) |
| web: /app/accounting/bill-pay | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/bill-pay/page.tsx>) |
| web: /app/accounting/card | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/card/page.tsx>) |
| web: /app/accounting/errors | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/errors/page.tsx>) |
| web: /app/accounting/integrations | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/integrations/page.tsx>) |
| web: /app/accounting/overview | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/overview/page.tsx>) |
| web: /app/accounting/ready-to-sync | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/ready-to-sync/page.tsx>) |
| web: /app/accounting/reimbursements | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/reimbursements/page.tsx>) |
| web: /app/accounting/review | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/review/page.tsx>) |
| web: /app/accounting/rules | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/rules/page.tsx>) |
| web: /app/accounting/synced | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/accounting/synced/page.tsx>) |
| web: /app/ai/activity | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/ai/activity/page.tsx>) |
| web: /app/ai/agents | Conditional P2; incomplete/default blocked | [Source](<../../apps/web/src/app/app/ai/agents/page.tsx>) |
| web: /app/ai/ask | Conditional P2; incomplete/default blocked | [Source](<../../apps/web/src/app/app/ai/ask/page.tsx>) |
| web: /app/ai/router | Conditional P2; incomplete/default blocked | [Source](<../../apps/web/src/app/app/ai/router/page.tsx>) |
| web: /app/ai/sheets | Conditional P2; incomplete/default blocked | [Source](<../../apps/web/src/app/app/ai/sheets/page.tsx>) |
| web: /app/ai/token-spend | Conditional P2; incomplete/default blocked | [Source](<../../apps/web/src/app/app/ai/token-spend/page.tsx>) |
| web: /app/banking/accounts | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/banking/accounts/page.tsx>) |
| web: /app/banking/automations | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/banking/automations/page.tsx>) |
| web: /app/banking/forecast | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/banking/forecast/page.tsx>) |
| web: /app/banking/statements | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/banking/statements/page.tsx>) |
| web: /app/banking/transactions | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/banking/transactions/page.tsx>) |
| web: /app/banking/transfers | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/banking/transfers/page.tsx>) |
| web: /app/bill-pay/bills/new | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/bill-pay/bills/new/page.tsx>) |
| web: /app/bill-pay/bills | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/bill-pay/bills/page.tsx>) |
| web: /app/bill-pay/bills/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/bill-pay/bills/[id]/page.tsx>) |
| web: /app/bill-pay/payment-runs | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/bill-pay/payment-runs/page.tsx>) |
| web: /app/bill-pay/payment-runs/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/bill-pay/payment-runs/[id]/page.tsx>) |
| web: /app/bill-pay/payments | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/bill-pay/payments/page.tsx>) |
| web: /app/bill-pay/payments/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/bill-pay/payments/[id]/page.tsx>) |
| web: /app/bill-pay/recurring | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/bill-pay/recurring/page.tsx>) |
| web: /app/bill-pay/settings | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/bill-pay/settings/page.tsx>) |
| web: /app/cards | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/cards/page.tsx>) |
| web: /app/cards/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/cards/[id]/page.tsx>) |
| web: /app/company/accounting-dimensions | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/accounting-dimensions/page.tsx>) |
| web: /app/company/approvals | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/approvals/page.tsx>) |
| web: /app/company/audit | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/audit/page.tsx>) |
| web: /app/company/billing | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/company/billing/page.tsx>) |
| web: /app/company/departments | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/departments/page.tsx>) |
| web: /app/company/entities | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/entities/page.tsx>) |
| web: /app/company/integrations | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/integrations/page.tsx>) |
| web: /app/company/locations | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/locations/page.tsx>) |
| web: /app/company/people | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/people/page.tsx>) |
| web: /app/company/people/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/people/[id]/page.tsx>) |
| web: /app/company/policy | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/policy/page.tsx>) |
| web: /app/company/rewards | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/company/rewards/page.tsx>) |
| web: /app/company/roles/new | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/roles/new/page.tsx>) |
| web: /app/company/roles | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/roles/page.tsx>) |
| web: /app/company/roles/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/roles/[id]/page.tsx>) |
| web: /app/company/security | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/security/page.tsx>) |
| web: /app/company/settings | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/company/settings/page.tsx>) |
| web: /app/developer | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/developer/page.tsx>) |
| web: /app/disputes | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/disputes/page.tsx>) |
| web: /app/expenses/receipts | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/expenses/receipts/page.tsx>) |
| web: /app/expenses/receipts/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/expenses/receipts/[id]/page.tsx>) |
| web: /app/expenses/reimbursements | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/expenses/reimbursements/page.tsx>) |
| web: /app/expenses/reimbursements/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/expenses/reimbursements/[id]/page.tsx>) |
| web: /app/expenses/transactions | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/expenses/transactions/page.tsx>) |
| web: /app/expenses/transactions/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/expenses/transactions/[id]/page.tsx>) |
| web: /app/expenses/travel | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/expenses/travel/page.tsx>) |
| web: /app/expenses/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/expenses/[id]/page.tsx>) |
| web: /app/home | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/home/page.tsx>) |
| web: /app/inbox | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/inbox/page.tsx>) |
| web: /app/insights/budgets | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/insights/budgets/page.tsx>) |
| web: /app/insights/budgets/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/insights/budgets/[id]/page.tsx>) |
| web: /app/insights/dashboard | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/insights/dashboard/page.tsx>) |
| web: /app/insights/license-intelligence | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/insights/license-intelligence/page.tsx>) |
| web: /app/insights/price-intelligence | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/insights/price-intelligence/page.tsx>) |
| web: /app/insights/reports | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/insights/reports/page.tsx>) |
| web: /app/insights/savings | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/insights/savings/page.tsx>) |
| web: /app/me/cards | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/me/cards/page.tsx>) |
| web: /app/me/cards/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/me/cards/[id]/page.tsx>) |
| web: /app/me/expenses | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/me/expenses/page.tsx>) |
| web: /app/me/reimbursements | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/me/reimbursements/page.tsx>) |
| web: /app/me/requests | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/me/requests/page.tsx>) |
| web: /app/me/travel | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/me/travel/page.tsx>) |
| web: /app/notifications | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/notifications/page.tsx>) |
| web: /app | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/page.tsx>) |
| web: /app/procurement/contracts | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/procurement/contracts/page.tsx>) |
| web: /app/procurement/match-exceptions | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/procurement/match-exceptions/page.tsx>) |
| web: /app/procurement/programs | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/procurement/programs/page.tsx>) |
| web: /app/procurement/purchase-orders | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/procurement/purchase-orders/page.tsx>) |
| web: /app/procurement/purchase-orders/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/procurement/purchase-orders/[id]/page.tsx>) |
| web: /app/procurement/receiving | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/procurement/receiving/page.tsx>) |
| web: /app/procurement/renewals | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/procurement/renewals/page.tsx>) |
| web: /app/procurement/requests | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/procurement/requests/page.tsx>) |
| web: /app/procurement/requests/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/procurement/requests/[id]/page.tsx>) |
| web: /app/procurement/sourcing | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/procurement/sourcing/page.tsx>) |
| web: /app/receivables/cash-application | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/receivables/cash-application/page.tsx>) |
| web: /app/receivables/collections | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/receivables/collections/page.tsx>) |
| web: /app/receivables/customers | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/receivables/customers/page.tsx>) |
| web: /app/receivables/invoices | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/receivables/invoices/page.tsx>) |
| web: /app/receivables/payments | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/receivables/payments/page.tsx>) |
| web: /app/search | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/search/page.tsx>) |
| web: /app/spend/cards | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/cards/page.tsx>) |
| web: /app/spend/cards/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/cards/[id]/page.tsx>) |
| web: /app/spend/funds | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/funds/page.tsx>) |
| web: /app/spend/funds/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/funds/[id]/page.tsx>) |
| web: /app/spend/programs | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/programs/page.tsx>) |
| web: /app/spend/programs/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/programs/[id]/page.tsx>) |
| web: /app/spend/requests | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/requests/page.tsx>) |
| web: /app/spend/requests/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/requests/[id]/page.tsx>) |
| web: /app/spend/transactions | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/transactions/page.tsx>) |
| web: /app/spend/transactions/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/spend/transactions/[id]/page.tsx>) |
| web: /app/tax | Conditional P1; incomplete/default blocked | [Source](<../../apps/web/src/app/app/tax/page.tsx>) |
| web: /app/travel/policy | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/travel/policy/page.tsx>) |
| web: /app/travel/reports | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/travel/reports/page.tsx>) |
| web: /app/travel/requests | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/travel/requests/page.tsx>) |
| web: /app/travel/search | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/travel/search/page.tsx>) |
| web: /app/travel/travelers | Scaffold/unfinished; not an operational workflow | [Source](<../../apps/web/src/app/app/travel/travelers/page.tsx>) |
| web: /app/travel/trips | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/travel/trips/page.tsx>) |
| web: /app/travel/trips/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/travel/trips/[id]/page.tsx>) |
| web: /app/vendors | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/vendors/page.tsx>) |
| web: /app/vendors/[id] | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/app/vendors/[id]/page.tsx>) |
| web: /forgot-password | Identity UI; code verified; delivery conditional | [Source](<../../apps/web/src/app/forgot-password/page.tsx>) |
| web: /login | Identity UI; code verified; delivery conditional | [Source](<../../apps/web/src/app/login/page.tsx>) |
| web: / | Company web; inspect procedure/permission or detail link | [Source](<../../apps/web/src/app/page.tsx>) |
| web: /reset-password | Identity UI; code verified; delivery conditional | [Source](<../../apps/web/src/app/reset-password/page.tsx>) |

## Mounted API resources

All names below are mounted by the registry, under the API base prefix. A mounted reader or empty create handler is not evidence of a complete feature. Resource-specific permission, create/action handlers, parent ownership, and provider limits remain controlling. Resources absent from resource-access rules are Owner-only by default; custom handlers can impose their own checks.

- `identity`
- `inbox`
- `organizations`
- `entities`
- `departments`
- `locations`
- `people`
- `rbac`
- `policies`
- `approvals`
- `accounting-dimensions`
- `budgets`
- `entitlements`
- `country-capabilities`
- `cards`
- `funds`
- `business-limits`
- `spend-programs`
- `spend-requests`
- `authorizations`
- `transactions`
- `disputes`
- `repayments`
- `expenses`
- `receipts`
- `reimbursements`
- `procurement`
- `procurement-programs`
- `purchase-orders`
- `receiving`
- `matches`
- `po-change-orders`
- `vendors`
- `contracts`
- `renewals`
- `sourcing`
- `price-intelligence`
- `license-intelligence`
- `bills`
- `payments`
- `payment-runs`
- `travel`
- `travel-bookings`
- `banking`
- `treasury`
- `accounting`
- `accounting-rules`
- `reconciliation`
- `erp-sync`
- `customers`
- `invoices`
- `incoming-payments`
- `collections`
- `cash-application`
- `rewards`
- `tax-operations`
- `ai-token-spend`
- `router`
- `agent-finance`
- `sheets`
- `reporting`
- `search`
- `documents`
- `notifications`
- `integrations`
- `operations`
- `saved-views`
- `developer-platform`
- `audit`
- `ai`

## Database models

Persistence inventory from schema.prisma. This includes support/relationship/status models; it does not imply additional user roles or accessible screens.

- `Organization`
- `LegalEntity`
- `CountryCapability`
- `User`
- `Session`
- `Department`
- `Location`
- `Role`
- `Permission`
- `RolePermission`
- `UserRole`
- `Entitlement`
- `Policy`
- `ApprovalWorkflow`
- `ApprovalInstance`
- `ApprovalAction`
- `InboxItem`
- `AuditEvent`
- `OutboxEvent`
- `IdempotencyKey`
- `Attachment`
- `Notification`
- `IntegrationConnection`
- `QuickBooksConnection`
- `QuickBooksEntityMap`
- `QuickBooksWebhookEvent`
- `ProviderOAuthState`
- `BusinessLimit`
- `Budget`
- `SavedView`
- `SpendProgram`
- `SpendRequest`
- `Fund`
- `Card`
- `CardEvent`
- `CardAuthorization`
- `LedgerTransaction`
- `LedgerEntry`
- `Txn`
- `Receipt`
- `Expense`
- `ExpenseSplit`
- `Reimbursement`
- `AccountingDimension`
- `AccountingEntry`
- `AccountingRule`
- `SyncJob`
- `SyncAttempt`
- `Vendor`
- `VendorBankAccount`
- `Bill`
- `BillLine`
- `Payment`
- `PaymentRun`
- `ProcurementProgram`
- `PurchaseRequest`
- `PurchaseOrder`
- `PurchaseOrderLine`
- `ReceivingRecord`
- `MatchRecord`
- `PoChangeOrder`
- `Contract`
- `Renewal`
- `TravelTrip`
- `TravelBooking`
- `TravelerProfile`
- `BankAccount`
- `BankTransfer`
- `Customer`
- `Invoice`
- `IncomingPayment`
- `CashApplication`
- `AiUsageRecord`
- `RouterLog`
- `TaxForm`
- `DisputeCase`
- `Repayment`
- `RewardLedger`
- `OAuthApp`
- `WebhookEndpoint`
- `WebhookDelivery`
- `Workbook`
- `AgentIdentity`
- `AiRecommendation`

## Module directory inventory

Module directories contain a mix of active services and architectural scaffolds; verify the mounted registry before treating a route wrapper as operational.

- accounting
- agent-finance
- ai
- ai-token-spend
- ap
- approvals
- audit
- authorizations
- banking
- bills
- budgets
- cards
- cash-application
- collections
- contracts
- country-capabilities
- customers
- developer-platform
- disputes
- documents
- entities
- entitlements
- erp-sync
- expenses
- funds
- identity
- integrations
- invoices
- license-intelligence
- notifications
- organizations
- payment-runs
- payments
- people
- policies
- price-intelligence
- procurement
- purchase-orders
- rbac
- receipts
- receiving
- reconciliation
- reimbursements
- renewals
- repayments
- reporting
- rewards
- router
- search
- sheets
- sourcing
- spend-programs
- spend-requests
- tax-operations
- transactions
- travel
- treasury
- vendors

## Worker processor inventory

- [Source](<../../apps/worker/src/processors/accounting-sync.processor.ts>) — contains processor logic; inspect provider/environment prerequisites
- [Source](<../../apps/worker/src/processors/ai.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/disputes.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/documents.processor.ts>) — contains processor logic; inspect provider/environment prerequisites
- [Source](<../../apps/worker/src/processors/integrations.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/notifications.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/ocr.processor.ts>) — contains processor logic; inspect provider/environment prerequisites
- [Source](<../../apps/worker/src/processors/payments.processor.ts>) — contains processor logic; inspect provider/environment prerequisites
- [Source](<../../apps/worker/src/processors/reporting.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/search-index.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/sheets.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/tax.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/travel.processor.ts>) — empty processor scaffold
- [Source](<../../apps/worker/src/processors/webhooks.processor.ts>) — empty processor scaffold

## Source inspection inventory

This manifest records application/shared source discovered and read during analysis, excluding dependencies, build output, and generated caches. Runtime validation remains separate.

- `apps/advisor-console/next.config.ts`
- `apps/advisor-console/package.json`
- `apps/advisor-console/src/app/academy/page.tsx`
- `apps/advisor-console/src/app/billing/page.tsx`
- `apps/advisor-console/src/app/clients/page.tsx`
- `apps/advisor-console/src/app/knowledge/page.tsx`
- `apps/advisor-console/src/app/layout.tsx`
- `apps/advisor-console/src/app/page.tsx`
- `apps/advisor-console/src/app/people/page.tsx`
- `apps/advisor-console/src/app/price-intelligence/page.tsx`
- `apps/advisor-console/src/app/projects/page.tsx`
- `apps/advisor-console/src/app/referrals/page.tsx`
- `apps/advisor-console/src/app/reporting/page.tsx`
- `apps/advisor-console/tsconfig.json`
- `apps/api/package.json`
- `apps/api/prisma/migrations/20260916120000_init/migration.sql`
- `apps/api/prisma/migrations/20260916190000_m1_foundation_constraints/migration.sql`
- `apps/api/prisma/migrations/20260916193000_people_activation/migration.sql`
- `apps/api/prisma/migrations/20260916200000_m2_inbox_policy/migration.sql`
- `apps/api/prisma/migrations/20260916210000_m3_spend_cards/migration.sql`
- `apps/api/prisma/migrations/20260917120000_m3_card_controls_lifecycle/migration.sql`
- `apps/api/prisma/migrations/20260917140000_m4_receipts_expenses/migration.sql`
- `apps/api/prisma/migrations/20260917160000_m5_reimbursements/migration.sql`
- `apps/api/prisma/migrations/20260917170000_m6_vendor_ap_payments/migration.sql`
- `apps/api/prisma/migrations/20260917180000_m7_accounting_erp/migration.sql`
- `apps/api/prisma/migrations/20260917190000_m8_procurement_pos/migration.sql`
- `apps/api/prisma/migrations/20260917200000_m9_core_travel/migration.sql`
- `apps/api/prisma/migrations/20260917210000_m10_reporting_hardening/migration.sql`
- `apps/api/prisma/migrations/20260920210000_p0_parent_keys/migration.sql`
- `apps/api/prisma/migrations/20260920211000_p0_foreign_keys_not_valid/migration.sql`
- `apps/api/prisma/migrations/20260920212000_p0_foreign_keys_validate/migration.sql`
- `apps/api/prisma/migrations/20260920220000_m0_m1_foundation_hardening/migration.sql`
- `apps/api/prisma/migrations/20260920230000_p0_gf1_spend_policy/migration.sql`
- `apps/api/prisma/migrations/20260921120000_p0_gf2_ap_hardening/migration.sql`
- `apps/api/prisma/migrations/20260921140000_p0_gf3_procurement/migration.sql`
- `apps/api/prisma/migrations/20260921160000_p0_gf4_reimbursements/migration.sql`
- `apps/api/prisma/migrations/20260921180000_p0_gf5_travel/migration.sql`
- `apps/api/prisma/migrations/20260922120000_p0_5_ux_operational/migration.sql`
- `apps/api/prisma/migrations/20260922130000_p0_5_entity_status/migration.sql`
- `apps/api/prisma/migrations/20260922140000_preserve_existing_workflows/migration.sql`
- `apps/api/prisma/migrations/20260928190000_stripe_issuing_mappings/migration.sql`
- `apps/api/prisma/migrations/20261006120000_quickbooks_oauth/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed-e2e-tenant.ts`
- `apps/api/prisma/seed.ts`
- `apps/api/src/app/app.ts`
- `apps/api/src/app/bootstrap.ts`
- `apps/api/src/app/routes.ts`
- `apps/api/src/app/server.ts`
- `apps/api/src/application/actions.ts`
- `apps/api/src/config/env.ts`
- `apps/api/src/database/client.ts`
- `apps/api/src/engines/documents/index.ts`
- `apps/api/src/engines/inbox/index.ts`
- `apps/api/src/engines/inbox/sync.ts`
- `apps/api/src/engines/index.ts`
- `apps/api/src/engines/ledger/index.ts`
- `apps/api/src/engines/policy/index.ts`
- `apps/api/src/engines/search/index.ts`
- `apps/api/src/engines/workflow/index.ts`
- `apps/api/src/integrations/accounting/accounting.provider.ts`
- `apps/api/src/integrations/accounting/index.ts`
- `apps/api/src/integrations/accounting/mock.accounting.adapter.ts`
- `apps/api/src/integrations/accounting/quickbooks.service.ts`
- `apps/api/src/integrations/ai-usage/ai-usage.provider.ts`
- `apps/api/src/integrations/ai-usage/index.ts`
- `apps/api/src/integrations/ai-usage/mock.ai-usage.adapter.ts`
- `apps/api/src/integrations/bank-data/bank-data.provider.ts`
- `apps/api/src/integrations/bank-data/index.ts`
- `apps/api/src/integrations/bank-data/mock.bank-data.adapter.ts`
- `apps/api/src/integrations/card-issuer/card-issuer.provider.ts`
- `apps/api/src/integrations/card-issuer/factory.ts`
- `apps/api/src/integrations/card-issuer/index.ts`
- `apps/api/src/integrations/card-issuer/mock.card-issuer.adapter.ts`
- `apps/api/src/integrations/card-issuer/stripe-spending-categories.ts`
- `apps/api/src/integrations/card-issuer/stripe.card-issuer.adapter.ts`
- `apps/api/src/integrations/collaboration/collaboration.provider.ts`
- `apps/api/src/integrations/collaboration/index.ts`
- `apps/api/src/integrations/collaboration/mock.collaboration.adapter.ts`
- `apps/api/src/integrations/contract/contract.provider.ts`
- `apps/api/src/integrations/contract/index.ts`
- `apps/api/src/integrations/contract/mock.contract.adapter.ts`
- `apps/api/src/integrations/data-export/data-export.provider.ts`
- `apps/api/src/integrations/data-export/index.ts`
- `apps/api/src/integrations/data-export/mock.data-export.adapter.ts`
- `apps/api/src/integrations/e-sign/e-sign.provider.ts`
- `apps/api/src/integrations/e-sign/index.ts`
- `apps/api/src/integrations/e-sign/mock.e-sign.adapter.ts`
- `apps/api/src/integrations/email/email.provider.ts`
- `apps/api/src/integrations/email/index.ts`
- `apps/api/src/integrations/email/mock.email.adapter.ts`
- `apps/api/src/integrations/hris/hris.provider.ts`
- `apps/api/src/integrations/hris/index.ts`
- `apps/api/src/integrations/hris/mock.hris.adapter.ts`
- `apps/api/src/integrations/identity/identity.provider.ts`
- `apps/api/src/integrations/identity/index.ts`
- `apps/api/src/integrations/identity/mock.identity.adapter.ts`
- `apps/api/src/integrations/index.ts`
- `apps/api/src/integrations/llm/index.ts`
- `apps/api/src/integrations/llm/llm.provider.ts`
- `apps/api/src/integrations/llm/mock.llm.adapter.ts`
- `apps/api/src/integrations/ocr/index.ts`
- `apps/api/src/integrations/ocr/mock.ocr.adapter.ts`
- `apps/api/src/integrations/ocr/ocr.provider.ts`
- `apps/api/src/integrations/payment-rail/factory.ts`
- `apps/api/src/integrations/payment-rail/index.ts`
- `apps/api/src/integrations/payment-rail/mock.payment-rail.adapter.ts`
- `apps/api/src/integrations/payment-rail/payment-rail.provider.ts`
- `apps/api/src/integrations/payment-rail/stripe.payment-rail.adapter.ts`
- `apps/api/src/integrations/payout/mock.payout.adapter.ts`
- `apps/api/src/integrations/sanctions-screening/index.ts`
- `apps/api/src/integrations/sanctions-screening/mock.sanctions-screening.adapter.ts`
- `apps/api/src/integrations/sanctions-screening/sanctions-screening.provider.ts`
- `apps/api/src/integrations/tax-filing/index.ts`
- `apps/api/src/integrations/tax-filing/mock.tax-filing.adapter.ts`
- `apps/api/src/integrations/tax-filing/tax-filing.provider.ts`
- `apps/api/src/integrations/travel/duffel.travel.adapter.ts`
- `apps/api/src/integrations/travel/factory.ts`
- `apps/api/src/integrations/travel/index.ts`
- `apps/api/src/integrations/travel/mock.travel.adapter.ts`
- `apps/api/src/integrations/travel/travel.provider.ts`
- `apps/api/src/modules/accounting/api/accounting.controller.ts`
- `apps/api/src/modules/accounting/api/accounting.presenter.ts`
- `apps/api/src/modules/accounting/api/accounting.routes.ts`
- `apps/api/src/modules/accounting/api/accounting.schema.ts`
- `apps/api/src/modules/accounting/api/quickbooks.routes.ts`
- `apps/api/src/modules/accounting/application/services/accounting.service.ts`
- `apps/api/src/modules/accounting/domain/repositories/accounting.repository.ts`
- `apps/api/src/modules/accounting/domain/rules.ts`
- `apps/api/src/modules/accounting/domain/state-machine.ts`
- `apps/api/src/modules/accounting/index.ts`
- `apps/api/src/modules/agent-finance/api/agent-finance.controller.ts`
- `apps/api/src/modules/agent-finance/api/agent-finance.presenter.ts`
- `apps/api/src/modules/agent-finance/api/agent-finance.routes.ts`
- `apps/api/src/modules/agent-finance/api/agent-finance.schema.ts`
- `apps/api/src/modules/agent-finance/application/services/agent-finance.service.ts`
- `apps/api/src/modules/agent-finance/domain/repositories/agent-finance.repository.ts`
- `apps/api/src/modules/agent-finance/domain/state-machine.ts`
- `apps/api/src/modules/agent-finance/index.ts`
- `apps/api/src/modules/ai/agents/accounting-agent/index.ts`
- `apps/api/src/modules/ai/agents/ap-agent/index.ts`
- `apps/api/src/modules/ai/agents/collections-agent/index.ts`
- `apps/api/src/modules/ai/agents/contract-agent/index.ts`
- `apps/api/src/modules/ai/agents/inbox-agent/index.ts`
- `apps/api/src/modules/ai/agents/policy-agent/index.ts`
- `apps/api/src/modules/ai/agents/procurement-agent/index.ts`
- `apps/api/src/modules/ai/agents/reporting-agent/index.ts`
- `apps/api/src/modules/ai/api/ai.controller.ts`
- `apps/api/src/modules/ai/api/ai.presenter.ts`
- `apps/api/src/modules/ai/api/ai.routes.ts`
- `apps/api/src/modules/ai/api/ai.schema.ts`
- `apps/api/src/modules/ai/application/services/ai.service.ts`
- `apps/api/src/modules/ai/domain/repositories/ai.repository.ts`
- `apps/api/src/modules/ai/domain/state-machine.ts`
- `apps/api/src/modules/ai/evaluations/index.ts`
- `apps/api/src/modules/ai/guardrails/index.ts`
- `apps/api/src/modules/ai/index.ts`
- `apps/api/src/modules/ai/orchestrator.ts`
- `apps/api/src/modules/ai/prompts/index.ts`
- `apps/api/src/modules/ai/providers/index.ts`
- `apps/api/src/modules/ai/tools/index.ts`
- `apps/api/src/modules/ai-token-spend/api/ai-token-spend.controller.ts`
- `apps/api/src/modules/ai-token-spend/api/ai-token-spend.presenter.ts`
- `apps/api/src/modules/ai-token-spend/api/ai-token-spend.routes.ts`
- `apps/api/src/modules/ai-token-spend/api/ai-token-spend.schema.ts`
- `apps/api/src/modules/ai-token-spend/application/services/ai-token-spend.service.ts`
- `apps/api/src/modules/ai-token-spend/domain/repositories/ai-token-spend.repository.ts`
- `apps/api/src/modules/ai-token-spend/domain/state-machine.ts`
- `apps/api/src/modules/ai-token-spend/index.ts`
- `apps/api/src/modules/ap/domain/duplicate-check.ts`
- `apps/api/src/modules/ap/domain/vendor-match.ts`
- `apps/api/src/modules/approvals/api/approval.controller.ts`
- `apps/api/src/modules/approvals/api/approval.presenter.ts`
- `apps/api/src/modules/approvals/api/approval.routes.ts`
- `apps/api/src/modules/approvals/api/approval.schema.ts`
- `apps/api/src/modules/approvals/application/services/approval.service.ts`
- `apps/api/src/modules/approvals/domain/repositories/approval.repository.ts`
- `apps/api/src/modules/approvals/domain/state-machine.ts`
- `apps/api/src/modules/approvals/index.ts`
- `apps/api/src/modules/audit/api/audit.controller.ts`
- `apps/api/src/modules/audit/api/audit.presenter.ts`
- `apps/api/src/modules/audit/api/audit.routes.ts`
- `apps/api/src/modules/audit/api/audit.schema.ts`
- `apps/api/src/modules/audit/application/services/audit.service.ts`
- `apps/api/src/modules/audit/domain/repositories/audit.repository.ts`
- `apps/api/src/modules/audit/domain/state-machine.ts`
- `apps/api/src/modules/audit/index.ts`
- `apps/api/src/modules/authorizations/api/authorization.controller.ts`
- `apps/api/src/modules/authorizations/api/authorization.presenter.ts`
- `apps/api/src/modules/authorizations/api/authorization.routes.ts`
- `apps/api/src/modules/authorizations/api/authorization.schema.ts`
- `apps/api/src/modules/authorizations/application/services/authorization.service.ts`
- `apps/api/src/modules/authorizations/domain/repositories/authorization.repository.ts`
- `apps/api/src/modules/authorizations/domain/state-machine.ts`
- `apps/api/src/modules/authorizations/index.ts`
- `apps/api/src/modules/banking/api/banking.controller.ts`
- `apps/api/src/modules/banking/api/banking.presenter.ts`
- `apps/api/src/modules/banking/api/banking.routes.ts`
- `apps/api/src/modules/banking/api/banking.schema.ts`
- `apps/api/src/modules/banking/application/services/banking.service.ts`
- `apps/api/src/modules/banking/domain/repositories/banking.repository.ts`
- `apps/api/src/modules/banking/domain/state-machine.ts`
- `apps/api/src/modules/banking/index.ts`
- `apps/api/src/modules/bills/api/bill.controller.ts`
- `apps/api/src/modules/bills/api/bill.presenter.ts`
- `apps/api/src/modules/bills/api/bill.routes.ts`
- `apps/api/src/modules/bills/api/bill.schema.ts`
- `apps/api/src/modules/bills/application/services/bill.service.ts`
- `apps/api/src/modules/bills/domain/repositories/bill.repository.ts`
- `apps/api/src/modules/bills/domain/state-machine.ts`
- `apps/api/src/modules/bills/index.ts`
- `apps/api/src/modules/budgets/api/budget.controller.ts`
- `apps/api/src/modules/budgets/api/budget.presenter.ts`
- `apps/api/src/modules/budgets/api/budget.routes.ts`
- `apps/api/src/modules/budgets/api/budget.schema.ts`
- `apps/api/src/modules/budgets/application/services/budget.service.ts`
- `apps/api/src/modules/budgets/domain/repositories/budget.repository.ts`
- `apps/api/src/modules/budgets/domain/state-machine.ts`
- `apps/api/src/modules/budgets/index.ts`
- `apps/api/src/modules/cards/api/card.controller.ts`
- `apps/api/src/modules/cards/api/card.presenter.ts`
- `apps/api/src/modules/cards/api/card.routes.ts`
- `apps/api/src/modules/cards/api/card.schema.ts`
- `apps/api/src/modules/cards/api/stripe-webhook.routes.ts`
- `apps/api/src/modules/cards/application/services/card.service.ts`
- `apps/api/src/modules/cards/application/stripe-issuing-webhook.ts`
- `apps/api/src/modules/cards/application/stripe-transaction-settlement.ts`
- `apps/api/src/modules/cards/domain/authorization-rules.ts`
- `apps/api/src/modules/cards/domain/repositories/card.repository.ts`
- `apps/api/src/modules/cards/domain/state-machine.ts`
- `apps/api/src/modules/cards/index.ts`
- `apps/api/src/modules/cash-application/api/cash-application.controller.ts`
- `apps/api/src/modules/cash-application/api/cash-application.presenter.ts`
- `apps/api/src/modules/cash-application/api/cash-application.routes.ts`
- `apps/api/src/modules/cash-application/api/cash-application.schema.ts`
- `apps/api/src/modules/cash-application/application/services/cash-application.service.ts`
- `apps/api/src/modules/cash-application/domain/repositories/cash-application.repository.ts`
- `apps/api/src/modules/cash-application/domain/state-machine.ts`
- `apps/api/src/modules/cash-application/index.ts`
- `apps/api/src/modules/collections/api/collection.controller.ts`
- `apps/api/src/modules/collections/api/collection.presenter.ts`
- `apps/api/src/modules/collections/api/collection.routes.ts`
- `apps/api/src/modules/collections/api/collection.schema.ts`
- `apps/api/src/modules/collections/application/services/collection.service.ts`
- `apps/api/src/modules/collections/domain/repositories/collection.repository.ts`
- `apps/api/src/modules/collections/domain/state-machine.ts`
- `apps/api/src/modules/collections/index.ts`
- `apps/api/src/modules/contracts/api/contract.controller.ts`
- `apps/api/src/modules/contracts/api/contract.presenter.ts`
- `apps/api/src/modules/contracts/api/contract.routes.ts`
- `apps/api/src/modules/contracts/api/contract.schema.ts`
- `apps/api/src/modules/contracts/application/services/contract.service.ts`
- `apps/api/src/modules/contracts/domain/repositories/contract.repository.ts`
- `apps/api/src/modules/contracts/domain/state-machine.ts`
- `apps/api/src/modules/contracts/index.ts`
- `apps/api/src/modules/country-capabilities/api/country-capability.controller.ts`
- `apps/api/src/modules/country-capabilities/api/country-capability.presenter.ts`
- `apps/api/src/modules/country-capabilities/api/country-capability.routes.ts`
- `apps/api/src/modules/country-capabilities/api/country-capability.schema.ts`
- `apps/api/src/modules/country-capabilities/application/services/country-capability.service.ts`
- `apps/api/src/modules/country-capabilities/domain/repositories/country-capability.repository.ts`
- `apps/api/src/modules/country-capabilities/domain/state-machine.ts`
- `apps/api/src/modules/country-capabilities/index.ts`
- `apps/api/src/modules/customers/api/customer.controller.ts`
- `apps/api/src/modules/customers/api/customer.presenter.ts`
- `apps/api/src/modules/customers/api/customer.routes.ts`
- `apps/api/src/modules/customers/api/customer.schema.ts`
- `apps/api/src/modules/customers/application/services/customer.service.ts`
- `apps/api/src/modules/customers/domain/repositories/customer.repository.ts`
- `apps/api/src/modules/customers/domain/state-machine.ts`
- `apps/api/src/modules/customers/index.ts`
- `apps/api/src/modules/developer-platform/api/developer-platform.controller.ts`
- `apps/api/src/modules/developer-platform/api/developer-platform.presenter.ts`
- `apps/api/src/modules/developer-platform/api/developer-platform.routes.ts`
- `apps/api/src/modules/developer-platform/api/developer-platform.schema.ts`
- `apps/api/src/modules/developer-platform/application/services/developer-platform.service.ts`
- `apps/api/src/modules/developer-platform/domain/repositories/developer-platform.repository.ts`
- `apps/api/src/modules/developer-platform/domain/state-machine.ts`
- `apps/api/src/modules/developer-platform/index.ts`
- `apps/api/src/modules/disputes/api/dispute.controller.ts`
- `apps/api/src/modules/disputes/api/dispute.presenter.ts`
- `apps/api/src/modules/disputes/api/dispute.routes.ts`
- `apps/api/src/modules/disputes/api/dispute.schema.ts`
- `apps/api/src/modules/disputes/application/services/dispute.service.ts`
- `apps/api/src/modules/disputes/domain/repositories/dispute.repository.ts`
- `apps/api/src/modules/disputes/domain/state-machine.ts`
- `apps/api/src/modules/disputes/index.ts`
- `apps/api/src/modules/documents/api/document.controller.ts`
- `apps/api/src/modules/documents/api/document.presenter.ts`
- `apps/api/src/modules/documents/api/document.routes.ts`
- `apps/api/src/modules/documents/api/document.schema.ts`
- `apps/api/src/modules/documents/application/services/document.service.ts`
- `apps/api/src/modules/documents/domain/repositories/document.repository.ts`
- `apps/api/src/modules/documents/domain/state-machine.ts`
- `apps/api/src/modules/documents/index.ts`
- `apps/api/src/modules/entities/api/entity.controller.ts`
- `apps/api/src/modules/entities/api/entity.presenter.ts`
- `apps/api/src/modules/entities/api/entity.routes.ts`
- `apps/api/src/modules/entities/api/entity.schema.ts`
- `apps/api/src/modules/entities/application/services/entity.service.ts`
- `apps/api/src/modules/entities/domain/repositories/entity.repository.ts`
- `apps/api/src/modules/entities/domain/state-machine.ts`
- `apps/api/src/modules/entities/index.ts`
- `apps/api/src/modules/entitlements/api/entitlement.controller.ts`
- `apps/api/src/modules/entitlements/api/entitlement.presenter.ts`
- `apps/api/src/modules/entitlements/api/entitlement.routes.ts`
- `apps/api/src/modules/entitlements/api/entitlement.schema.ts`
- `apps/api/src/modules/entitlements/application/services/entitlement.service.ts`
- `apps/api/src/modules/entitlements/domain/repositories/entitlement.repository.ts`
- `apps/api/src/modules/entitlements/domain/state-machine.ts`
- `apps/api/src/modules/entitlements/index.ts`
- `apps/api/src/modules/erp-sync/api/erp-sync.controller.ts`
- `apps/api/src/modules/erp-sync/api/erp-sync.presenter.ts`
- `apps/api/src/modules/erp-sync/api/erp-sync.routes.ts`
- `apps/api/src/modules/erp-sync/api/erp-sync.schema.ts`
- `apps/api/src/modules/erp-sync/application/services/erp-sync.service.ts`
- `apps/api/src/modules/erp-sync/domain/repositories/erp-sync.repository.ts`
- `apps/api/src/modules/erp-sync/domain/state-machine.ts`
- `apps/api/src/modules/erp-sync/index.ts`
- `apps/api/src/modules/expenses/api/expense.controller.ts`
- `apps/api/src/modules/expenses/api/expense.presenter.ts`
- `apps/api/src/modules/expenses/api/expense.routes.ts`
- `apps/api/src/modules/expenses/api/expense.schema.ts`
- `apps/api/src/modules/expenses/application/services/expense.service.ts`
- `apps/api/src/modules/expenses/domain/repositories/expense.repository.ts`
- `apps/api/src/modules/expenses/domain/requirements.ts`
- `apps/api/src/modules/expenses/domain/state-machine.ts`
- `apps/api/src/modules/expenses/index.ts`
- `apps/api/src/modules/funds/api/fund.controller.ts`
- `apps/api/src/modules/funds/api/fund.presenter.ts`
- `apps/api/src/modules/funds/api/fund.routes.ts`
- `apps/api/src/modules/funds/api/fund.schema.ts`
- `apps/api/src/modules/funds/application/services/fund.service.ts`
- `apps/api/src/modules/funds/domain/repositories/fund.repository.ts`
- `apps/api/src/modules/funds/domain/state-machine.ts`
- `apps/api/src/modules/funds/index.ts`
- `apps/api/src/modules/identity/api/identity.controller.ts`
- `apps/api/src/modules/identity/api/identity.presenter.ts`
- `apps/api/src/modules/identity/api/identity.routes.ts`
- `apps/api/src/modules/identity/api/identity.schema.ts`
- `apps/api/src/modules/identity/application/services/identity.service.ts`
- `apps/api/src/modules/identity/domain/repositories/identity.repository.ts`
- `apps/api/src/modules/identity/domain/state-machine.ts`
- `apps/api/src/modules/identity/index.ts`
- `apps/api/src/modules/inbox.routes.ts`
- `apps/api/src/modules/integrations/api/integration.controller.ts`
- `apps/api/src/modules/integrations/api/integration.presenter.ts`
- `apps/api/src/modules/integrations/api/integration.routes.ts`
- `apps/api/src/modules/integrations/api/integration.schema.ts`
- `apps/api/src/modules/integrations/application/services/integration.service.ts`
- `apps/api/src/modules/integrations/domain/repositories/integration.repository.ts`
- `apps/api/src/modules/integrations/domain/state-machine.ts`
- `apps/api/src/modules/integrations/index.ts`
- `apps/api/src/modules/invoices/api/invoice.controller.ts`
- `apps/api/src/modules/invoices/api/invoice.presenter.ts`
- `apps/api/src/modules/invoices/api/invoice.routes.ts`
- `apps/api/src/modules/invoices/api/invoice.schema.ts`
- `apps/api/src/modules/invoices/application/services/invoice.service.ts`
- `apps/api/src/modules/invoices/domain/repositories/invoice.repository.ts`
- `apps/api/src/modules/invoices/domain/state-machine.ts`
- `apps/api/src/modules/invoices/index.ts`
- `apps/api/src/modules/license-intelligence/api/license-intelligence.controller.ts`
- `apps/api/src/modules/license-intelligence/api/license-intelligence.presenter.ts`
- `apps/api/src/modules/license-intelligence/api/license-intelligence.routes.ts`
- `apps/api/src/modules/license-intelligence/api/license-intelligence.schema.ts`
- `apps/api/src/modules/license-intelligence/application/services/license-intelligence.service.ts`
- `apps/api/src/modules/license-intelligence/domain/repositories/license-intelligence.repository.ts`
- `apps/api/src/modules/license-intelligence/domain/state-machine.ts`
- `apps/api/src/modules/license-intelligence/index.ts`
- `apps/api/src/modules/notifications/api/notification.controller.ts`
- `apps/api/src/modules/notifications/api/notification.presenter.ts`
- `apps/api/src/modules/notifications/api/notification.routes.ts`
- `apps/api/src/modules/notifications/api/notification.schema.ts`
- `apps/api/src/modules/notifications/application/services/notification.service.ts`
- `apps/api/src/modules/notifications/domain/repositories/notification.repository.ts`
- `apps/api/src/modules/notifications/domain/state-machine.ts`
- `apps/api/src/modules/notifications/index.ts`
- `apps/api/src/modules/organizations/api/organization.controller.ts`
- `apps/api/src/modules/organizations/api/organization.presenter.ts`
- `apps/api/src/modules/organizations/api/organization.routes.ts`
- `apps/api/src/modules/organizations/api/organization.schema.ts`
- `apps/api/src/modules/organizations/application/services/organization.service.ts`
- `apps/api/src/modules/organizations/domain/repositories/organization.repository.ts`
- `apps/api/src/modules/organizations/domain/state-machine.ts`
- `apps/api/src/modules/organizations/index.ts`
- `apps/api/src/modules/payment-runs/api/payment-run.controller.ts`
- `apps/api/src/modules/payment-runs/api/payment-run.presenter.ts`
- `apps/api/src/modules/payment-runs/api/payment-run.routes.ts`
- `apps/api/src/modules/payment-runs/api/payment-run.schema.ts`
- `apps/api/src/modules/payment-runs/application/services/payment-run.service.ts`
- `apps/api/src/modules/payment-runs/domain/repositories/payment-run.repository.ts`
- `apps/api/src/modules/payment-runs/domain/state-machine.ts`
- `apps/api/src/modules/payment-runs/index.ts`
- `apps/api/src/modules/payments/api/payment.controller.ts`
- `apps/api/src/modules/payments/api/payment.presenter.ts`
- `apps/api/src/modules/payments/api/payment.routes.ts`
- `apps/api/src/modules/payments/api/payment.schema.ts`
- `apps/api/src/modules/payments/application/services/payment.service.ts`
- `apps/api/src/modules/payments/domain/repositories/payment.repository.ts`
- `apps/api/src/modules/payments/domain/state-machine.ts`
- `apps/api/src/modules/payments/index.ts`
- `apps/api/src/modules/people/api/people.controller.ts`
- `apps/api/src/modules/people/api/people.presenter.ts`
- `apps/api/src/modules/people/api/people.routes.ts`
- `apps/api/src/modules/people/api/people.schema.ts`
- `apps/api/src/modules/people/application/services/people.service.ts`
- `apps/api/src/modules/people/domain/repositories/people.repository.ts`
- `apps/api/src/modules/people/domain/state-machine.ts`
- `apps/api/src/modules/people/index.ts`
- `apps/api/src/modules/policies/api/policy.controller.ts`
- `apps/api/src/modules/policies/api/policy.presenter.ts`
- `apps/api/src/modules/policies/api/policy.routes.ts`
- `apps/api/src/modules/policies/api/policy.schema.ts`
- `apps/api/src/modules/policies/application/services/policy.service.ts`
- `apps/api/src/modules/policies/domain/repositories/policy.repository.ts`
- `apps/api/src/modules/policies/domain/state-machine.ts`
- `apps/api/src/modules/policies/index.ts`
- `apps/api/src/modules/price-intelligence/api/price-intelligence.controller.ts`
- `apps/api/src/modules/price-intelligence/api/price-intelligence.presenter.ts`
- `apps/api/src/modules/price-intelligence/api/price-intelligence.routes.ts`
- `apps/api/src/modules/price-intelligence/api/price-intelligence.schema.ts`
- `apps/api/src/modules/price-intelligence/application/services/price-intelligence.service.ts`
- `apps/api/src/modules/price-intelligence/domain/repositories/price-intelligence.repository.ts`
- `apps/api/src/modules/price-intelligence/domain/state-machine.ts`
- `apps/api/src/modules/price-intelligence/index.ts`
- `apps/api/src/modules/procurement/api/procurement.controller.ts`
- `apps/api/src/modules/procurement/api/procurement.presenter.ts`
- `apps/api/src/modules/procurement/api/procurement.routes.ts`
- `apps/api/src/modules/procurement/api/procurement.schema.ts`
- `apps/api/src/modules/procurement/application/services/procurement.service.ts`
- `apps/api/src/modules/procurement/domain/match.ts`
- `apps/api/src/modules/procurement/domain/repositories/procurement.repository.ts`
- `apps/api/src/modules/procurement/domain/state-machine.ts`
- `apps/api/src/modules/procurement/index.ts`
- `apps/api/src/modules/purchase-orders/api/purchase-order.controller.ts`
- `apps/api/src/modules/purchase-orders/api/purchase-order.presenter.ts`
- `apps/api/src/modules/purchase-orders/api/purchase-order.routes.ts`
- `apps/api/src/modules/purchase-orders/api/purchase-order.schema.ts`
- `apps/api/src/modules/purchase-orders/application/services/purchase-order.service.ts`
- `apps/api/src/modules/purchase-orders/domain/repositories/purchase-order.repository.ts`
- `apps/api/src/modules/purchase-orders/domain/state-machine.ts`
- `apps/api/src/modules/purchase-orders/index.ts`
- `apps/api/src/modules/rbac/api/rbac.controller.ts`
- `apps/api/src/modules/rbac/api/rbac.presenter.ts`
- `apps/api/src/modules/rbac/api/rbac.routes.ts`
- `apps/api/src/modules/rbac/api/rbac.schema.ts`
- `apps/api/src/modules/rbac/application/services/rbac.service.ts`
- `apps/api/src/modules/rbac/domain/repositories/rbac.repository.ts`
- `apps/api/src/modules/rbac/domain/state-machine.ts`
- `apps/api/src/modules/rbac/index.ts`
- `apps/api/src/modules/receipts/api/receipt.controller.ts`
- `apps/api/src/modules/receipts/api/receipt.presenter.ts`
- `apps/api/src/modules/receipts/api/receipt.routes.ts`
- `apps/api/src/modules/receipts/api/receipt.schema.ts`
- `apps/api/src/modules/receipts/application/services/receipt.service.ts`
- `apps/api/src/modules/receipts/domain/repositories/receipt.repository.ts`
- `apps/api/src/modules/receipts/domain/state-machine.ts`
- `apps/api/src/modules/receipts/index.ts`
- `apps/api/src/modules/receiving/api/receiving.controller.ts`
- `apps/api/src/modules/receiving/api/receiving.presenter.ts`
- `apps/api/src/modules/receiving/api/receiving.routes.ts`
- `apps/api/src/modules/receiving/api/receiving.schema.ts`
- `apps/api/src/modules/receiving/application/services/receiving.service.ts`
- `apps/api/src/modules/receiving/domain/repositories/receiving.repository.ts`
- `apps/api/src/modules/receiving/domain/state-machine.ts`
- `apps/api/src/modules/receiving/index.ts`
- `apps/api/src/modules/reconciliation/api/reconciliation.controller.ts`
- `apps/api/src/modules/reconciliation/api/reconciliation.presenter.ts`
- `apps/api/src/modules/reconciliation/api/reconciliation.routes.ts`
- `apps/api/src/modules/reconciliation/api/reconciliation.schema.ts`
- `apps/api/src/modules/reconciliation/application/services/reconciliation.service.ts`
- `apps/api/src/modules/reconciliation/domain/repositories/reconciliation.repository.ts`
- `apps/api/src/modules/reconciliation/domain/state-machine.ts`
- `apps/api/src/modules/reconciliation/index.ts`
- `apps/api/src/modules/registry.ts`
- `apps/api/src/modules/reimbursements/api/reimbursement.controller.ts`
- `apps/api/src/modules/reimbursements/api/reimbursement.presenter.ts`
- `apps/api/src/modules/reimbursements/api/reimbursement.routes.ts`
- `apps/api/src/modules/reimbursements/api/reimbursement.schema.ts`
- `apps/api/src/modules/reimbursements/application/services/reimbursement.service.ts`
- `apps/api/src/modules/reimbursements/domain/calc.ts`
- `apps/api/src/modules/reimbursements/domain/duplicate.ts`
- `apps/api/src/modules/reimbursements/domain/repositories/reimbursement.repository.ts`
- `apps/api/src/modules/reimbursements/domain/requirements.ts`
- `apps/api/src/modules/reimbursements/domain/state-machine.ts`
- `apps/api/src/modules/reimbursements/index.ts`
- `apps/api/src/modules/renewals/api/renewal.controller.ts`
- `apps/api/src/modules/renewals/api/renewal.presenter.ts`
- `apps/api/src/modules/renewals/api/renewal.routes.ts`
- `apps/api/src/modules/renewals/api/renewal.schema.ts`
- `apps/api/src/modules/renewals/application/services/renewal.service.ts`
- `apps/api/src/modules/renewals/domain/repositories/renewal.repository.ts`
- `apps/api/src/modules/renewals/domain/state-machine.ts`
- `apps/api/src/modules/renewals/index.ts`
- `apps/api/src/modules/repayments/api/repayment.controller.ts`
- `apps/api/src/modules/repayments/api/repayment.presenter.ts`
- `apps/api/src/modules/repayments/api/repayment.routes.ts`
- `apps/api/src/modules/repayments/api/repayment.schema.ts`
- `apps/api/src/modules/repayments/application/services/repayment.service.ts`
- `apps/api/src/modules/repayments/domain/repositories/repayment.repository.ts`
- `apps/api/src/modules/repayments/domain/state-machine.ts`
- `apps/api/src/modules/repayments/index.ts`
- `apps/api/src/modules/reporting/api/reporting.controller.ts`
- `apps/api/src/modules/reporting/api/reporting.presenter.ts`
- `apps/api/src/modules/reporting/api/reporting.routes.ts`
- `apps/api/src/modules/reporting/api/reporting.schema.ts`
- `apps/api/src/modules/reporting/application/services/reporting.service.ts`
- `apps/api/src/modules/reporting/domain/budget-math.ts`
- `apps/api/src/modules/reporting/domain/repositories/reporting.repository.ts`
- `apps/api/src/modules/reporting/domain/state-machine.ts`
- `apps/api/src/modules/reporting/index.ts`
- `apps/api/src/modules/rewards/api/reward.controller.ts`
- `apps/api/src/modules/rewards/api/reward.presenter.ts`
- `apps/api/src/modules/rewards/api/reward.routes.ts`
- `apps/api/src/modules/rewards/api/reward.schema.ts`
- `apps/api/src/modules/rewards/application/services/reward.service.ts`
- `apps/api/src/modules/rewards/domain/repositories/reward.repository.ts`
- `apps/api/src/modules/rewards/domain/state-machine.ts`
- `apps/api/src/modules/rewards/index.ts`
- `apps/api/src/modules/router/api/router.controller.ts`
- `apps/api/src/modules/router/api/router.presenter.ts`
- `apps/api/src/modules/router/api/router.routes.ts`
- `apps/api/src/modules/router/api/router.schema.ts`
- `apps/api/src/modules/router/application/services/router.service.ts`
- `apps/api/src/modules/router/domain/repositories/router.repository.ts`
- `apps/api/src/modules/router/domain/state-machine.ts`
- `apps/api/src/modules/router/index.ts`
- `apps/api/src/modules/search/api/search.controller.ts`
- `apps/api/src/modules/search/api/search.presenter.ts`
- `apps/api/src/modules/search/api/search.routes.ts`
- `apps/api/src/modules/search/api/search.schema.ts`
- `apps/api/src/modules/search/application/services/search.service.ts`
- `apps/api/src/modules/search/domain/repositories/search.repository.ts`
- `apps/api/src/modules/search/domain/state-machine.ts`
- `apps/api/src/modules/search/index.ts`
- `apps/api/src/modules/sheets/api/sheet.controller.ts`
- `apps/api/src/modules/sheets/api/sheet.presenter.ts`
- `apps/api/src/modules/sheets/api/sheet.routes.ts`
- `apps/api/src/modules/sheets/api/sheet.schema.ts`
- `apps/api/src/modules/sheets/application/services/sheet.service.ts`
- `apps/api/src/modules/sheets/domain/repositories/sheet.repository.ts`
- `apps/api/src/modules/sheets/domain/state-machine.ts`
- `apps/api/src/modules/sheets/index.ts`
- `apps/api/src/modules/sourcing/api/sourcing.controller.ts`
- `apps/api/src/modules/sourcing/api/sourcing.presenter.ts`
- `apps/api/src/modules/sourcing/api/sourcing.routes.ts`
- `apps/api/src/modules/sourcing/api/sourcing.schema.ts`
- `apps/api/src/modules/sourcing/application/services/sourcing.service.ts`
- `apps/api/src/modules/sourcing/domain/repositories/sourcing.repository.ts`
- `apps/api/src/modules/sourcing/domain/state-machine.ts`
- `apps/api/src/modules/sourcing/index.ts`
- `apps/api/src/modules/spend-programs/api/spend-program.controller.ts`
- `apps/api/src/modules/spend-programs/api/spend-program.presenter.ts`
- `apps/api/src/modules/spend-programs/api/spend-program.routes.ts`
- `apps/api/src/modules/spend-programs/api/spend-program.schema.ts`
- `apps/api/src/modules/spend-programs/application/services/spend-program.service.ts`
- `apps/api/src/modules/spend-programs/domain/repositories/spend-program.repository.ts`
- `apps/api/src/modules/spend-programs/domain/state-machine.ts`
- `apps/api/src/modules/spend-programs/index.ts`
- `apps/api/src/modules/spend-requests/api/spend-request.controller.ts`
- `apps/api/src/modules/spend-requests/api/spend-request.presenter.ts`
- `apps/api/src/modules/spend-requests/api/spend-request.routes.ts`
- `apps/api/src/modules/spend-requests/api/spend-request.schema.ts`
- `apps/api/src/modules/spend-requests/application/services/spend-request.service.ts`
- `apps/api/src/modules/spend-requests/domain/repositories/spend-request.repository.ts`
- `apps/api/src/modules/spend-requests/domain/state-machine.ts`
- `apps/api/src/modules/spend-requests/index.ts`
- `apps/api/src/modules/tax-operations/api/tax-operation.controller.ts`
- `apps/api/src/modules/tax-operations/api/tax-operation.presenter.ts`
- `apps/api/src/modules/tax-operations/api/tax-operation.routes.ts`
- `apps/api/src/modules/tax-operations/api/tax-operation.schema.ts`
- `apps/api/src/modules/tax-operations/application/services/tax-operation.service.ts`
- `apps/api/src/modules/tax-operations/domain/repositories/tax-operation.repository.ts`
- `apps/api/src/modules/tax-operations/domain/state-machine.ts`
- `apps/api/src/modules/tax-operations/index.ts`
- `apps/api/src/modules/transactions/api/transaction.controller.ts`
- `apps/api/src/modules/transactions/api/transaction.presenter.ts`
- `apps/api/src/modules/transactions/api/transaction.routes.ts`
- `apps/api/src/modules/transactions/api/transaction.schema.ts`
- `apps/api/src/modules/transactions/application/services/transaction.service.ts`
- `apps/api/src/modules/transactions/domain/repositories/transaction.repository.ts`
- `apps/api/src/modules/transactions/domain/state-machine.ts`
- `apps/api/src/modules/transactions/index.ts`
- `apps/api/src/modules/travel/api/duffel-webhook.routes.ts`
- `apps/api/src/modules/travel/api/travel.controller.ts`
- `apps/api/src/modules/travel/api/travel.presenter.ts`
- `apps/api/src/modules/travel/api/travel.routes.ts`
- `apps/api/src/modules/travel/api/travel.schema.ts`
- `apps/api/src/modules/travel/application/duffel-webhook.ts`
- `apps/api/src/modules/travel/application/services/travel.service.ts`
- `apps/api/src/modules/travel/domain/repositories/travel.repository.ts`
- `apps/api/src/modules/travel/domain/state-machine.ts`
- `apps/api/src/modules/travel/index.ts`
- `apps/api/src/modules/treasury/api/treasury.controller.ts`
- `apps/api/src/modules/treasury/api/treasury.presenter.ts`
- `apps/api/src/modules/treasury/api/treasury.routes.ts`
- `apps/api/src/modules/treasury/api/treasury.schema.ts`
- `apps/api/src/modules/treasury/application/services/treasury.service.ts`
- `apps/api/src/modules/treasury/domain/repositories/treasury.repository.ts`
- `apps/api/src/modules/treasury/domain/state-machine.ts`
- `apps/api/src/modules/treasury/index.ts`
- `apps/api/src/modules/vendors/api/vendor.controller.ts`
- `apps/api/src/modules/vendors/api/vendor.presenter.ts`
- `apps/api/src/modules/vendors/api/vendor.routes.ts`
- `apps/api/src/modules/vendors/api/vendor.schema.ts`
- `apps/api/src/modules/vendors/application/services/vendor.service.ts`
- `apps/api/src/modules/vendors/domain/repositories/vendor.repository.ts`
- `apps/api/src/modules/vendors/domain/state-machine.ts`
- `apps/api/src/modules/vendors/index.ts`
- `apps/api/src/platform/auth/context.ts`
- `apps/api/src/platform/auth/index.ts`
- `apps/api/src/platform/cache/index.ts`
- `apps/api/src/platform/database/index.ts`
- `apps/api/src/platform/email/index.ts`
- `apps/api/src/platform/encryption/index.ts`
- `apps/api/src/platform/events/index.ts`
- `apps/api/src/platform/events/outbox.ts`
- `apps/api/src/platform/feature-flags/index.ts`
- `apps/api/src/platform/http.ts`
- `apps/api/src/platform/idempotency/index.ts`
- `apps/api/src/platform/index.ts`
- `apps/api/src/platform/observability/index.ts`
- `apps/api/src/platform/pagination/index.ts`
- `apps/api/src/platform/push/index.ts`
- `apps/api/src/platform/queue/index.ts`
- `apps/api/src/platform/rate-limit/index.ts`
- `apps/api/src/platform/rbac/index.ts`
- `apps/api/src/platform/resource-access.ts`
- `apps/api/src/platform/resource-router.ts`
- `apps/api/src/platform/secrets/index.ts`
- `apps/api/src/platform/storage/file-storage.ts`
- `apps/api/src/platform/storage/index.ts`
- `apps/api/src/platform/storage/local-storage.adapter.ts`
- `apps/api/src/platform/storage/malware-scanner.ts`
- `apps/api/src/shared/constants/index.ts`
- `apps/api/src/shared/country/index.ts`
- `apps/api/src/shared/date-time/index.ts`
- `apps/api/src/shared/errors/index.ts`
- `apps/api/src/shared/identifiers/index.ts`
- `apps/api/src/shared/index.ts`
- `apps/api/src/shared/money/index.ts`
- `apps/api/src/shared/result/index.ts`
- `apps/api/src/shared/types/index.ts`
- `apps/api/src/tests/accounting-queue.db.test.ts`
- `apps/api/src/tests/accounting-rules.test.ts`
- `apps/api/src/tests/ap-intake.test.ts`
- `apps/api/src/tests/approval-engine.db.test.ts`
- `apps/api/src/tests/auth-matrix.test.ts`
- `apps/api/src/tests/auth-matrix.ts`
- `apps/api/src/tests/budget-math.test.ts`
- `apps/api/src/tests/card-issuer-env.unit.test.ts`
- `apps/api/src/tests/card-issuer.unit.test.ts`
- `apps/api/src/tests/department-scope.test.ts`
- `apps/api/src/tests/documents.test.ts`
- `apps/api/src/tests/duffel-safety.test.ts`
- `apps/api/src/tests/duffel-webhook.unit.test.ts`
- `apps/api/src/tests/expense-requirements.test.ts`
- `apps/api/src/tests/idempotency.test.ts`
- `apps/api/src/tests/login-tenancy.test.ts`
- `apps/api/src/tests/money.test.ts`
- `apps/api/src/tests/outbox.test.ts`
- `apps/api/src/tests/policy.test.ts`
- `apps/api/src/tests/procurement-match.test.ts`
- `apps/api/src/tests/procurement-pos.db.test.ts`
- `apps/api/src/tests/quickbooks-core.test.ts`
- `apps/api/src/tests/quickbooks-tenancy.db.test.ts`
- `apps/api/src/tests/receipts-expenses.db.test.ts`
- `apps/api/src/tests/reimbursement-calc.test.ts`
- `apps/api/src/tests/reimbursements.db.test.ts`
- `apps/api/src/tests/reporting-hardening.db.test.ts`
- `apps/api/src/tests/resource-access.test.ts`
- `apps/api/src/tests/role-matrix.test.ts`
- `apps/api/src/tests/runtime-config.test.ts`
- `apps/api/src/tests/setup.ts`
- `apps/api/src/tests/spend-fulfillment.db.test.ts`
- `apps/api/src/tests/splits.test.ts`
- `apps/api/src/tests/stripe-payment-rail.test.ts`
- `apps/api/src/tests/stripe-webhook-regression.db.test.ts`
- `apps/api/src/tests/tenancy.db.test.ts`
- `apps/api/src/tests/transactions-scope.test.ts`
- `apps/api/src/tests/travel-core.db.test.ts`
- `apps/api/src/tests/travel-mock.test.ts`
- `apps/api/src/tests/vendor-ap-payments.db.test.ts`
- `apps/api/src/tests/workflow.test.ts`
- `apps/api/tsconfig.json`
- `apps/api/vitest.config.ts`
- `apps/mobile/app/(tabs)/approvals.tsx`
- `apps/mobile/app/(tabs)/cards.tsx`
- `apps/mobile/app/(tabs)/expenses.tsx`
- `apps/mobile/app/(tabs)/home.tsx`
- `apps/mobile/app/(tabs)/more.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/ai/ask.tsx`
- `apps/mobile/app/approvals/[id].tsx`
- `apps/mobile/app/cards/[id]/funds.tsx`
- `apps/mobile/app/cards/[id].tsx`
- `apps/mobile/app/expenses/scan.tsx`
- `apps/mobile/app/expenses/[id].tsx`
- `apps/mobile/app/reimbursements/new.tsx`
- `apps/mobile/app/reimbursements/[id].tsx`
- `apps/mobile/app/requests/new.tsx`
- `apps/mobile/app/requests/[id].tsx`
- `apps/mobile/app/settings/notifications.tsx`
- `apps/mobile/app/settings/profile.tsx`
- `apps/mobile/app/settings/security.tsx`
- `apps/mobile/app/transactions/[id].tsx`
- `apps/mobile/app/travel/search.tsx`
- `apps/mobile/app/travel/trips/[id].tsx`
- `apps/mobile/app/travel/trips.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app.json`
- `apps/mobile/features/ai/index.ts`
- `apps/mobile/features/approvals/index.ts`
- `apps/mobile/features/cards/index.ts`
- `apps/mobile/features/expenses/index.ts`
- `apps/mobile/features/home/index.ts`
- `apps/mobile/features/notifications/index.ts`
- `apps/mobile/features/reimbursements/index.ts`
- `apps/mobile/features/requests/index.ts`
- `apps/mobile/features/settings/index.ts`
- `apps/mobile/features/travel/index.ts`
- `apps/mobile/lib/offline.ts`
- `apps/mobile/lib/secure-storage.ts`
- `apps/mobile/package.json`
- `apps/mobile/tsconfig.json`
- `apps/stack/next.config.ts`
- `apps/stack/package.json`
- `apps/stack/src/app/close-projects/page.tsx`
- `apps/stack/src/app/layout.tsx`
- `apps/stack/src/app/page.tsx`
- `apps/stack/src/app/reconciliations/page.tsx`
- `apps/stack/src/app/reports/page.tsx`
- `apps/stack/src/app/skills/page.tsx`
- `apps/stack/src/app/tasks/page.tsx`
- `apps/stack/src/app/usage/page.tsx`
- `apps/stack/src/app/workspaces/page.tsx`
- `apps/stack/tsconfig.json`
- `apps/vendor-portal/next.config.ts`
- `apps/vendor-portal/package.json`
- `apps/vendor-portal/src/app/bills/page.tsx`
- `apps/vendor-portal/src/app/comments/page.tsx`
- `apps/vendor-portal/src/app/documents/page.tsx`
- `apps/vendor-portal/src/app/layout.tsx`
- `apps/vendor-portal/src/app/page.tsx`
- `apps/vendor-portal/src/app/payment-tax/page.tsx`
- `apps/vendor-portal/src/app/profile/page.tsx`
- `apps/vendor-portal/tsconfig.json`
- `apps/web/e2e/golden-flows.spec.ts`
- `apps/web/e2e/p0-5-ux.spec.ts`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/src/app/activate/page.tsx`
- `apps/web/src/app/app/accounting/banking/page.tsx`
- `apps/web/src/app/app/accounting/bill-pay/page.tsx`
- `apps/web/src/app/app/accounting/card/page.tsx`
- `apps/web/src/app/app/accounting/errors/page.tsx`
- `apps/web/src/app/app/accounting/integrations/page.tsx`
- `apps/web/src/app/app/accounting/layout.tsx`
- `apps/web/src/app/app/accounting/overview/page.tsx`
- `apps/web/src/app/app/accounting/ready-to-sync/page.tsx`
- `apps/web/src/app/app/accounting/reimbursements/page.tsx`
- `apps/web/src/app/app/accounting/review/page.tsx`
- `apps/web/src/app/app/accounting/rules/page.tsx`
- `apps/web/src/app/app/accounting/synced/page.tsx`
- `apps/web/src/app/app/ai/activity/page.tsx`
- `apps/web/src/app/app/ai/agents/page.tsx`
- `apps/web/src/app/app/ai/ask/page.tsx`
- `apps/web/src/app/app/ai/router/page.tsx`
- `apps/web/src/app/app/ai/sheets/page.tsx`
- `apps/web/src/app/app/ai/token-spend/page.tsx`
- `apps/web/src/app/app/banking/accounts/page.tsx`
- `apps/web/src/app/app/banking/automations/page.tsx`
- `apps/web/src/app/app/banking/forecast/page.tsx`
- `apps/web/src/app/app/banking/statements/page.tsx`
- `apps/web/src/app/app/banking/transactions/page.tsx`
- `apps/web/src/app/app/banking/transfers/page.tsx`
- `apps/web/src/app/app/bill-pay/bills/new/page.tsx`
- `apps/web/src/app/app/bill-pay/bills/page.tsx`
- `apps/web/src/app/app/bill-pay/bills/[id]/page.tsx`
- `apps/web/src/app/app/bill-pay/payment-runs/page.tsx`
- `apps/web/src/app/app/bill-pay/payment-runs/[id]/page.tsx`
- `apps/web/src/app/app/bill-pay/payments/page.tsx`
- `apps/web/src/app/app/bill-pay/payments/[id]/page.tsx`
- `apps/web/src/app/app/bill-pay/recurring/page.tsx`
- `apps/web/src/app/app/bill-pay/settings/page.tsx`
- `apps/web/src/app/app/cards/page.tsx`
- `apps/web/src/app/app/cards/[id]/page.tsx`
- `apps/web/src/app/app/company/accounting-dimensions/page.tsx`
- `apps/web/src/app/app/company/approvals/page.tsx`
- `apps/web/src/app/app/company/audit/page.tsx`
- `apps/web/src/app/app/company/billing/page.tsx`
- `apps/web/src/app/app/company/departments/page.tsx`
- `apps/web/src/app/app/company/entities/page.tsx`
- `apps/web/src/app/app/company/integrations/page.tsx`
- `apps/web/src/app/app/company/layout.tsx`
- `apps/web/src/app/app/company/locations/page.tsx`
- `apps/web/src/app/app/company/people/page.tsx`
- `apps/web/src/app/app/company/people/[id]/page.tsx`
- `apps/web/src/app/app/company/policy/page.tsx`
- `apps/web/src/app/app/company/rewards/page.tsx`
- `apps/web/src/app/app/company/roles/new/page.tsx`
- `apps/web/src/app/app/company/roles/page.tsx`
- `apps/web/src/app/app/company/roles/[id]/page.tsx`
- `apps/web/src/app/app/company/security/page.tsx`
- `apps/web/src/app/app/company/settings/page.tsx`
- `apps/web/src/app/app/developer/page.tsx`
- `apps/web/src/app/app/disputes/page.tsx`
- `apps/web/src/app/app/expenses/receipts/page.tsx`
- `apps/web/src/app/app/expenses/receipts/[id]/page.tsx`
- `apps/web/src/app/app/expenses/reimbursements/page.tsx`
- `apps/web/src/app/app/expenses/reimbursements/[id]/page.tsx`
- `apps/web/src/app/app/expenses/transactions/page.tsx`
- `apps/web/src/app/app/expenses/transactions/[id]/page.tsx`
- `apps/web/src/app/app/expenses/travel/page.tsx`
- `apps/web/src/app/app/expenses/[id]/page.tsx`
- `apps/web/src/app/app/home/page.tsx`
- `apps/web/src/app/app/inbox/page.tsx`
- `apps/web/src/app/app/insights/budgets/page.tsx`
- `apps/web/src/app/app/insights/budgets/[id]/page.tsx`
- `apps/web/src/app/app/insights/dashboard/page.tsx`
- `apps/web/src/app/app/insights/license-intelligence/page.tsx`
- `apps/web/src/app/app/insights/price-intelligence/page.tsx`
- `apps/web/src/app/app/insights/reports/page.tsx`
- `apps/web/src/app/app/insights/savings/page.tsx`
- `apps/web/src/app/app/layout.tsx`
- `apps/web/src/app/app/me/cards/page.tsx`
- `apps/web/src/app/app/me/cards/[id]/page.tsx`
- `apps/web/src/app/app/me/expenses/page.tsx`
- `apps/web/src/app/app/me/reimbursements/page.tsx`
- `apps/web/src/app/app/me/requests/page.tsx`
- `apps/web/src/app/app/me/travel/page.tsx`
- `apps/web/src/app/app/notifications/page.tsx`
- `apps/web/src/app/app/page.tsx`
- `apps/web/src/app/app/procurement/contracts/page.tsx`
- `apps/web/src/app/app/procurement/match-exceptions/page.tsx`
- `apps/web/src/app/app/procurement/programs/page.tsx`
- `apps/web/src/app/app/procurement/purchase-orders/page.tsx`
- `apps/web/src/app/app/procurement/purchase-orders/[id]/page.tsx`
- `apps/web/src/app/app/procurement/receiving/page.tsx`
- `apps/web/src/app/app/procurement/renewals/page.tsx`
- `apps/web/src/app/app/procurement/requests/page.tsx`
- `apps/web/src/app/app/procurement/requests/[id]/page.tsx`
- `apps/web/src/app/app/procurement/sourcing/page.tsx`
- `apps/web/src/app/app/receivables/cash-application/page.tsx`
- `apps/web/src/app/app/receivables/collections/page.tsx`
- `apps/web/src/app/app/receivables/customers/page.tsx`
- `apps/web/src/app/app/receivables/invoices/page.tsx`
- `apps/web/src/app/app/receivables/payments/page.tsx`
- `apps/web/src/app/app/search/page.tsx`
- `apps/web/src/app/app/spend/cards/page.tsx`
- `apps/web/src/app/app/spend/cards/[id]/page.tsx`
- `apps/web/src/app/app/spend/funds/page.tsx`
- `apps/web/src/app/app/spend/funds/[id]/page.tsx`
- `apps/web/src/app/app/spend/programs/page.tsx`
- `apps/web/src/app/app/spend/programs/[id]/page.tsx`
- `apps/web/src/app/app/spend/requests/page.tsx`
- `apps/web/src/app/app/spend/requests/[id]/page.tsx`
- `apps/web/src/app/app/spend/transactions/page.tsx`
- `apps/web/src/app/app/spend/transactions/[id]/page.tsx`
- `apps/web/src/app/app/tax/page.tsx`
- `apps/web/src/app/app/travel/policy/page.tsx`
- `apps/web/src/app/app/travel/reports/page.tsx`
- `apps/web/src/app/app/travel/requests/page.tsx`
- `apps/web/src/app/app/travel/search/page.tsx`
- `apps/web/src/app/app/travel/travelers/page.tsx`
- `apps/web/src/app/app/travel/trips/page.tsx`
- `apps/web/src/app/app/travel/trips/[id]/page.tsx`
- `apps/web/src/app/app/vendors/page.tsx`
- `apps/web/src/app/app/vendors/[id]/page.tsx`
- `apps/web/src/app/forgot-password/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/reset-password/page.tsx`
- `apps/web/src/components/AccountingPresentation.tsx`
- `apps/web/src/components/AppHeader.tsx`
- `apps/web/src/components/AuthGate.tsx`
- `apps/web/src/components/BillPayPresentation.tsx`
- `apps/web/src/components/Can.tsx`
- `apps/web/src/components/CompanyPresentation.tsx`
- `apps/web/src/components/ExpensePresentation.tsx`
- `apps/web/src/components/InsightsPresentation.tsx`
- `apps/web/src/components/NavigationIcon.tsx`
- `apps/web/src/components/OverviewDashboard.tsx`
- `apps/web/src/components/PersonalWorkPresentation.tsx`
- `apps/web/src/components/ProcurementPresentation.tsx`
- `apps/web/src/components/ResourcePage.tsx`
- `apps/web/src/components/SpendPresentation.tsx`
- `apps/web/src/components/TravelPresentation.tsx`
- `apps/web/src/components/VirtualCardFace.tsx`
- `apps/web/src/config/navigation.ts`
- `apps/web/src/config/resource-config.ts`
- `apps/web/src/design-system/index.ts`
- `apps/web/src/features/accounting/index.ts`
- `apps/web/src/features/agent-finance/index.ts`
- `apps/web/src/features/approvals/index.ts`
- `apps/web/src/features/ask-ai/index.ts`
- `apps/web/src/features/audit/index.ts`
- `apps/web/src/features/banking/index.ts`
- `apps/web/src/features/bill-pay/index.ts`
- `apps/web/src/features/budgets/index.ts`
- `apps/web/src/features/cards/index.ts`
- `apps/web/src/features/contracts/index.ts`
- `apps/web/src/features/developer/index.ts`
- `apps/web/src/features/disputes/index.ts`
- `apps/web/src/features/expenses/index.ts`
- `apps/web/src/features/funds/index.ts`
- `apps/web/src/features/home/index.ts`
- `apps/web/src/features/inbox/index.ts`
- `apps/web/src/features/insights/index.ts`
- `apps/web/src/features/integrations/index.ts`
- `apps/web/src/features/license-intelligence/index.ts`
- `apps/web/src/features/payment-runs/index.ts`
- `apps/web/src/features/payments/index.ts`
- `apps/web/src/features/people/index.ts`
- `apps/web/src/features/policies/index.ts`
- `apps/web/src/features/price-intelligence/index.ts`
- `apps/web/src/features/procurement/index.ts`
- `apps/web/src/features/purchase-orders/index.ts`
- `apps/web/src/features/receivables/index.ts`
- `apps/web/src/features/receiving/index.ts`
- `apps/web/src/features/reimbursements/index.ts`
- `apps/web/src/features/reports/index.ts`
- `apps/web/src/features/rewards/index.ts`
- `apps/web/src/features/roles/index.ts`
- `apps/web/src/features/roles/RoleBuilderForm.tsx`
- `apps/web/src/features/roles/RolePermissionMatrix.tsx`
- `apps/web/src/features/router/index.ts`
- `apps/web/src/features/savings/index.ts`
- `apps/web/src/features/search/index.ts`
- `apps/web/src/features/security/index.ts`
- `apps/web/src/features/settings/index.ts`
- `apps/web/src/features/sheets/index.ts`
- `apps/web/src/features/sourcing/index.ts`
- `apps/web/src/features/spend-programs/index.ts`
- `apps/web/src/features/spend-requests/index.ts`
- `apps/web/src/features/tax/index.ts`
- `apps/web/src/features/token-spend/index.ts`
- `apps/web/src/features/transactions/index.ts`
- `apps/web/src/features/travel/index.ts`
- `apps/web/src/features/vendors/index.ts`
- `apps/web/src/lib/accounting-list.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/card-primary.ts`
- `apps/web/src/lib/my-work-filters.ts`
- `apps/web/src/providers/query-provider.tsx`
- `apps/web/src/providers/session-provider.tsx`
- `apps/web/src/stores/ui-store.ts`
- `apps/web/test-results/.last-run.json`
- `apps/web/tsconfig.json`
- `apps/worker/package.json`
- `apps/worker/src/dispatch.ts`
- `apps/worker/src/drain.ts`
- `apps/worker/src/event-catalog.test.ts`
- `apps/worker/src/event-catalog.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/integrations/quickbooks.ts`
- `apps/worker/src/outbox.ts`
- `apps/worker/src/processors/accounting-sync.processor.ts`
- `apps/worker/src/processors/ai.processor.ts`
- `apps/worker/src/processors/disputes.processor.ts`
- `apps/worker/src/processors/documents.processor.ts`
- `apps/worker/src/processors/integrations.processor.ts`
- `apps/worker/src/processors/notifications.processor.ts`
- `apps/worker/src/processors/ocr.processor.ts`
- `apps/worker/src/processors/payments.processor.ts`
- `apps/worker/src/processors/reporting.processor.ts`
- `apps/worker/src/processors/search-index.processor.ts`
- `apps/worker/src/processors/sheets.processor.ts`
- `apps/worker/src/processors/tax.processor.ts`
- `apps/worker/src/processors/travel.processor.ts`
- `apps/worker/src/processors/webhooks.processor.ts`
- `apps/worker/src/queues/accounting-sync.queue.ts`
- `apps/worker/src/queues/ai.queue.ts`
- `apps/worker/src/queues/disputes.queue.ts`
- `apps/worker/src/queues/documents.queue.ts`
- `apps/worker/src/queues/integrations.queue.ts`
- `apps/worker/src/queues/notifications.queue.ts`
- `apps/worker/src/queues/ocr.queue.ts`
- `apps/worker/src/queues/payments.queue.ts`
- `apps/worker/src/queues/reporting.queue.ts`
- `apps/worker/src/queues/search-index.queue.ts`
- `apps/worker/src/queues/sheets.queue.ts`
- `apps/worker/src/queues/tax.queue.ts`
- `apps/worker/src/queues/travel.queue.ts`
- `apps/worker/src/queues/webhooks.queue.ts`
- `apps/worker/tsconfig.json`
- `packages/api-client/package.json`
- `packages/api-client/src/index.ts`
- `packages/api-client/tsconfig.json`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/config/tsconfig.json`
- `packages/contracts/package.json`
- `packages/contracts/src/auth.ts`
- `packages/contracts/src/common.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/money.ts`
- `packages/contracts/tsconfig.json`
- `packages/design-system/package.json`
- `packages/design-system/src/fields/AccountingDimensionSelect.tsx`
- `packages/design-system/src/fields/DateField.tsx`
- `packages/design-system/src/fields/EntitySelect.tsx`
- `packages/design-system/src/fields/MoneyField.tsx`
- `packages/design-system/src/fields/UserSelect.tsx`
- `packages/design-system/src/fields/VendorSelect.tsx`
- `packages/design-system/src/index.ts`
- `packages/design-system/src/patterns/ApprovalTimeline.tsx`
- `packages/design-system/src/patterns/AuditTimeline.tsx`
- `packages/design-system/src/patterns/DataTable.tsx`
- `packages/design-system/src/patterns/DateRangePicker.tsx`
- `packages/design-system/src/patterns/DocumentViewer.tsx`
- `packages/design-system/src/patterns/DrawerReview.tsx`
- `packages/design-system/src/patterns/EmptyState.tsx`
- `packages/design-system/src/patterns/FilterBar.tsx`
- `packages/design-system/src/patterns/MoneyInput.tsx`
- `packages/design-system/src/patterns/PageHeader.tsx`
- `packages/design-system/src/patterns/StatusBadge.tsx`
- `packages/design-system/src/primitives/Button.tsx`
- `packages/design-system/src/primitives/Dialog.tsx`
- `packages/design-system/src/primitives/Input.tsx`
- `packages/design-system/src/primitives/Select.tsx`
- `packages/design-system/src/primitives/Tooltip.tsx`
- `packages/design-system/tsconfig.json`
- `packages/feature-flags/package.json`
- `packages/feature-flags/src/index.ts`
- `packages/feature-flags/tsconfig.json`
- `packages/logger/package.json`
- `packages/logger/src/index.ts`
- `packages/logger/tsconfig.json`
- `packages/money/package.json`
- `packages/money/src/index.ts`
- `packages/money/tsconfig.json`
- `packages/permissions/package.json`
- `packages/permissions/src/index.ts`
- `packages/permissions/src/role-matrix.ts`
- `packages/permissions/tsconfig.json`
- `packages/quickbooks/package.json`
- `packages/quickbooks/src/index.ts`
- `packages/quickbooks/tsconfig.json`
