import { prisma } from "../database/client";
import type { RequestContext } from "./auth/context";
import { AppError } from "./http";

type AccessRule = {
  read?: string[];
  create?: string;
  actions?: Record<string, string>;
  ownerField?: string;
  entityField?: string;
  publicToTenant?: boolean;
};

// Routes absent from this list remain Owner-only while their domain services are built.
const rules: Record<string, AccessRule> = {
  entities: { publicToTenant: true, entityField: "id", create: "roles.assign" },
  departments: { publicToTenant: true, create: "roles.assign" },
  locations: { publicToTenant: true, create: "roles.assign" },
  people: { read: ["people.read"], create: "people.invite", actions: { publish: "people.edit", terminate: "people.edit", "reset-credentials": "people.edit" }, entityField: "id" },
  rbac: { read: ["roles.assign", "people.invite"] },
  cards: { read: ["card.read"], actions: { freeze: "card.freeze", "set-controls": "card.issue" }, ownerField: "holderId", entityField: "legalEntityId" },
  funds: { read: ["card.read"], ownerField: "ownerId", entityField: "legalEntityId" },
  "spend-programs": { publicToTenant: true, entityField: "legalEntityId", create: "spend_program.manage" },
  "procurement-programs": { publicToTenant: true, create: "procurement.review" },
  "spend-requests": { read: ["spend_request.create", "spend_request.approve"], create: "spend_request.create", actions: { approve: "spend_request.approve" }, ownerField: "requesterId", entityField: "legalEntityId" },
  transactions: { read: ["expense.read", "card.read"], actions: { clear: "card.issue", capture: "card.issue", void: "card.issue", reverse: "card.issue" }, entityField: "legalEntityId" },
  authorizations: { read: ["card.read", "card.issue"], create: "card.issue" },
  "business-limits": { read: ["card.issue", "spend_program.manage"], create: "spend_program.manage", entityField: "legalEntityId" },
  expenses: { read: ["expense.read", "expense.create", "expense.approve"], actions: { submit: "expense.create", approve: "expense.approve", split: "expense.create", "update-memo": "expense.create" }, ownerField: "userId", entityField: "legalEntityId" },
  receipts: { read: ["expense.read", "expense.create"], create: "expense.create", actions: { link: "expense.create" } },
  documents: { read: ["expense.create", "bill.create", "vendor.create"] },
  reimbursements: { read: ["reimbursement.create", "reimbursement.approve", "reimbursement.pay"], create: "reimbursement.create", actions: { approve: "reimbursement.approve", schedule: "reimbursement.pay", "confirm-payout": "reimbursement.pay" }, ownerField: "userId", entityField: "legalEntityId" },
  vendors: { read: ["vendor.read", "vendor.create", "vendor.bank_details.manage"], create: "vendor.create", actions: { "set-bank": "vendor.bank_details.manage" }, entityField: "legalEntityId" },
  bills: { read: ["bill.create", "bill.approve", "bill.read"], create: "bill.create", actions: { submit: "bill.create", approve: "bill.approve" }, entityField: "legalEntityId" },
  payments: { read: ["payment.create", "payment.release"], create: "payment.create", actions: { release: "payment.release", "confirm-settlement": "payment.release" }, entityField: "legalEntityId" },
  "payment-runs": { read: ["payment_run.manage"], create: "payment_run.manage", actions: { release: "payment_run.manage", "add-payments": "payment_run.manage" }, entityField: "legalEntityId" },
  travel: { read: ["travel.book", "travel.approve"], create: "travel.book", actions: { search: "travel.book", "select-quote": "travel.book", submit: "travel.book", approve: "travel.approve", "link-fund": "travel.book", "link-expense": "travel.book" }, ownerField: "travelerId", entityField: "legalEntityId" },
  "travel-bookings": { read: ["travel.book", "travel.approve"], actions: { "book-mock": "travel.book", confirm: "travel.book" } },
  procurement: { read: ["procurement.request", "procurement.review"], create: "procurement.request", actions: { submit: "procurement.request", approve: "procurement.review" }, ownerField: "requesterId", entityField: "legalEntityId" },
  "purchase-orders": { read: ["procurement.review", "po.create"], actions: { receive: "procurement.review", match: "procurement.review" }, entityField: "legalEntityId" },
  receiving: { read: ["procurement.review"], create: "procurement.review" },
  matches: { read: ["procurement.review", "bill.approve"] },
  accounting: { read: ["accounting.read", "accounting.code", "accounting.sync"], actions: { code: "accounting.code", ready: "accounting.code", "undo-ready": "accounting.code", retry: "accounting.sync", sync: "accounting.sync", "confirm-sync": "accounting.sync" }, entityField: "legalEntityId" },
  "accounting-rules": { read: ["accounting.read", "accounting.code"], create: "accounting.code" },
  "erp-sync": { read: ["accounting.sync"], create: "accounting.sync" },
  audit: { read: ["audit.read"] },
  budgets: { read: ["report.read", "budget.manage"], create: "budget.manage", entityField: "legalEntityId" },
  integrations: { read: ["report.read", "accounting.read", "accounting.sync"], actions: { ping: "accounting.sync" } },
};

function isOwner(ctx: RequestContext) {
  return ctx.roles.includes("Owner") || ctx.permissions.includes("*");
}

export function resourceRule(resource: string): AccessRule {
  return rules[resource] ?? {};
}

export async function scopedWhere(
  ctx: RequestContext,
  resource: string,
  permissions: string[] = resourceRule(resource).read ?? [],
): Promise<Record<string, unknown>> {
  const tenant = { organizationId: ctx.organizationId };
  if (isOwner(ctx)) return tenant;
  const rule = resourceRule(resource);
  if (rule.publicToTenant && permissions.length === 0) {
    if (rule.entityField && ctx.entityIds.length) {
      return { ...tenant, [rule.entityField]: { in: ctx.entityIds } };
    }
    return tenant;
  }
  const grants = ctx.grants.filter((grant) => permissions.includes(grant.permission));
  if (!grants.length) throw new AppError("FORBIDDEN", `Missing access to ${resource}`, 403);
  if (grants.some((grant) => grant.scope === "ORGANIZATION")) return tenant;

  const or: Record<string, unknown>[] = [];
  const entityIds = grants.filter((grant) => ["ENTITY", "MULTI_ENTITY"].includes(grant.scope)).map((grant) => grant.entityId).filter((id): id is string => Boolean(id));
  if (rule.entityField && entityIds.length) or.push({ [rule.entityField]: { in: entityIds } });
  if (rule.ownerField && grants.some((grant) => grant.scope === "SELF")) or.push({ [rule.ownerField]: ctx.userId });
  if (rule.ownerField && grants.some((grant) => grant.scope === "DIRECT_REPORTS")) {
    const directReports = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId, managerId: ctx.userId },
      select: { id: true },
    });
    or.push({ [rule.ownerField]: { in: directReports.map((user) => user.id) } });
  }
  if (!or.length) throw new AppError("FORBIDDEN", `No applicable scope for ${resource}`, 403);
  return { ...tenant, OR: or };
}

export function assertResourcePermission(ctx: RequestContext, permission?: string) {
  if (isOwner(ctx)) return;
  if (!permission || !ctx.permissions.includes(permission)) {
    throw new AppError("FORBIDDEN", `Missing permission ${permission ?? "for this action"}`, 403);
  }
}

export function assertEntityPermission(ctx: RequestContext, permission: string, entityId: string) {
  if (isOwner(ctx)) return;
  const grants = ctx.grants.filter((grant) => grant.permission === permission);
  if (grants.some((grant) => grant.scope === "ORGANIZATION")) return;
  // SELF and DIRECT_REPORTS still need access to the entity assigned to their role.
  // Row ownership / reporting-line restrictions are applied separately by scopedWhere.
  if (grants.some((grant) => ["ENTITY", "MULTI_ENTITY", "SELF", "DIRECT_REPORTS"].includes(grant.scope) && grant.entityId === entityId)) return;
  throw new AppError("FORBIDDEN", `Missing ${permission} access to this entity`, 403);
}
