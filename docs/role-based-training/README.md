# Complete role-based training guide

**Start here — single consolidated document:** [Task-wise Employee → Manager → Finance training (Roman Urdu)](COMPLETE-TASK-WISE-TRAINING.md). Is ek document mein policies, exact pages/forms, role handoffs, completion checks aur application gaps task ke order mein diye gaye hain.

Reviewed against the current working repository on **13 October 2026**. The four implemented seeded roles are **Owner**, **Finance Admin**, **Manager**, and **Employee**. This pack contains a self-contained manual for each. Super Admin, Organization Admin, Vendor, and Advisor are not separate seeded roles and are not invented here. AP and Treasury demo users both hold Finance Admin. Custom roles are supported; their deployment-specific records were not inspected.

## Recommended training sequence

| Order | Audience | Manual | Completion goal |
|---|---|---|---|
| 1 | Owner / lead administrator | [Owner](owner.md) | Establish people, entities, scopes, policies, programs, and independent reviewers. |
| 2 | Finance operators, AP duties, treasury duties | [Finance Admin](finance-admin.md) | Operate spend/procurement, bills, payment controls, reimbursements, accounting, and authorized administration. |
| 3 | Assigned reviewers | [Manager](manager.md) | Review direct reports and hand multi-step work to finance. |
| 4 | Cardholders / requesters / travelers | [Employee](employee.md) | Create requests, complete expenses/claims, submit procurement, and use sandbox travel. |
| 5 | All four roles together | Practical scenarios and diagrams in each manual | Finish one request-to-approval-to-settlement/sync exercise with separate actors. |
| 6 | Organization-defined roles | [Custom-role worksheet](custom-role-training.md) | Verify actual permissions and create a deployment-specific training record. |

Every role manual includes its role/scope restrictions, sign-in/activation, page navigation, exact configured create fields, operating steps, daily routine, workflow handoffs, sample scenarios, troubleshooting, screenshots, Mermaid diagrams, and a practice checklist. Finance Admin and Owner manuals also cover configuration and finance operations. Manager alone is an approval role; it does not inherit Employee creation permissions in the current seed.

## Training workspace and example accounts

Use accounts only if your training environment was seeded and its administrator confirms the credentials. Do not reset or reseed a database just to run training.

| Seed account | Actual role | Duties in the examples |
|---|---|---|
| admin@acme.test | Owner | Company setup and independent finance participation. |
| manager@acme.test | Manager | Miles reviews Elena's work. |
| employee@acme.test | Employee | Elena creates requests and claims. |
| ap@acme.test | Finance Admin | Aiden performs an AP step or independent release. |
| treasury@acme.test | Finance Admin | Tessa performs a finance step or payout duty. |

Seed workspace: **acme**. Seed password is configured by SEED_PASSWORD, with a development fallback in seed code; obtain the password from your administrator. Seed entities are Acme US LLC (US/USD) and Acme UK Ltd (GB/GBP). The Finance Admin seed assignments are attached to the US entity, so authentication narrows their organization grants to entity access for relevant resources. Owner remains organization-wide within the current tenant.

## Verification and scope

**Code verified** means implementation was inspected, not executed. No live app login, database write, provider transaction, or new screenshot capture was performed. Included screenshots already existed in reports and were visually inspected; they are Owner examples, not proof of role-specific access in today's deployment. Field labels and steps reflect the current working tree, including existing user changes.

[Coverage and verification](coverage-and-verification.md) inventories every discovered app page/mobile route, mounted API resource, database model, module directory, worker processor, and application/shared source file. [Source manifest](source-manifest.json) records hashes of those files. It also explains known gaps: request-information recovery, split entry, non-PO procurement fulfillment, supporting-document forms, policy enable permission mismatch, phase-gated modules, and mock/live provider boundaries.

Existing endpoint/test fixtures are not all aligned with seed; the actual seed, authenticated scope conversion, mounted registry, and domain enforcement take precedence in these manuals. Current database roles, entitlements, deployment flags, active workflow versions, and external provider behavior remain unverified. This pack covers every role defined by the repository; unknown custom roles in a deployed database need the included worksheet.

## Trainer completion record

Run the role's checklist with sample records. Record trainee/date, actor accounts, entity, request/claim/bill/payment IDs, observed final statuses/references, and unresolved issues. A completed exercise must demonstrate the handoff and final outcome, not merely that a page opened. Do not treat a mock payment, sandbox booking, or mock accounting ID as a real external transaction.

[Documentation validation results](validation.md).
