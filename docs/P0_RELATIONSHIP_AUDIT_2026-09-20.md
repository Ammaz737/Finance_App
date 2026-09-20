# PostgreSQL Relationship Audit — P0

## Scope and result

All relationship-shaped columns in `schema.prisma` were inventoried. Before this sprint PostgreSQL had zero foreign keys. The staged migrations now install and validate 36 P0 foreign keys, including tenant-composite links for identity, spend, card, expense, accounting, vendor, bill and payment records. Existing seeded data passed all enabled validations.

## Enforcement decisions

| Area | Relationship groups | Result |
|---|---|---|
| Tenant roots | organization IDs on legal entities and users | Enforced |
| Identity | user manager, department, location, session, user role and role | Enforced; tenant composite where applicable |
| Spend | program to entity/budget; request to entity/program/requester; fund to entity/owner/request; card to fund/holder | Enforced with tenant composites |
| Card lifecycle | transaction to card/fund/authorization | Enforced with tenant composites |
| Expenses | expense to transaction/user; split to expense | Enforced with tenant composites |
| Accounting | entry to entity; sync attempt to job/entry | Enforced with tenant composites |
| Bill Pay | vendor to entity; bank account to vendor; bill to vendor/entity; line to bill; payment to bill/run | Enforced with tenant composites |
| Ledger | ledger entry to ledger transaction | Enforced with tenant composite |
| Polymorphic links | audit/outbox/inbox object IDs, accounting source IDs, notifications | Logical by design; one column can target several tables |
| Processor decline IDs | declined card authorization card/fund IDs | Logical by design; unknown external identifiers are retained for audit |
| P1/P2 models | contracts, banking, receivables, AI, tax, disputes, rewards, developer and sheets relations | Audited and deferred because this sprint explicitly excludes P1/P2 implementation; their routes are hidden by phase flags |

## Migration stages

1. `20260920210000_p0_parent_keys`: adds composite parent uniqueness needed for tenant-safe references.
2. `20260920211000_p0_foreign_keys_not_valid`: runs blocking orphan/cross-tenant prechecks, then installs constraints as `NOT VALID`.
3. `20260920212000_p0_foreign_keys_validate`: excludes documented logical processor IDs and validates every installed foreign key.

No automatic deletion or silent cross-tenant backfill is performed. A failing precheck aborts the migration with the relationship name.
