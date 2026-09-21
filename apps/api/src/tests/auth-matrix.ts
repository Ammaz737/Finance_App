/**
 * Route authorization matrix (M0/M1 foundation).
 *
 * Server-side enforcement lives in `resource-access.ts` + domain actions.
 * Frontend permission hiding is not a security boundary.
 *
 * Roles exercised by tests: Owner, Finance Admin, Manager, Employee.
 */

export type MatrixRow = {
  resource: string;
  action: "read" | "create" | string;
  owner: boolean;
  financeAdmin: boolean;
  manager: boolean;
  employee: boolean;
  notes?: string;
};

/** Expected allow (true) / deny (false) for seeded permission sets. */
export const ROUTE_AUTHORIZATION_MATRIX: MatrixRow[] = [
  { resource: "bills", action: "read", owner: true, financeAdmin: true, manager: false, employee: false },
  { resource: "bills", action: "create", owner: true, financeAdmin: true, manager: false, employee: false },
  { resource: "bills", action: "approve", owner: true, financeAdmin: true, manager: false, employee: false },
  { resource: "payments", action: "create", owner: true, financeAdmin: true, manager: false, employee: false },
  { resource: "payments", action: "release", owner: true, financeAdmin: true, manager: false, employee: false },
  { resource: "expenses", action: "read", owner: true, financeAdmin: true, manager: true, employee: true, notes: "SELF/DIRECT_REPORTS for non-org scopes" },
  { resource: "expenses", action: "create", owner: true, financeAdmin: true, manager: true, employee: true },
  { resource: "expenses", action: "approve", owner: true, financeAdmin: true, manager: true, employee: false },
  { resource: "cards", action: "read", owner: true, financeAdmin: true, manager: true, employee: true, notes: "SELF for employee card holder" },
  { resource: "spend-requests", action: "create", owner: true, financeAdmin: true, manager: true, employee: true },
  { resource: "spend-requests", action: "approve", owner: true, financeAdmin: true, manager: true, employee: false },
  { resource: "audit", action: "read", owner: true, financeAdmin: false, manager: false, employee: false },
  { resource: "people", action: "read", owner: true, financeAdmin: false, manager: false, employee: false },
  { resource: "treasury", action: "create", owner: true, financeAdmin: true, manager: false, employee: false },
];

export const ROLE_PERMISSIONS: Record<"Owner" | "Finance Admin" | "Manager" | "Employee", string[]> = {
  Owner: ["*"],
  "Finance Admin": [
    "bill.create", "bill.approve", "bill.read",
    "payment.create", "payment.release",
    "expense.read", "expense.create", "expense.approve",
    "card.read", "card.issue",
    "spend_request.create", "spend_request.approve",
    "treasury.transfer.create", "treasury.transfer.approve", "treasury.transfer.release",
    "reimbursement.create", "reimbursement.approve", "reimbursement.pay",
  ],
  Manager: [
    "expense.read", "expense.create", "expense.approve",
    "card.read",
    "spend_request.create", "spend_request.approve",
    "reimbursement.create", "reimbursement.approve",
  ],
  Employee: [
    "expense.read", "expense.create",
    "card.read",
    "spend_request.create",
    "reimbursement.create",
  ],
};
