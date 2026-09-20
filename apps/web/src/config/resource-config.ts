export type FieldConfig = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "date" | "select" | "password";
  required?: boolean;
  defaultValue?: string;
  options?: Array<{ value: string; label: string }>;
  source?: { path: string; labelKey: string; entityField?: string; statuses?: string[] };
};

type ResourceConfig = {
  description: string;
  columns: string[];
  createLabel?: string;
  fields?: FieldConfig[];
  mineField?: string;
};

const entity: FieldConfig = { key: "legalEntityId", label: "Legal entity", required: true, type: "select", source: { path: "entities", labelKey: "name" } };
const currency: FieldConfig = { key: "currency", label: "Currency", required: true, defaultValue: "USD" };
const amount: FieldConfig = { key: "amount", label: "Amount", required: true, type: "number" };

export const resourceConfig: Record<string, ResourceConfig> = {
  entities: { description: "Legal entities, countries, and accounting currencies.", columns: ["name", "country", "currency"], createLabel: "Add entity", fields: [
    { key: "name", label: "Legal name", required: true }, { key: "country", label: "Country code (ISO 2)", required: true }, { key: "currency", label: "Currency code (ISO 3)", required: true },
  ] },
  departments: { description: "Departments used for people, policies, and reporting.", columns: ["name"], createLabel: "Add department", fields: [{ key: "name", label: "Department name", required: true }] },
  locations: { description: "Office locations and regional assignments.", columns: ["name"], createLabel: "Add location", fields: [{ key: "name", label: "Location name", required: true }] },
  rbac: { description: "Additive roles that define finance access.", columns: ["name", "description"] },
  policies: { description: "Company rules applied to financial work.", columns: ["name", "objectType", "enabled", "createdAt"] },
  approvals: { description: "Approval workflows and routing by object type.", columns: ["name", "objectType", "createdAt"] },
  integrations: { description: "Connected providers and synchronization state.", columns: ["family", "provider", "status"] },
  budgets: { description: "Spend targets with server-side actual, committed, and remaining capacity (no double count).", columns: ["name", "ownerId", "amount", "actualAmount", "committedAmount", "remainingAmount", "utilizationPct", "currency", "period"], createLabel: "New budget", fields: [
    { key: "name", label: "Budget name", required: true }, entity, amount, currency,
    { key: "period", label: "Period", required: true, type: "select", options: [{ value: "MONTHLY", label: "Monthly" }, { value: "QUARTERLY", label: "Quarterly" }, { value: "ANNUAL", label: "Annual" }] },
  ] },
  "spend-programs": { description: "Reusable controls for how employees request and use company funds.", columns: ["name", "maxAmount", "currency", "defaultFulfillmentType", "status"], createLabel: "New spend program", fields: [
    { key: "name", label: "Program name", required: true }, entity,
    { key: "maxAmount", label: "Maximum request amount", required: true, type: "number" }, currency,
    { key: "budgetId", label: "Budget", type: "select", source: { path: "budgets", labelKey: "name", entityField: "legalEntityId" } },
    { key: "defaultFulfillmentType", label: "Default fulfillment", type: "select", options: [{ value: "VIRTUAL_CARD", label: "Virtual card" }, { value: "FUND_ONLY", label: "Fund only" }] },
    { key: "merchantLockDefault", label: "Default merchant lock" },
    { key: "allowedMccsDefault", label: "Default allowed MCCs (comma-separated)" },
    { key: "perTransactionLimitDefault", label: "Default per-transaction limit", type: "number" },
    { key: "velocityMaxAmountDefault", label: "Default velocity max amount", type: "number" },
    { key: "velocityMaxCountDefault", label: "Default velocity max count", type: "number" },
    { key: "defaultValidDays", label: "Default validity (days)", type: "number" },
  ] },
  procurement: { description: "Requests begin at intake and produce a PO or another approved outcome only after final approval.", columns: ["name", "requesterId", "outcomeType", "amount", "currency", "approvalProgress", "status"], createLabel: "New procurement request", fields: [
    { key: "name", label: "Request name", required: true }, entity,
    { key: "programId", label: "Procurement program", required: true, type: "select", source: { path: "procurement-programs", labelKey: "name" } },
    amount, currency,
    { key: "outcomeType", label: "Outcome", required: true, type: "select", options: [{ value: "PURCHASE_ORDER", label: "Purchase order" }, { value: "VIRTUAL_CARD", label: "Virtual card" }, { value: "VENDOR_SETUP", label: "Vendor setup" }] },
    { key: "vendorId", label: "Vendor", type: "select", source: { path: "vendors", labelKey: "name", entityField: "legalEntityId", statuses: ["ACTIVE"] } },
    { key: "memo", label: "Memo" },
  ] },
  "purchase-orders": { description: "Approved commitments with lines, receiving, and 2/3-way match.", columns: ["number", "vendorId", "amount", "receivedAmount", "billedAmount", "matchStatus", "status"] },
  receiving: { description: "Goods and services received against approved purchase orders.", columns: ["purchaseOrderId", "amount", "memo", "receivedBy", "createdAt"], createLabel: "Record receipt", fields: [
    { key: "purchaseOrderId", label: "Purchase order", required: true, type: "select", source: { path: "purchase-orders", labelKey: "number", statuses: ["OPEN", "PARTIALLY_RECEIVED"] } },
    amount,
    { key: "memo", label: "Memo" },
  ] },
  matches: { description: "2-way and 3-way match results against purchase orders.", columns: ["purchaseOrderId", "billId", "matchType", "status", "variance", "createdAt"] },
  "procurement-programs": { description: "Intake programs that route purchase requests to the right reviewers.", columns: ["name", "defaultOutcomeType", "status"], createLabel: "New intake program", fields: [
    { key: "name", label: "Program name", required: true },
    { key: "defaultOutcomeType", label: "Default outcome", type: "select", options: [{ value: "PURCHASE_ORDER", label: "Purchase order" }, { value: "VIRTUAL_CARD", label: "Virtual card" }, { value: "VENDOR_SETUP", label: "Vendor setup" }], defaultValue: "PURCHASE_ORDER" },
  ] },
  cards: { description: "Physical and virtual cards, holders, and current status.", columns: ["holderId", "type", "last4", "status", "legalEntityId"] },
  funds: { description: "Available funds and assigned spend authority.", columns: ["name", "ownerId", "availableAmount", "limitAmount", "currency", "status"] },
  "spend-requests": { description: "Review spend before it happens, with an approval trail and linked fulfillment.", columns: ["name", "requesterId", "amount", "currency", "fulfillmentType", "status", "createdAt"], createLabel: "New spend request", fields: [
    { key: "name", label: "What do you need?", required: true },
    { key: "purpose", label: "Purpose" },
    amount, currency, entity,
    { key: "programId", label: "Spend program", required: true, type: "select", source: { path: "spend-programs", labelKey: "name", entityField: "legalEntityId", statuses: ["ACTIVE"] } },
    { key: "vendorId", label: "Vendor", type: "select", source: { path: "vendors", labelKey: "name", entityField: "legalEntityId", statuses: ["ACTIVE"] } },
    { key: "fulfillmentType", label: "Fulfillment", type: "select", options: [{ value: "VIRTUAL_CARD", label: "Virtual card" }, { value: "FUND_ONLY", label: "Fund only" }] },
    { key: "expiresAt", label: "Expires at", type: "date" },
  ] },
  expenses: { description: "Transactions needing receipts, review, and accounting handoff.", columns: ["merchant", "userId", "amount", "currency", "policyResult", "status", "createdAt"] },
  receipts: { description: "Uploaded receipts linked to card transactions and expenses.", columns: ["merchantGuess", "amountGuess", "matchStatus", "ocrStatus", "expenseId", "createdAt"] },
  reimbursements: { description: "Employee out-of-pocket spend with server-calculated amounts and separate payout.", columns: ["userId", "type", "amount", "currency", "status", "createdAt"], createLabel: "New reimbursement", fields: [
    entity,
    { key: "type", label: "Type", required: true, type: "select", options: [{ value: "STANDARD", label: "Standard" }, { value: "MILEAGE", label: "Mileage" }, { value: "PER_DIEM", label: "Per diem" }] },
    { key: "amount", label: "Amount (standard only)", type: "number" },
    currency,
    { key: "memo", label: "Description", required: true },
    { key: "merchant", label: "Merchant" },
    { key: "distanceMiles", label: "Distance (miles)", type: "number" },
    { key: "perDiemNights", label: "Per-diem nights", type: "number" },
  ] },
  transactions: { description: "Card activity from authorization through clearing.", columns: ["merchant", "amount", "currency", "status", "clearedAt"] },
  vendors: { description: "Shared counterparty identity with bank-change history and risk.", columns: ["name", "category", "riskLevel", "ownerId", "status", "createdAt"], createLabel: "Add vendor", fields: [
    { key: "name", label: "Vendor name", required: true }, { key: "category", label: "Category" }, entity,
    { key: "riskLevel", label: "Risk", type: "select", options: [{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }], defaultValue: "LOW" },
    { key: "notes", label: "Notes" },
  ] },
  bills: { description: "Invoices move from intake to approval, payment release, and settlement.", columns: ["invoiceNumber", "vendorId", "amount", "remainingAmount", "currency", "status", "dueDate"], createLabel: "New bill", fields: [
    { key: "vendorId", label: "Vendor", required: true, type: "select", source: { path: "vendors", labelKey: "name", entityField: "legalEntityId", statuses: ["ACTIVE"] } }, entity,
    { key: "invoiceNumber", label: "Invoice number", required: true }, amount, currency,
    { key: "dueDate", label: "Due date", type: "date" },
    { key: "memo", label: "Memo" },
  ] },
  payments: { description: "Scheduled and released payments. Settlement is tracked separately.", columns: ["billId", "amount", "currency", "rail", "status", "settlementId", "createdAt"], createLabel: "Schedule payment", fields: [
    { key: "billId", label: "Approved bill", required: true, type: "select", source: { path: "bills", labelKey: "invoiceNumber", statuses: ["APPROVED", "PARTIAL"] } }, amount,
    { key: "rail", label: "Payment method", required: true, type: "select", options: [{ value: "ACH", label: "ACH" }, { value: "WIRE", label: "Wire" }, { value: "CHECK", label: "Check" }] },
  ] },
  "payment-runs": { description: "Batch scheduled payments for a separate release gate.", columns: ["name", "legalEntityId", "status", "createdBy", "createdAt"], createLabel: "New payment run", fields: [
    { key: "name", label: "Run name", required: true }, entity,
  ] },
  accounting: { description: "Review and code financial activity before export or ERP sync.", columns: ["sourceType", "sourceId", "amount", "currency", "category", "status", "externalId", "syncError", "updatedAt"] },
  "accounting-rules": { description: "Deterministic coding rules applied when sources enter the queue.", columns: ["name", "priority", "enabled", "createdAt"], createLabel: "New rule", fields: [
    { key: "name", label: "Rule name", required: true },
    { key: "sourceType", label: "Source type", type: "select", options: [
      { value: "CARD_TRANSACTION", label: "Card" },
      { value: "REIMBURSEMENT", label: "Reimbursement" },
      { value: "BILL", label: "Bill" },
      { value: "PAYMENT", label: "Payment" },
    ] },
    { key: "memoContains", label: "Memo contains" },
    { key: "category", label: "Set category", required: true },
    { key: "glAccount", label: "GL account" },
    { key: "department", label: "Department" },
    { key: "priority", label: "Priority (lower first)", type: "number", defaultValue: "100" },
  ] },
  people: { description: "Invite people as drafts. They activate with a one-time token, then appear as active users.", columns: ["firstName", "lastName", "email", "status", "managerId", "createdAt"], createLabel: "Invite person", fields: [
    { key: "firstName", label: "First name", required: true }, { key: "lastName", label: "Last name", required: true },
    { key: "email", label: "Work email", required: true, type: "email" },
    { key: "roleId", label: "Role", required: true, type: "select", source: { path: "rbac", labelKey: "name" } },
    { key: "managerId", label: "Manager", type: "select", source: { path: "people", labelKey: "email", statuses: ["ACTIVE"] } },
  ] },
  audit: { description: "A chronological record of material changes.", columns: ["createdAt", "actorId", "action", "objectType", "objectId"] },
  travel: { description: "Trip requests with dates, destination, cost, policy, and mock booking holds (not live confirmations).", columns: ["name", "destination", "travelerId", "startDate", "endDate", "estimatedAmount", "currency", "policyResult", "status"], createLabel: "New trip", fields: [
    { key: "name", label: "Trip name", required: true }, entity,
    { key: "destination", label: "Destination", required: true },
    { key: "purpose", label: "Purpose" },
    { key: "startDate", label: "Start date", required: true, type: "date" },
    { key: "endDate", label: "End date", required: true, type: "date" },
    { key: "estimatedAmount", label: "Estimated cost", required: true, type: "number" }, currency,
  ], mineField: "travelerId" },
  banking: { description: "Connected account balances and their source.", columns: ["name", "last4", "currency", "available", "status"] },
  treasury: { description: "Transfers with separate creation, approval, and release.", columns: ["fromAccountId", "toAccountId", "amount", "currency", "status", "createdAt"] },
};

export function labelForKey(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const actionPermissions: Record<string, Record<string, string>> = {
  cards: { freeze: "card.freeze", "set-controls": "card.issue" },
  "spend-requests": { approve: "spend_request.approve" },
  transactions: { clear: "card.issue", capture: "card.issue", void: "card.issue", reverse: "card.issue" },
  expenses: { submit: "expense.create", approve: "expense.approve", split: "expense.create", "update-memo": "expense.create" },
  receipts: { link: "expense.create" },
  reimbursements: { approve: "reimbursement.approve", schedule: "reimbursement.pay", "confirm-payout": "reimbursement.pay" },
  procurement: { submit: "procurement.request", approve: "procurement.review" },
  "purchase-orders": { receive: "procurement.review", match: "procurement.review" },
  travel: { submit: "travel.book", approve: "travel.approve", search: "travel.book", "select-quote": "travel.book", "link-fund": "travel.book", "link-expense": "travel.book" },
  "travel-bookings": { "book-mock": "travel.book", confirm: "travel.book" },
  receiving: {},
  bills: { submit: "bill.create", approve: "bill.approve" },
  payments: { release: "payment.release", "confirm-settlement": "payment.release" },
  "payment-runs": { release: "payment_run.manage", "add-payments": "payment_run.manage" },
  vendors: { "set-bank": "vendor.bank_details.manage" },
  accounting: { ready: "accounting.code", "undo-ready": "accounting.code", retry: "accounting.sync", sync: "accounting.sync", "confirm-sync": "accounting.sync" },
  people: { publish: "people.edit", terminate: "people.edit", "reset-credentials": "people.edit" },
  treasury: { approve: "treasury.transfer.approve", release: "treasury.transfer.release" },
};

export const createPermissions: Record<string, string> = {
  "spend-requests": "spend_request.create",
  reimbursements: "reimbursement.create",
  "accounting-rules": "accounting.code",
  "erp-sync": "accounting.sync",
  vendors: "vendor.create",
  bills: "bill.create",
  payments: "payment.create",
  "payment-runs": "payment_run.manage",
  procurement: "procurement.request",
  travel: "travel.book",
  receiving: "procurement.review",
  "spend-programs": "spend_program.manage",
  "procurement-programs": "procurement.review",
  budgets: "budget.manage",
  people: "people.invite",
  entities: "roles.assign",
  departments: "roles.assign",
  locations: "roles.assign",
};
