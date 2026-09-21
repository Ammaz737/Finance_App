export type NavigationItem = { href: string; label: string; permission?: string; feature?: string; phase?: "P0" | "P1" | "P2" };
export type NavigationSection = { label: string; items: NavigationItem[] };

// Keep every implemented company-web route reachable. Stub-only pages are omitted.
export const navigation: NavigationSection[] = [
  { label: "Workspace", items: [
    { href: "/app/home", label: "Overview" },
    { href: "/app/inbox", label: "Inbox" },
    { href: "/app/search", label: "Search" },
  ] },
  { label: "My work", items: [
    { href: "/app/me/cards", label: "My cards", permission: "card.read", feature: "cards" },
    { href: "/app/me/expenses", label: "My expenses", permission: "expense.read", feature: "expenses" },
    { href: "/app/me/requests", label: "My requests", permission: "spend_request.create", feature: "cards" },
    { href: "/app/me/reimbursements", label: "My reimbursements", permission: "reimbursement.create", feature: "expenses" },
    { href: "/app/me/travel", label: "My travel", permission: "travel.book", feature: "travel" },
  ] },
  { label: "Spend", items: [
    { href: "/app/spend/programs", label: "Spend programs", permission: "spend_program.manage", feature: "cards" },
    { href: "/app/spend/requests", label: "Spend requests", permission: "spend_request.approve", feature: "cards" },
    { href: "/app/spend/cards", label: "Cards", permission: "card.issue", feature: "cards" },
    { href: "/app/spend/funds", label: "Funds", permission: "fund.create", feature: "cards" },
    { href: "/app/spend/transactions", label: "Transactions", permission: "expense.read", feature: "expenses" },
    { href: "/app/disputes", label: "Disputes", permission: "*", feature: "cards", phase: "P1" },
  ] },
  { label: "Expenses", items: [
    { href: "/app/expenses/transactions", label: "Expense review", permission: "expense.approve", feature: "expenses" },
    { href: "/app/expenses/receipts", label: "Receipts", permission: "expense.create", feature: "expenses" },
    { href: "/app/expenses/reimbursements", label: "Reimbursements", permission: "reimbursement.approve", feature: "expenses" },
  ] },
  { label: "Procurement", items: [
    { href: "/app/procurement/requests", label: "Requests", permission: "procurement.review", feature: "procurement" },
    { href: "/app/procurement/programs", label: "Programs", permission: "procurement.review", feature: "procurement" },
    { href: "/app/procurement/purchase-orders", label: "Purchase orders", permission: "procurement.review", feature: "procurement" },
    { href: "/app/procurement/receiving", label: "Receiving", permission: "procurement.review", feature: "procurement" },
    { href: "/app/procurement/contracts", label: "Contracts", permission: "*", feature: "procurement", phase: "P1" },
  ] },
  { label: "Vendors & Bill Pay", items: [
    { href: "/app/vendors", label: "Vendors", permission: "vendor.read", feature: "procurement" },
    { href: "/app/bill-pay/bills", label: "Bills", permission: "bill.create", feature: "bill_pay" },
    { href: "/app/bill-pay/bills?stage=For%20approval", label: "For approval", permission: "bill.approve", feature: "bill_pay" },
    { href: "/app/bill-pay/bills?stage=For%20payment", label: "For payment", permission: "payment.create", feature: "bill_pay" },
    { href: "/app/bill-pay/payments", label: "Payments", permission: "payment.create", feature: "bill_pay" },
    { href: "/app/bill-pay/payment-runs", label: "Payment runs", permission: "payment_run.manage", feature: "bill_pay" },
    { href: "/app/bill-pay/bills?stage=History", label: "History", permission: "bill.create", feature: "bill_pay" },
  ] },
  { label: "Accounting", items: [
    { href: "/app/accounting/overview", label: "Overview", permission: "accounting.read", feature: "accounting" },
    { href: "/app/accounting/review", label: "Needs review", permission: "accounting.read", feature: "accounting" },
    { href: "/app/accounting/ready-to-sync", label: "Ready to sync", permission: "accounting.read", feature: "accounting" },
    { href: "/app/accounting/synced", label: "Synced", permission: "accounting.read", feature: "accounting" },
    { href: "/app/accounting/errors", label: "Sync errors", permission: "accounting.read", feature: "accounting" },
    { href: "/app/accounting/rules", label: "Rules", permission: "accounting.read", feature: "accounting" },
    { href: "/app/accounting/integrations", label: "Integrations", permission: "accounting.read", feature: "accounting" },
  ] },
  { label: "Banking", items: [
    { href: "/app/banking/accounts", label: "Accounts", permission: "treasury.transfer.create", feature: "treasury", phase: "P1" },
    { href: "/app/banking/transfers", label: "Transfers", permission: "treasury.transfer.create", feature: "treasury", phase: "P1" },
  ] },
  { label: "Receivables", items: [
    { href: "/app/receivables/customers", label: "Customers", permission: "*", feature: "receivables", phase: "P1" },
    { href: "/app/receivables/invoices", label: "Invoices", permission: "*", feature: "receivables", phase: "P1" },
    { href: "/app/receivables/payments", label: "Incoming payments", permission: "*", feature: "receivables", phase: "P1" },
  ] },
  { label: "Insights", items: [
    { href: "/app/insights/dashboard", label: "Dashboard", permission: "report.read" },
    { href: "/app/insights/budgets", label: "Budgets", permission: "report.read" },
    { href: "/app/notifications", label: "Notifications" },
    { href: "/app/tax", label: "Tax operations", permission: "*", phase: "P1" },
  ] },
  { label: "Travel", items: [
    { href: "/app/travel/trips", label: "Trips", permission: "travel.book", feature: "travel" },
    { href: "/app/travel/requests", label: "Trip requests", permission: "travel.approve", feature: "travel" },
  ] },
  { label: "AI & tools", items: [
    { href: "/app/ai/ask", label: "Ask AI", permission: "*", feature: "ai_spend", phase: "P2" },
    { href: "/app/ai/agents", label: "Agent identities", permission: "*", feature: "agent_finance", phase: "P2" },
    { href: "/app/ai/router", label: "Router logs", permission: "*", feature: "ai_spend", phase: "P2" },
    { href: "/app/ai/token-spend", label: "Token spend", permission: "*", feature: "ai_spend", phase: "P2" },
    { href: "/app/ai/sheets", label: "Sheets", permission: "*", feature: "sheets", phase: "P2" },
  ] },
  { label: "Company", items: [
    { href: "/app/company/settings", label: "Settings", permission: "roles.assign" },
    { href: "/app/company/entities", label: "Entities", permission: "roles.assign" },
    { href: "/app/company/departments", label: "Departments", permission: "roles.assign" },
    { href: "/app/company/locations", label: "Locations", permission: "roles.assign" },
    { href: "/app/company/people", label: "People", permission: "people.read" },
    { href: "/app/company/roles", label: "Roles", permission: "roles.assign" },
    { href: "/app/company/policy", label: "Policies", permission: "roles.assign" },
    { href: "/app/company/approvals", label: "Approval rules", permission: "roles.assign" },
    { href: "/app/company/integrations", label: "Integrations", permission: "report.read" },
    { href: "/app/company/rewards", label: "Rewards", permission: "*", phase: "P1" },
    { href: "/app/company/audit", label: "Audit log", permission: "audit.read" },
  ] },
  { label: "Developer", items: [
    { href: "/app/developer", label: "Developer apps", permission: "*", feature: "developer_platform", phase: "P1" },
  ] },
];

export function canSeeItem(item: NavigationItem, session: { roles: string[]; permissions: string[]; entitlements: string[] }) {
  if (item.phase === "P1" && process.env.NEXT_PUBLIC_ENABLE_P1_ROUTES !== "true") return false;
  if (item.phase === "P2" && process.env.NEXT_PUBLIC_ENABLE_P2_ROUTES !== "true") return false;
  const privileged = session.roles.includes("Owner") || session.permissions.includes("*");
  return (!item.permission || privileged || session.permissions.includes(item.permission)) &&
    (!item.feature || session.entitlements.includes(item.feature));
}
