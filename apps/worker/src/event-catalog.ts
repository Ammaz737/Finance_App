export type EventClassification = "actionable" | "informational" | "deprecated";

export type EventDefinition = {
  classification: EventClassification;
  queue: "payments" | "accounting-sync" | "documents" | "ocr" | "events";
  purpose: string;
};

/** Every literal event emitted by the company-web API or a worker processor. */
export const eventCatalog = {
  "payment.released": { classification: "actionable", queue: "payments", purpose: "Settle a released payment through the configured rail" },
  "accounting.sync_requested": { classification: "actionable", queue: "accounting-sync", purpose: "Post ready accounting entries through the ERP adapter" },
  "document.quarantined": { classification: "actionable", queue: "documents", purpose: "Scan a quarantined attachment" },
  "receipt.ocr_requested": { classification: "actionable", queue: "ocr", purpose: "Extract receipt fields after a clean scan" },
  "invoice.ocr_requested": { classification: "actionable", queue: "ocr", purpose: "Extract invoice fields after a clean scan (sandbox mock)" },
  "invoice.ocr_completed": { classification: "informational", queue: "events", purpose: "Invoice OCR completed (sandbox)" },
  "vendor.bank_verified": { classification: "informational", queue: "events", purpose: "Vendor bank verification lifecycle" },

  "accounting.coded": { classification: "informational", queue: "events", purpose: "Accounting lifecycle/audit projection" },
  "accounting.ready": { classification: "informational", queue: "events", purpose: "Accounting lifecycle/audit projection" },
  "accounting.synced": { classification: "informational", queue: "events", purpose: "ERP acknowledgement lifecycle event" },
  "bill.approved": { classification: "informational", queue: "events", purpose: "Bill lifecycle/audit projection" },
  "bill.created": { classification: "informational", queue: "events", purpose: "Bill lifecycle/audit projection" },
  "bill.submitted": { classification: "informational", queue: "events", purpose: "Bill lifecycle/audit projection" },
  "department.created": { classification: "informational", queue: "events", purpose: "Organization lifecycle/audit projection" },
  "entity.created": { classification: "informational", queue: "events", purpose: "Organization lifecycle/audit projection" },
  "expense.approved": { classification: "informational", queue: "events", purpose: "Expense lifecycle/audit projection" },
  "expense.split": { classification: "informational", queue: "events", purpose: "Expense lifecycle/audit projection" },
  "expense.submitted": { classification: "informational", queue: "events", purpose: "Expense lifecycle/audit projection" },
  "location.created": { classification: "informational", queue: "events", purpose: "Organization lifecycle/audit projection" },
  "organization.updated": { classification: "informational", queue: "events", purpose: "Organization lifecycle/audit projection" },
  "payment.completed": { classification: "informational", queue: "events", purpose: "Settlement lifecycle/audit projection (legacy alias)" },
  "payment.settled": { classification: "informational", queue: "events", purpose: "Settlement lifecycle/audit projection" },
  "payment.scheduled": { classification: "informational", queue: "events", purpose: "Payment lifecycle/audit projection" },
  "payment_run.created": { classification: "informational", queue: "events", purpose: "Payment-run lifecycle/audit projection" },
  "payment_run.released": { classification: "informational", queue: "events", purpose: "Payment-run lifecycle/audit projection" },
  "purchase_order.issued": { classification: "informational", queue: "events", purpose: "PO issuance lifecycle" },
  "procurement.created": { classification: "informational", queue: "events", purpose: "Procurement lifecycle/audit projection" },
  "procurement.submitted": { classification: "informational", queue: "events", purpose: "Procurement lifecycle/audit projection" },
  "procurement.approved": { classification: "informational", queue: "events", purpose: "Procurement lifecycle/audit projection" },
  "procurement.step_approved": { classification: "informational", queue: "events", purpose: "Procurement step lifecycle" },
  "procurement.matched": { classification: "informational", queue: "events", purpose: "Procurement match lifecycle/audit projection" },
  "receipt.created": { classification: "informational", queue: "events", purpose: "Receipt lifecycle/audit projection" },
  "receiving.recorded": { classification: "informational", queue: "events", purpose: "Receiving lifecycle/audit projection" },
  "reimbursement.scheduled": { classification: "actionable", queue: "payments", purpose: "Settle a scheduled reimbursement payout through the mock rail" },
  "reimbursement.payout_failed": { classification: "informational", queue: "events", purpose: "Reimbursement payout failure projection" },
  "reimbursement.approved": { classification: "informational", queue: "events", purpose: "Reimbursement lifecycle/audit projection" },
  "reimbursement.paid": { classification: "informational", queue: "events", purpose: "Payout lifecycle/audit projection" },
  "reimbursement.submitted": { classification: "informational", queue: "events", purpose: "Reimbursement lifecycle/audit projection" },
  "request.approved": { classification: "informational", queue: "events", purpose: "Spend-request lifecycle/audit projection" },
  "request.submitted": { classification: "informational", queue: "events", purpose: "Spend-request lifecycle/audit projection" },
  "request.policy_blocked": { classification: "informational", queue: "events", purpose: "Spend-request policy block projection" },
  "spend_program.deactivated": { classification: "informational", queue: "events", purpose: "Spend program lifecycle/audit projection" },
  "card.unfrozen": { classification: "informational", queue: "events", purpose: "Card control/audit projection" },
  "card.terminated": { classification: "informational", queue: "events", purpose: "Card control/audit projection" },
  "transaction.authorized": { classification: "informational", queue: "events", purpose: "Card transaction lifecycle/audit projection" },
  "transaction.cleared": { classification: "informational", queue: "events", purpose: "Card transaction lifecycle/audit projection" },
  "transaction.reversed": { classification: "informational", queue: "events", purpose: "Card transaction lifecycle/audit projection" },
  "transaction.voided": { classification: "informational", queue: "events", purpose: "Card transaction lifecycle/audit projection" },
  "transfer.created": { classification: "informational", queue: "events", purpose: "Treasury lifecycle/audit projection" },
  "transfer.approved": { classification: "informational", queue: "events", purpose: "Treasury lifecycle/audit projection" },
  "transfer.sent": { classification: "informational", queue: "events", purpose: "Treasury release lifecycle/audit projection" },
  "transfer.settled": { classification: "informational", queue: "events", purpose: "Treasury settlement lifecycle/audit projection" },
  "travel.approved": { classification: "informational", queue: "events", purpose: "Travel lifecycle/audit projection" },
  "travel.booked_mock": { classification: "informational", queue: "events", purpose: "Sandbox travel lifecycle/audit projection" },
  "travel.confirmed": { classification: "informational", queue: "events", purpose: "Travel lifecycle/audit projection" },
  "travel.submitted": { classification: "informational", queue: "events", purpose: "Travel lifecycle/audit projection" },
  "travel.trip_created": { classification: "informational", queue: "events", purpose: "Travel lifecycle/audit projection" },
  "user.activated": { classification: "informational", queue: "events", purpose: "Identity lifecycle/audit projection" },
  "user.created": { classification: "informational", queue: "events", purpose: "Identity lifecycle/audit projection" },
  "user.published": { classification: "informational", queue: "events", purpose: "Legacy seeded identity lifecycle event" },
  "user.terminated": { classification: "informational", queue: "events", purpose: "Identity lifecycle/audit projection" },
  "vendor.bank_changed": { classification: "informational", queue: "events", purpose: "Vendor control/audit projection" },
  "vendor.created": { classification: "informational", queue: "events", purpose: "Vendor lifecycle/audit projection" },
  "card.frozen": { classification: "informational", queue: "events", purpose: "Card control/audit projection" },
} as const satisfies Record<string, EventDefinition>;

export type CatalogEventType = keyof typeof eventCatalog;
export const allEventTypes = Object.keys(eventCatalog) as CatalogEventType[];

export function eventDefinition(type: string): EventDefinition | null {
  return eventCatalog[type as CatalogEventType] ?? null;
}
