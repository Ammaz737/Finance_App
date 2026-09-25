# P0.5 Test Report

**Date:** 2026-09-22  
**Environment:** Windows local workspace, PostgreSQL `finance`, sandbox/mock providers, Playwright Chrome channel.

## Final results

| Gate | Command / scope | Result |
|---|---|---|
| API TypeScript | `tsc -p apps/api/tsconfig.json --noEmit` | PASS |
| Web TypeScript | `tsc -p apps/web/tsconfig.json --noEmit` | PASS |
| Worker TypeScript | `tsc -p apps/worker/tsconfig.json --noEmit` | PASS |
| API Vitest | API workspace, single worker | PASS — 29 files, 104 tests |
| Worker catalog | compiled Node test | PASS — 2 tests |
| P0.5 Playwright | `p0-5-ux.spec.ts` | PASS — G1–G6, 6/6 |
| Existing golden Playwright | `golden-flows.spec.ts` | PASS — A–F, 18/18 |
| Prisma migrations | `prisma migrate deploy` | PASS — 25 migrations applied |

Database suites use shared organization fixtures and must run with one Vitest worker. An exploratory all-repository parallel invocation produced expected PostgreSQL serialization conflicts and also incorrectly collected Playwright/Node tests; the authoritative API run used the package scope with `--maxWorkers=1` and passed 104/104.

## Focused coverage

- Authentication: invite/activation one-time token, forgot/reset, password change, old-password rejection, session revocation, and G1/G2 browser journeys.
- Payment run: eligible assignment, remove/re-add, duplicate prevention, creator/releaser SoD, release to PROCESSING, settlement, and G3.
- Vendor payment details: masked current account, retained change history, verification controls, and G4.
- Match exceptions: tolerance/state helpers, API resolution commands, and G5 UI resolution.
- Cards/spend: freeze/unfreeze/control enforcement and guarded program edit/deactivation paths.
- Bill UX: duplicate protection, line values/totals, DRAFT edit/cancel state boundaries, upload route, approvals, payments, and settlement regression.
- Receipts/reimbursements/travel: deterministic receipt linking, server-authoritative mileage/per-diem, submit/payout, cancel/refund, and preserved golden flows.
- Admin: role assignment surfaces, policy create/version/disable/simulate, workflow create/version/enable/disable/preview, accounting dimensions, and G6.
- Navigation: exact request, inbox, match/accounting, and notification targets.

## Playwright journeys

| Journey | Result |
|---|---|
| G1 — Invite → Activate → Login | PASS |
| G2 — Forgot Password → Reset → Login | PASS |
| G3 — Approved Bill → Payment → Add to Run → Release → Settlement | PASS |
| G4 — Vendor payment details → Bill → Payment permission path | PASS |
| G5 — Procurement match exception → Resolve | PASS |
| G6 — Policy + approval workflow configuration | PASS |

The preserved 18-test A–F suite was rerun after P0.5. It found and drove two closure fixes: existing workflows needed an activation-preservation migration after adding lifecycle fields, and transaction action buttons needed to stop row-click propagation. Both were corrected before the final green run.

## Notes

- Prisma Client generation initially encountered a transient Windows DLL lock; regeneration immediately succeeded without changing the generated contract.
- No test required a live external provider. Email, issuer, rail, payout, ERP, OCR/scanner, and travel integrations remain explicit sandbox/mock boundaries.
- Test-created activation users, financial records, and disabled G6 configuration drafts remain isolated to the local verification tenant and do not weaken tenant/RBAC checks.

