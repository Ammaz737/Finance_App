# Outbox Event Catalog

Verified 2026-09-20 against all `outboxEvent.create` emitters, seed data, and the worker catalog.

## Actionable events

| Event | Queue | Consumer |
|---|---|---|
| `payment.released` | `payments` | Mock/provider payment submission, idempotent by outbox ID |
| `accounting.sync_requested` | `accounting-sync` | ERP sync execution and result persistence |
| `document.quarantined` | `documents` | Malware scan state transition |
| `receipt.ocr_requested` | `ocr` | Receipt OCR result persistence |
| `invoice.ocr_requested` | `ocr` | Invoice OCR (sandbox mock) |

## Informational and audit events

These are consumed by the `events` queue and acknowledged after durable outbox to queue delivery. They require no downstream state transition:

`accounting.coded`, `accounting.ready`, `accounting.synced`, `bill.approved`, `bill.created`, `bill.submitted`, `card.frozen`, `department.created`, `entity.created`, `expense.approved`, `expense.split`, `expense.submitted`, `invoice.ocr_completed`, `location.created`, `organization.updated`, `payment.completed`, `payment.settled`, `payment.scheduled`, `payment_run.created`, `payment_run.released`, `procurement.created`, `procurement.matched`, `procurement.submitted`, `receipt.created`, `receiving.recorded`, `reimbursement.approved`, `reimbursement.paid`, `reimbursement.scheduled`, `reimbursement.submitted`, `request.approved`, `request.submitted`, `transaction.authorized`, `transaction.cleared`, `transaction.reversed`, `transaction.voided`, `transfer.created`, `transfer.sent`, `transfer.settled`, `transfer.approved`, `travel.approved`, `travel.booked_mock`, `travel.confirmed`, `travel.submitted`, `travel.trip_created`, `user.activated`, `user.created`, `user.published`, `user.terminated`, `vendor.bank_changed`, `vendor.bank_verified`, `vendor.created`.

## Deprecated events

None. Unknown event names fail closed and remain retryable/dead-letter visible instead of being silently published.

