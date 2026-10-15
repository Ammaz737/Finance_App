# Reimbursement cash settlement fix

## Stripe test deployment correction

Stripe test mode uses the provider cash balance as the reporting baseline rather than requiring a local BankAccount. Successful mock reimbursement settlement records an explicit sandbox ledger deduction, serialized per organization; reporting subtracts these adjustments by currency and labels the result as Stripe TEST balance minus simulated reimbursement payouts. The external Stripe balance is unchanged. Missing provider balance or insufficient adjusted cash blocks settlement. Production/non-test keys cannot use this simulated branch. Mock-issuer deployments retain the local-bank debit below.

Latest verification: 5 cash unit cases plus 4 reimbursement database cases passed (9 tests); API TypeScript passed. An initial database run timed out because local Stripe configuration leaked into the fixture; the fixture now explicitly mocks issuer selection and the rerun passed. This correction does not confirm the user's pending payout or backfill historical PAID records.

Successful reimbursement settlement now debits a company bank account in the same tenant, legal entity and currency, preferring Operating. The debit and a balanced ledger posting commit in the same database transaction as PAID, accounting, audit and outbox. Missing account or insufficient cash rejects and rolls back settlement. Failed provider results do not debit cash.

The existing conditional settlement claim ensures only one caller performs settlement. Repeated confirmation of PAID records returns the previous result without another debit. Card issuer configuration does not bypass reimbursement cash settlement; reimbursements currently use the mock payout adapter separately.

Verification: reimbursement database suite 4 tests and cash unit suite 3 tests passed. The database test verifies exactly one deduction and one cash ledger transaction after confirming twice. Cash unit cases cover 85.50 deduction, tenant/entity/currency filtering, Operating preference, missing account and insufficient cash. API TypeScript passed. No schema migration.

Operator flow: approved reimbursement → authorized Finance Schedule payout → Confirm payout in sandbox → PAID and company cash decreases. Refresh the company cash display after settlement. Approval alone does not debit cash.

Previously PAID records are not automatically backfilled or charged on retry. Their provider/history evidence must be reconciled before a deliberate corrective entry. This fix does not implement a live payout provider or reverse cash for a returned payout.
