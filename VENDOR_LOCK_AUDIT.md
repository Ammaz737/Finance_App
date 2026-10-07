# Vendor / Merchant Lock Audit

Date: 2026-10-07

## Enforcement matrix

| Path | Enforcement |
| --- | --- |
| Spend request form | Vendor options are restricted to active, entity-compatible vendors matching the selected program lock. |
| Spend request API | Revalidates vendor tenant, active status, legal entity, and current program merchant lock. |
| Final approval | Rechecks the vendor against the current program lock before funds or a card are issued. |
| Card provisioning | A selected vendor becomes the card merchant lock; otherwise the program default is used. |
| Reused holder card | Different approved locks are merged and deduplicated instead of clearing the lock. |
| Local/mock authorization | Declines a nonmatching merchant with `MERCHANT_LOCK`. |
| Stripe force-capture path | Runs the same authorization rules before the provider operation. |
| Stripe real-time authorization webhook | Runs the same authorization rules using Stripe merchant data. |
| Manual card controls | Authorized finance users can update or clear a card lock; the change is audited. |
| Travel card | Intentionally has no vendor lock and is controlled through travel MCCs, amount, and validity dates. |
| Bill pay / procurement / QuickBooks | These use vendor identity and tenant foreign keys; card merchant locking does not apply to these non-card flows. |

## Corrections made

- Block inactive and wrong-entity vendors at the API boundary.
- Revalidate the lock at final approval to prevent program-change bypasses.
- Preserve all approved locks when a single holder card is reused.
- Remove unsafe reverse substring matching that could allow a short merchant name such as `AI` through an `OpenAI` lock.
- Keep browser vendor filtering consistent with backend matching.

## Evidence

- API TypeScript check: passed.
- Web TypeScript check: passed.
- Vendor/card/Stripe targeted regression: 3 files, 23 tests passed.
- Database coverage includes request-time vendor validation, approval-time lock drift, card reuse, authorization decline, capture, void, reversal, MCC, amount, and velocity controls.

The broader API run reached 151 passing tests before two existing Duffel safety assertions failed because the current Duffel adapter returns sandbox fallbacks for unsupported operations. Those failures are outside vendor-lock behavior.
