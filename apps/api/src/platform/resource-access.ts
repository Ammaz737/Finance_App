import { prisma } from "../database/client";
import type { RequestContext } from "./auth/context";
import { AppError } from "./http";

type AccessRule = {
  read?: string[];
  create?: string;
  actions?: Record<string, string>;
  ownerField?: string;
  entityField?: string;
  /** FK to Card.id — SELF / DIRECT_REPORTS / DEPARTMENT resolve via Card.holderId. */
  cardIdField?: string;
  publicToTenant?: boolean;
};

// Routes absent from this list remain Owner-only while their domain services are built.
const rules: Record<string, AccessRule> = {
  entities: { publicToTenant: true, entityField: "id", create: "roles.assign", actions: { update: "roles.assign", archive: "roles.assign" } },
  departments: { publicToTenant: true, create: "roles.assign", actions: { update: "roles.assign", archive: "roles.assign" } },
  locations: { publicToTenant: true, create: "roles.assign", actions: { update: "roles.assign", archive: "roles.assign" } },
  people: { read: ["people.read"], create: "people.invite", actions: { publish: "people.edit", update: "people.edit", "assign-role": "roles.assign", "remove-role": "roles.assign", suspend: "people.edit", terminate: "people.edit", "reset-credentials": "people.edit" }, entityField: "id" },
  rbac: { read: ["roles.assign", "people.invite"] },
  policies: { read: ["roles.assign"], create: "roles.assign", actions: { version: "roles.assign", disable: "roles.assign" } },
  approvals: { read: ["roles.assign"], create: "roles.assign", actions: { version: "roles.assign", enable: "roles.assign", disable: "roles.assign" } },
  "accounting-dimensions": { read: ["accounting.read", "accounting.code"], create: "accounting.code", actions: { update: "accounting.code" } },
  cards: { read: ["card.read"], actions: { freeze: "card.freeze", unfreeze: "card.freeze", terminate: "card.freeze", "set-controls": "card.issue" }, ownerField: "holderId", entityField: "legalEntityId" },
  funds: { read: ["card.read"], ownerField: "ownerId", entityField: "legalEntityId" },
  "spend-programs": { publicToTenant: true, entityField: "legalEntityId", create: "spend_program.manage", actions: { update: "spend_program.manage", deactivate: "spend_program.manage" } },
  "procurement-programs": { publicToTenant: true, create: "procurement.review" },
  "spend-requests": { read: ["spend_request.create", "spend_request.approve"], create: "spend_request.create", actions: { approve: "spend_request.approve" }, ownerField: "requesterId", entityField: "legalEntityId" },
  transactions: { read: ["expense.read", "card.read"], actions: { clear: "card.issue", capture: "card.issue", void: "card.issue", reverse: "card.issue" }, entityField: "legalEntityId", cardIdField: "cardId" },
  authorizations: { read: ["card.read", "card.issue"], create: "card.issue", cardIdField: "cardId" },
  "business-limits": { read: ["card.issue", "spend_program.manage"], create: "spend_program.manage", entityField: "legalEntityId" },
  expenses: { read: ["expense.read", "expense.create", "expense.approve"], create: "expense.create", actions: { submit: "expense.create", approve: "expense.approve", split: "expense.create", "update-memo": "expense.create" }, ownerField: "userId", entityField: "legalEntityId" },
  receipts: { read: ["expense.read", "expense.create"], create: "expense.create", actions: { link: "expense.create" } },
  documents: { read: ["expense.create", "bill.create", "vendor.create"] },
  reimbursements: { read: ["reimbursement.create", "reimbursement.approve", "reimbursement.pay"], create: "reimbursement.create", actions: { submit: "reimbursement.create", approve: "reimbursement.approve", schedule: "reimbursement.pay", "confirm-payout": "reimbursement.pay", "fail-payout": "reimbursement.pay", "mark-returned": "reimbursement.pay", "attach-receipt": "reimbursement.create" }, ownerField: "userId", entityField: "legalEntityId" },
  vendors: { read: ["vendor.read", "vendor.create", "vendor.bank_details.manage"], create: "vendor.create", actions: { update: "vendor.create", deactivate: "vendor.create", "set-bank": "vendor.bank_details.manage", "verify-bank": "vendor.bank_details.manage" }, entityField: "legalEntityId" },
  bills: { read: ["bill.create", "bill.approve", "bill.read"], create: "bill.create", actions: { submit: "bill.create", approve: "bill.approve", cancel: "bill.create", "edit-draft": "bill.create", "update-coding": "bill.create" }, entityField: "legalEntityId" },
  payments: { read: ["payment.create", "payment.release"], create: "payment.create", actions: { release: "payment.release", cancel: "payment.create", "confirm-settlement": "payment.release" }, entityField: "legalEntityId" },
  "payment-runs": { read: ["payment_run.manage"], create: "payment_run.manage", actions: { release: "payment_run.manage", "add-payments": "payment_run.manage", "remove-payments": "payment_run.manage" }, entityField: "legalEntityId" },
  // Bank accounts are needed as payment-run / payment source selectors (not Owner-only).
  banking: { read: ["payment_run.manage", "payment.create", "payment.release", "treasury.transfer.create"], entityField: "legalEntityId" },
  travel: { read: ["travel.book", "travel.approve"], create: "travel.book", actions: { search: "travel.book", "select-quote": "travel.book", submit: "travel.book", approve: "travel.approve", "link-fund": "travel.book", "link-expense": "travel.book", provision: "travel.book", "import-booking": "travel.book" }, ownerField: "travelerId", entityField: "legalEntityId" },
  "travel-bookings": { read: ["travel.book", "travel.approve"], actions: { "book-mock": "travel.book", confirm: "travel.book", reprice: "travel.book", cancel: "travel.book", refund: "travel.book" } },
  procurement: { read: ["procurement.request", "procurement.review"], create: "procurement.request", actions: { submit: "procurement.request", approve: "procurement.review" }, ownerField: "requesterId", entityField: "legalEntityId" },
  "purchase-orders": { read: ["procurement.review", "po.create"], actions: { receive: "procurement.review", match: "procurement.review", "request-change": "procurement.review" }, entityField: "legalEntityId" },
  receiving: { read: ["procurement.review"], create: "procurement.review" },
  matches: { read: ["procurement.review", "bill.approve"], actions: { resolve: "procurement.review" } },
  "po-change-orders": { read: ["procurement.review"], actions: { approve: "procurement.review" } },
  accounting: { read: ["accounting.read", "accounting.code", "accounting.sync"], actions: { code: "accounting.code", ready: "accounting.code", "undo-ready": "accounting.code", retry: "accounting.sync", sync: "accounting.sync", "confirm-sync": "accounting.sync" }, entityField: "legalEntityId" },
  "accounting-rules": { read: ["accounting.read", "accounting.code"], create: "accounting.code" },
  "erp-sync": { read: ["accounting.sync"], create: "accounting.sync" },
  audit: { read: ["audit.read"] },
  budgets: { read: ["report.read", "budget.manage"], create: "budget.manage", entityField: "legalEntityId" },
  integrations: { read: ["report.read", "accounting.read", "accounting.sync"], actions: { ping: "accounting.sync" } },
  treasury: { read: ["treasury.transfer.create", "treasury.transfer.approve", "treasury.transfer.release"], create: "treasury.transfer.create", actions: { approve: "treasury.transfer.approve", release: "treasury.transfer.release", "confirm-settlement": "treasury.transfer.release" } },
};

function isOwner(ctx: RequestContext) {
  return ctx.roles.includes("Owner") || ctx.permissions.includes("*");
}

export function resourceRule(resource: string): AccessRule {
  return rules[resource] ?? {};
}

async function holderIdsForGrants(ctx: RequestContext, grants: Array<{ scope: string }>): Promise<string[]> {
  const holders = new Set<string>();
  if (grants.some((grant) => grant.scope === "SELF")) holders.add(ctx.userId);
  if (grants.some((grant) => grant.scope === "DIRECT_REPORTS")) {
    const reports = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId, managerId: ctx.userId },
      select: { id: true },
    });
    for (const user of reports) holders.add(user.id);
  }
  if (grants.some((grant) => grant.scope === "DEPARTMENT")) {
    const actor = await prisma.user.findFirst({
      where: { id: ctx.userId, organizationId: ctx.organizationId },
      select: { departmentId: true },
    });
    if (actor?.departmentId) {
      const peers = await prisma.user.findMany({
        where: { organizationId: ctx.organizationId, departmentId: actor.departmentId },
        select: { id: true },
      });
      for (const user of peers) holders.add(user.id);
    }
  }
  return [...holders];
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
  const entityIds = grants
    .filter((grant) => ["ENTITY", "MULTI_ENTITY"].includes(grant.scope))
    .map((grant) => grant.entityId)
    .filter((id): id is string => Boolean(id));
  if (rule.entityField && entityIds.length) or.push({ [rule.entityField]: { in: entityIds } });
  if (rule.ownerField && grants.some((grant) => grant.scope === "SELF")) or.push({ [rule.ownerField]: ctx.userId });
  if (rule.ownerField && grants.some((grant) => grant.scope === "DIRECT_REPORTS")) {
    const directReports = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId, managerId: ctx.userId },
      select: { id: true },
    });
    or.push({ [rule.ownerField]: { in: directReports.map((user) => user.id) } });
  }
  if (rule.ownerField && grants.some((grant) => grant.scope === "DEPARTMENT")) {
    const actor = await prisma.user.findFirst({
      where: { id: ctx.userId, organizationId: ctx.organizationId },
      select: { departmentId: true },
    });
    if (actor?.departmentId) {
      const peers = await prisma.user.findMany({
        where: { organizationId: ctx.organizationId, departmentId: actor.departmentId },
        select: { id: true },
      });
      or.push({ [rule.ownerField]: { in: peers.map((user) => user.id) } });
    }
  }
  if (rule.cardIdField && grants.some((grant) => ["SELF", "DIRECT_REPORTS", "DEPARTMENT"].includes(grant.scope))) {
    const holders = await holderIdsForGrants(ctx, grants);
    const cards = holders.length
      ? await prisma.card.findMany({
          where: { organizationId: ctx.organizationId, holderId: { in: holders } },
          select: { id: true },
        })
      : [];
    // Empty card list still scopes to zero rows (never tenant-wide).
    or.push({ [rule.cardIdField]: { in: cards.map((card) => card.id) } });
  }
  if (!or.length) {
    // Child resources (e.g. travel-bookings) have no owner/entity/card columns; handlers enforce parent ownership.
    if (grants.length && !rule.ownerField && !rule.entityField && !rule.cardIdField) return tenant;
    throw new AppError("FORBIDDEN", `No applicable scope for ${resource}`, 403);
  }
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
