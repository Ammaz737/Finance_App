/**
 * Presentation matrix for custom role authoring.
 * UI checkboxes are Read / Write / Edit / Delete; each maps to domain permission keys.
 * When a capability is omitted (null), the checkbox is disabled for that page.
 */

export const ROLE_CRUD = ["read", "write", "edit", "delete"] as const;
export type RoleCrud = (typeof ROLE_CRUD)[number];

export type PageCapability = {
  /** Domain permission keys granted when this checkbox is on. */
  keys: readonly string[];
  /** Short hint shown under the column when available. */
  hint?: string;
};

export type RolePageModule = {
  id: string;
  label: string;
  section: string;
  description?: string;
  capabilities: Partial<Record<RoleCrud, PageCapability>>;
};

/** Seeded / reserved role names that must not be renamed or deleted. */
export const SYSTEM_ROLE_NAMES = ["Owner", "Finance Admin", "Manager", "Employee"] as const;

export const ROLE_SCOPES = [
  "SELF",
  "DIRECT_REPORTS",
  "DEPARTMENT",
  "ENTITY",
  "ORGANIZATION",
] as const;

export type RoleScope = (typeof ROLE_SCOPES)[number];

/**
 * One row per navigable product surface. Capabilities mirror resource-access + nav.
 * Unavailable verbs are omitted so the UI can disable those checkboxes.
 */
export const ROLE_PAGE_MODULES: readonly RolePageModule[] = [
  // —— My work ——
  {
    id: "me.cards",
    label: "My card",
    section: "My work",
    description: "View own corporate cards",
    capabilities: {
      read: { keys: ["card.read"], hint: "View own cards" },
    },
  },
  {
    id: "me.expenses",
    label: "My expenses",
    section: "My work",
    capabilities: {
      read: { keys: ["expense.read"], hint: "View own expenses" },
      write: { keys: ["expense.create"], hint: "Create / submit" },
      edit: { keys: ["expense.create"], hint: "Split / memo" },
    },
  },
  {
    id: "me.requests",
    label: "My spend requests",
    section: "My work",
    capabilities: {
      read: { keys: ["spend_request.create"], hint: "View own requests" },
      write: { keys: ["spend_request.create"], hint: "Create requests" },
    },
  },
  {
    id: "me.reimbursements",
    label: "My reimbursements",
    section: "My work",
    capabilities: {
      read: { keys: ["reimbursement.create"], hint: "View own claims" },
      write: { keys: ["reimbursement.create"], hint: "Create / submit" },
      edit: { keys: ["reimbursement.create"], hint: "Attach receipts" },
    },
  },
  {
    id: "me.travel",
    label: "My travel",
    section: "My work",
    capabilities: {
      read: { keys: ["travel.book"], hint: "View own trips" },
      write: { keys: ["travel.book"], hint: "Book / search" },
      edit: { keys: ["travel.book"], hint: "Update trip" },
      delete: { keys: ["travel.book"], hint: "Cancel trip" },
    },
  },

  // —— Spend ——
  {
    id: "spend.programs",
    label: "Spend programs",
    section: "Spend",
    capabilities: {
      read: { keys: ["spend_program.manage"], hint: "View programs" },
      write: { keys: ["spend_program.manage"], hint: "Create programs" },
      edit: { keys: ["spend_program.manage"], hint: "Update programs" },
      delete: { keys: ["spend_program.manage"], hint: "Deactivate" },
    },
  },
  {
    id: "spend.requests",
    label: "Spend requests (review)",
    section: "Spend",
    capabilities: {
      read: { keys: ["spend_request.approve"], hint: "View for approval" },
      edit: { keys: ["spend_request.approve"], hint: "Approve / reject" },
    },
  },
  {
    id: "spend.cards",
    label: "Cards (admin)",
    section: "Spend",
    capabilities: {
      read: { keys: ["card.read"], hint: "View all cards" },
      write: { keys: ["card.issue"], hint: "Issue / controls" },
      edit: { keys: ["card.freeze"], hint: "Freeze / unfreeze" },
      delete: { keys: ["card.freeze"], hint: "Terminate card" },
    },
  },
  {
    id: "spend.funds",
    label: "Funds",
    section: "Spend",
    capabilities: {
      read: { keys: ["card.read"], hint: "View funds" },
      write: { keys: ["fund.create"], hint: "Create funds" },
    },
  },
  {
    id: "spend.transactions",
    label: "Card transactions",
    section: "Spend",
    capabilities: {
      read: { keys: ["expense.read", "card.read"], hint: "View authorizations" },
      edit: { keys: ["card.issue"], hint: "Clear / void / reverse" },
    },
  },

  // —— Expenses ——
  {
    id: "expenses.review",
    label: "Expense review",
    section: "Expenses",
    capabilities: {
      read: { keys: ["expense.approve", "expense.read"], hint: "View queue" },
      edit: { keys: ["expense.approve"], hint: "Approve expenses" },
    },
  },
  {
    id: "expenses.receipts",
    label: "Receipts",
    section: "Expenses",
    capabilities: {
      read: { keys: ["expense.read", "expense.create"], hint: "View receipts" },
      write: { keys: ["expense.create"], hint: "Upload / link" },
    },
  },
  {
    id: "expenses.reimbursements",
    label: "Reimbursements (finance)",
    section: "Expenses",
    capabilities: {
      read: { keys: ["reimbursement.approve", "reimbursement.pay"], hint: "View claims" },
      edit: { keys: ["reimbursement.approve"], hint: "Approve" },
      write: { keys: ["reimbursement.pay"], hint: "Schedule payout" },
    },
  },

  // —— Procurement ——
  {
    id: "procurement.requests",
    label: "Procurement requests",
    section: "Procurement",
    capabilities: {
      read: { keys: ["procurement.request", "procurement.review"], hint: "View requests" },
      write: { keys: ["procurement.request"], hint: "Create / submit" },
      edit: { keys: ["procurement.review"], hint: "Approve / review" },
    },
  },
  {
    id: "procurement.programs",
    label: "Procurement programs",
    section: "Procurement",
    capabilities: {
      read: { keys: ["procurement.review"], hint: "View programs" },
      write: { keys: ["procurement.review"], hint: "Create programs" },
    },
  },
  {
    id: "procurement.purchase-orders",
    label: "Purchase orders",
    section: "Procurement",
    capabilities: {
      read: { keys: ["procurement.review", "po.create"], hint: "View POs" },
      write: { keys: ["po.create"], hint: "Issue PO" },
      edit: { keys: ["procurement.review"], hint: "Receive / match / change" },
    },
  },
  {
    id: "procurement.receiving",
    label: "Receiving",
    section: "Procurement",
    capabilities: {
      read: { keys: ["procurement.review"], hint: "View receipts" },
      write: { keys: ["procurement.review"], hint: "Record receipt" },
    },
  },
  {
    id: "procurement.match-exceptions",
    label: "Match exceptions",
    section: "Procurement",
    capabilities: {
      read: { keys: ["procurement.review", "bill.approve"], hint: "View exceptions" },
      edit: { keys: ["procurement.review"], hint: "Resolve" },
    },
  },

  // —— Vendors & Bill Pay ——
  {
    id: "vendors",
    label: "Vendors",
    section: "Vendors & Bill Pay",
    capabilities: {
      read: { keys: ["vendor.read"], hint: "View vendors" },
      write: { keys: ["vendor.create"], hint: "Create vendors" },
      edit: { keys: ["vendor.create", "vendor.bank_details.manage"], hint: "Update / bank details" },
      delete: { keys: ["vendor.create"], hint: "Deactivate" },
    },
  },
  {
    id: "bills",
    label: "Bills",
    section: "Vendors & Bill Pay",
    capabilities: {
      read: { keys: ["bill.read", "bill.create", "bill.approve"], hint: "View bills" },
      write: { keys: ["bill.create"], hint: "Create / submit" },
      edit: { keys: ["bill.create", "bill.approve"], hint: "Edit draft / approve" },
      delete: { keys: ["bill.create"], hint: "Cancel bill" },
    },
  },
  {
    id: "payments",
    label: "Payments",
    section: "Vendors & Bill Pay",
    capabilities: {
      read: { keys: ["payment.create", "payment.release"], hint: "View payments" },
      write: { keys: ["payment.create"], hint: "Create payment" },
      edit: { keys: ["payment.release"], hint: "Release / settle" },
      delete: { keys: ["payment.create"], hint: "Cancel payment" },
    },
  },
  {
    id: "payment-runs",
    label: "Payment runs",
    section: "Vendors & Bill Pay",
    capabilities: {
      read: { keys: ["payment_run.manage"], hint: "View runs" },
      write: { keys: ["payment_run.manage"], hint: "Create / add payments" },
      edit: { keys: ["payment_run.manage"], hint: "Release run" },
      delete: { keys: ["payment_run.manage"], hint: "Remove payments" },
    },
  },

  // —— Accounting ——
  {
    id: "accounting",
    label: "Accounting review & sync",
    section: "Accounting",
    capabilities: {
      read: { keys: ["accounting.read"], hint: "View queue" },
      edit: { keys: ["accounting.code"], hint: "Code / ready" },
      write: { keys: ["accounting.sync"], hint: "Sync / retry" },
    },
  },
  {
    id: "accounting.rules",
    label: "Accounting rules",
    section: "Accounting",
    capabilities: {
      read: { keys: ["accounting.read", "accounting.code"], hint: "View rules" },
      write: { keys: ["accounting.code"], hint: "Create rules" },
    },
  },
  {
    id: "accounting.integrations",
    label: "Accounting integrations",
    section: "Accounting",
    capabilities: {
      read: { keys: ["accounting.read", "report.read"], hint: "View connections" },
      edit: { keys: ["accounting.sync"], hint: "Ping / sync" },
    },
  },

  // —— Travel ——
  {
    id: "travel.trips",
    label: "Trips",
    section: "Travel",
    capabilities: {
      read: { keys: ["travel.book", "travel.approve"], hint: "View trips" },
      write: { keys: ["travel.book"], hint: "Create / book" },
      edit: { keys: ["travel.book"], hint: "Update / provision" },
      delete: { keys: ["travel.book"], hint: "Cancel / refund" },
    },
  },
  {
    id: "travel.requests",
    label: "Trip requests (approve)",
    section: "Travel",
    capabilities: {
      read: { keys: ["travel.approve"], hint: "View for approval" },
      edit: { keys: ["travel.approve"], hint: "Approve trips" },
    },
  },
  {
    id: "travel.reports",
    label: "Travel reports",
    section: "Travel",
    capabilities: {
      read: { keys: ["report.read"], hint: "View reports" },
    },
  },

  // —— Insights ——
  {
    id: "insights.dashboard",
    label: "Insights dashboard",
    section: "Insights",
    capabilities: {
      read: { keys: ["report.read"], hint: "View dashboards" },
    },
  },
  {
    id: "insights.budgets",
    label: "Budgets",
    section: "Insights",
    capabilities: {
      read: { keys: ["report.read", "budget.manage"], hint: "View budgets" },
      write: { keys: ["budget.manage"], hint: "Create budgets" },
      edit: { keys: ["budget.manage"], hint: "Manage budgets" },
    },
  },

  // —— Treasury ——
  {
    id: "treasury",
    label: "Treasury transfers",
    section: "Treasury",
    capabilities: {
      read: { keys: ["treasury.transfer.create", "treasury.transfer.approve", "treasury.transfer.release"], hint: "View transfers" },
      write: { keys: ["treasury.transfer.create"], hint: "Create transfer" },
      edit: { keys: ["treasury.transfer.approve", "treasury.transfer.release"], hint: "Approve / release" },
    },
  },

  // —— Company ——
  {
    id: "company.people",
    label: "People",
    section: "Company",
    capabilities: {
      read: { keys: ["people.read"], hint: "View directory" },
      write: { keys: ["people.invite"], hint: "Invite people" },
      edit: { keys: ["people.edit"], hint: "Edit / suspend" },
    },
  },
  {
    id: "company.roles",
    label: "Roles & assignments",
    section: "Company",
    capabilities: {
      read: { keys: ["roles.assign"], hint: "View roles" },
      write: { keys: ["roles.assign"], hint: "Create roles" },
      edit: { keys: ["roles.assign"], hint: "Edit / assign roles" },
    },
  },
  {
    id: "company.org",
    label: "Entities, departments, locations",
    section: "Company",
    capabilities: {
      read: { keys: ["roles.assign"], hint: "View org structure" },
      write: { keys: ["roles.assign"], hint: "Create" },
      edit: { keys: ["roles.assign"], hint: "Update" },
      delete: { keys: ["roles.assign"], hint: "Archive" },
    },
  },
  {
    id: "company.policy",
    label: "Policies & approvals",
    section: "Company",
    capabilities: {
      read: { keys: ["roles.assign"], hint: "View builders" },
      write: { keys: ["roles.assign"], hint: "Create" },
      edit: { keys: ["roles.assign"], hint: "Version / enable" },
      delete: { keys: ["roles.assign"], hint: "Disable" },
    },
  },
  {
    id: "company.dimensions",
    label: "Accounting dimensions",
    section: "Company",
    capabilities: {
      read: { keys: ["accounting.read", "accounting.code"], hint: "View dimensions" },
      write: { keys: ["accounting.code"], hint: "Create" },
      edit: { keys: ["accounting.code"], hint: "Update" },
    },
  },
  {
    id: "company.audit",
    label: "Audit log",
    section: "Company",
    capabilities: {
      read: { keys: ["audit.read"], hint: "View audit history" },
    },
  },
] as const;

export type PageGrantSelection = Partial<Record<RoleCrud, boolean>>;
export type RoleMatrixSelection = Record<string, PageGrantSelection>;

export function isCapabilityAvailable(page: RolePageModule, crud: RoleCrud): boolean {
  return Boolean(page.capabilities[crud]?.keys.length);
}

export function moduleById(id: string): RolePageModule | undefined {
  return ROLE_PAGE_MODULES.find((page) => page.id === id);
}

/** Flatten checked matrix cells → unique domain permission keys. */
export function permissionKeysFromSelection(selection: RoleMatrixSelection): string[] {
  const keys = new Set<string>();
  for (const page of ROLE_PAGE_MODULES) {
    const row = selection[page.id];
    if (!row) continue;
    for (const crud of ROLE_CRUD) {
      if (!row[crud]) continue;
      const capability = page.capabilities[crud];
      if (!capability) continue;
      for (const key of capability.keys) keys.add(key);
    }
  }
  return [...keys].sort();
}

/**
 * Best-effort reverse map: which checkboxes explain the granted keys.
 * A checkbox is on when every key it grants is present on the role.
 */
export function selectionFromPermissionKeys(keys: readonly string[]): RoleMatrixSelection {
  const set = new Set(keys);
  const selection: RoleMatrixSelection = {};
  for (const page of ROLE_PAGE_MODULES) {
    const row: PageGrantSelection = {};
    for (const crud of ROLE_CRUD) {
      const capability = page.capabilities[crud];
      if (!capability) continue;
      row[crud] = capability.keys.every((key) => set.has(key));
    }
    if (Object.keys(row).length) selection[page.id] = row;
  }
  return selection;
}

/** Validate UI selection: reject unknown pages or enabling unavailable capabilities. */
export function assertValidMatrixSelection(selection: RoleMatrixSelection): void {
  for (const [pageId, row] of Object.entries(selection)) {
    const page = moduleById(pageId);
    if (!page) throw new Error(`Unknown page module: ${pageId}`);
    for (const crud of ROLE_CRUD) {
      if (row[crud] && !isCapabilityAvailable(page, crud)) {
        throw new Error(`${page.label} does not support ${crud}`);
      }
    }
  }
}

export function groupModulesBySection(): Array<{ section: string; pages: RolePageModule[] }> {
  const order: string[] = [];
  const map = new Map<string, RolePageModule[]>();
  for (const page of ROLE_PAGE_MODULES) {
    if (!map.has(page.section)) {
      order.push(page.section);
      map.set(page.section, []);
    }
    map.get(page.section)!.push(page);
  }
  return order.map((section) => ({ section, pages: map.get(section)! }));
}

export function isSystemRoleName(name: string): boolean {
  return (SYSTEM_ROLE_NAMES as readonly string[]).includes(name);
}
