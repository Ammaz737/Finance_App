import { loginSchema } from "@finance/contracts";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../database/client";
import { createResourceRouter } from "../platform/resource-router";
import { assertEntityPermission, assertResourcePermission } from "../platform/resource-access";
import { getContext } from "../platform/auth/context";
import { login } from "../platform/auth";
import { ok } from "../platform/http";
import { ingestDocument } from "../engines/documents";
import { can } from "../platform/rbac";
import { searchOrganization } from "../engines/search";
import * as actions from "../application/actions";
import { AppError } from "../platform/http";
import { assertCan } from "../platform/rbac";
import { inboxRouter } from "./inbox.routes";
import { getWorkerDiagnostics } from "../platform/queue";

export const identityRouter = Router();
identityRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input.email, input.password, input.workspace);
    return ok(res, {
      token: result.token,
      sessionId: result.sessionId,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        organizationId: result.user.organizationId,
        status: result.user.status,
      },
    });
  } catch (error) {
    next(error);
  }
});
identityRouter.post("/activate", async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(254),
      workspace: z.string().trim().min(2).max(80),
      token: z.string().min(20).max(200),
      password: z.string().min(12).max(128),
    }).strict().parse(req.body);
    return ok(res, await actions.people.activate(input));
  } catch (error) {
    next(error);
  }
});
identityRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(254),
      workspace: z.string().trim().min(2).max(80),
    }).strict().parse(req.body);
    return ok(res, await actions.credentials.forgotPassword(input));
  } catch (error) { next(error); }
});
identityRouter.post("/reset-password", async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(254),
      workspace: z.string().trim().min(2).max(80),
      token: z.string().min(20).max(200),
      password: z.string().min(12).max(128),
    }).strict().parse(req.body);
    return ok(res, await actions.credentials.resetPassword(input));
  } catch (error) { next(error); }
});
identityRouter.post("/change-password", async (req, res, next) => {
  try {
    const input = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(12).max(128),
    }).strict().parse(req.body);
    return ok(res, await actions.credentials.changePassword(getContext(req), input));
  } catch (error) { next(error); }
});
identityRouter.get("/me", async (req, res, next) => {
  try {
    const ctx = getContext(req);
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, organizationId: true,
        status: true, managerId: true, departmentId: true, locationId: true,
      },
    });
    return ok(res, { ...ctx, user });
  } catch (error) {
    next(error);
  }
});
identityRouter.get("/overview", async (req, res, next) => {
  try {
    const ctx = getContext(req);
    const [cards, openExpenses, pendingRequests, funds] = await Promise.all([
      prisma.card.count({ where: { organizationId: ctx.organizationId, holderId: ctx.userId, status: "ACTIVE" } }),
      prisma.expense.count({ where: { organizationId: ctx.organizationId, userId: ctx.userId, status: { in: ["INCOMPLETE", "IN_REVIEW", "SUBMITTED"] } } }),
      prisma.spendRequest.count({ where: { organizationId: ctx.organizationId, requesterId: ctx.userId, status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
      prisma.fund.groupBy({ by: ["currency"], where: { organizationId: ctx.organizationId, ownerId: ctx.userId }, _sum: { availableAmount: true } }),
    ]);
    return ok(res, { cards, openExpenses, pendingRequests, availableFunds: funds.map((fund) => ({ currency: fund.currency, amount: String(fund._sum.availableAmount ?? 0) })) });
  } catch (error) { next(error); }
});

const organizationRouter = Router();
organizationRouter.get("/", async (req, res, next) => {
  try {
    const ctx = getContext(req);
    const organization = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { id: true, name: true, slug: true, createdAt: true } });
    return ok(res, organization ? [organization] : []);
  } catch (error) { next(error); }
});
organizationRouter.patch("/:id", async (req, res, next) => {
  try {
    const ctx = getContext(req);
    if (!ctx.roles.includes("Owner") || req.params.id !== ctx.organizationId) throw new AppError("FORBIDDEN", "Only the organization owner can change company settings", 403);
    const input = z.object({ name: z.string().trim().min(2).max(120) }).strict().parse(req.body);
    const organization = await prisma.$transaction(async (tx) => {
      const existing = await tx.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
      const updated = await tx.organization.update({ where: { id: ctx.organizationId }, data: { name: input.name } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "organization.update", objectType: "Organization", objectId: existing.id, oldValue: { name: existing.name }, newValue: { name: updated.name }, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "organization.updated", payload: { organizationId: existing.id } } });
      return { id: updated.id, name: updated.name, slug: updated.slug };
    });
    return ok(res, organization);
  } catch (error) { next(error); }
});

async function updateOrganizationUnit(ctx: ReturnType<typeof getContext>, kind: "entity" | "department" | "location", id: string, body: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const delegate = kind === "entity" ? tx.legalEntity : kind === "department" ? tx.department : tx.location;
    const current = await (delegate as typeof tx.department).findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!current) throw new AppError("NOT_FOUND", `${kind} not found`, 404);
    const name = String(body.name ?? "").trim(); if (name.length < 2) throw new AppError("INVALID_NAME", "Name is required", 400);
    const updated = await (delegate as typeof tx.department).update({ where: { id }, data: { name } });
    await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: `${kind}.update`, objectType: kind, objectId: id, oldValue: { name: current.name }, newValue: { name }, correlationId: ctx.correlationId } });
    await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: `${kind}.updated`, payload: { id } } });
    return updated;
  });
}

async function archiveOrganizationUnit(ctx: ReturnType<typeof getContext>, kind: "entity" | "department" | "location", id: string) {
  return prisma.$transaction(async (tx) => {
    if (kind === "entity") {
      const current = await tx.legalEntity.findFirst({ where: { id, organizationId: ctx.organizationId } }); if (!current) throw new AppError("NOT_FOUND", "Entity not found", 404);
      const dependencies = await Promise.all([tx.bill.count({ where: { organizationId: ctx.organizationId, legalEntityId: id, status: { notIn: ["PAID", "CANCELLED", "REJECTED"] } } }), tx.card.count({ where: { organizationId: ctx.organizationId, legalEntityId: id, status: { in: ["ACTIVE", "FROZEN"] } } }), tx.payment.count({ where: { organizationId: ctx.organizationId, legalEntityId: id, status: { in: ["SCHEDULED", "PROCESSING", "SENT"] } } })]);
      if (dependencies.some(Boolean)) throw new AppError("ACTIVE_FINANCIAL_STATE", "Entity has active financial records and cannot be archived", 409);
      await tx.legalEntity.update({ where: { id }, data: { status: "ARCHIVED" } });
    } else if (kind === "department") { const current = await tx.department.findFirst({ where: { id, organizationId: ctx.organizationId } }); if (!current) throw new AppError("NOT_FOUND", "Department not found", 404); await tx.department.update({ where: { id }, data: { status: "ARCHIVED" } }); }
    else { const current = await tx.location.findFirst({ where: { id, organizationId: ctx.organizationId } }); if (!current) throw new AppError("NOT_FOUND", "Location not found", 404); await tx.location.update({ where: { id }, data: { status: "ARCHIVED" } }); }
    await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: `${kind}.archive`, objectType: kind, objectId: id, newValue: { status: "ARCHIVED" }, correlationId: ctx.correlationId } });
    await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: `${kind}.archived`, payload: { id } } });
    return { id, status: "ARCHIVED" };
  });
}

export const routers = {
  identity: identityRouter,
  inbox: inboxRouter,
  organizations: organizationRouter,
  entities: createResourceRouter({ getDelegate: () => prisma.legalEntity as never, searchField: "name", actions: { update: (ctx, id, body) => updateOrganizationUnit(ctx, "entity", id, body), archive: (ctx, id) => archiveOrganizationUnit(ctx, "entity", id) }, create: async (ctx, body) => {
    const input = z.object({ name: z.string().trim().min(2).max(120), country: z.string().regex(/^[A-Z]{2}$/), currency: z.string().regex(/^[A-Z]{3}$/) }).strict().parse(body);
    return prisma.$transaction(async (tx) => {
      const entity = await tx.legalEntity.create({ data: { organizationId: ctx.organizationId, ...input } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "entity.create", objectType: "LegalEntity", objectId: entity.id, newValue: input, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "entity.created", payload: { entityId: entity.id } } });
      return entity;
    });
  } }),
  departments: createResourceRouter({ getDelegate: () => prisma.department as never, searchField: "name", actions: { update: (ctx, id, body) => updateOrganizationUnit(ctx, "department", id, body), archive: (ctx, id) => archiveOrganizationUnit(ctx, "department", id) }, create: async (ctx, body) => {
    const input = z.object({ name: z.string().trim().min(2).max(120) }).strict().parse(body);
    return prisma.$transaction(async (tx) => {
      const department = await tx.department.create({ data: { organizationId: ctx.organizationId, name: input.name } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "department.create", objectType: "Department", objectId: department.id, newValue: input, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "department.created", payload: { departmentId: department.id } } });
      return department;
    });
  } }),
  locations: createResourceRouter({ getDelegate: () => prisma.location as never, searchField: "name", actions: { update: (ctx, id, body) => updateOrganizationUnit(ctx, "location", id, body), archive: (ctx, id) => archiveOrganizationUnit(ctx, "location", id) }, create: async (ctx, body) => {
    const input = z.object({ name: z.string().trim().min(2).max(120) }).strict().parse(body);
    return prisma.$transaction(async (tx) => {
      const location = await tx.location.create({ data: { organizationId: ctx.organizationId, name: input.name } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "location.create", objectType: "Location", objectId: location.id, newValue: input, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "location.created", payload: { locationId: location.id } } });
      return location;
    });
  } }),
  people: createResourceRouter({
    getDelegate: () => prisma.user as never,
    searchField: "email",
    select: { id: true, organizationId: true, email: true, firstName: true, lastName: true, status: true, managerId: true, departmentId: true, locationId: true, mfaEnabled: true, createdAt: true },
    create: (ctx, body) => {
      return actions.people.create(ctx, z.object({
        email: z.string().email().max(254), firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
        roleId: z.string().uuid(), managerId: z.string().uuid().optional().or(z.literal("")),
      }).parse(body));
    },
    get: (ctx, id) => actions.credentials.getDetail(ctx, id),
    actions: {
      publish: (ctx, id) => actions.people.publish(ctx, id),
      update: (ctx, id, body) => actions.credentials.update(ctx, id, { managerId: body.managerId ? String(body.managerId) : null, departmentId: body.departmentId ? String(body.departmentId) : null, locationId: body.locationId ? String(body.locationId) : null, legalEntityId: body.legalEntityId ? String(body.legalEntityId) : null }),
      "assign-role": (ctx, id, body) => actions.credentials.assignRole(ctx, id, { roleId: String(body.roleId ?? ""), entityId: body.entityId ? String(body.entityId) : null }),
      "remove-role": (ctx, id, body) => actions.credentials.removeRole(ctx, id, { assignmentId: String(body.assignmentId ?? "") }),
      suspend: (ctx, id) => actions.credentials.suspend(ctx, id),
      terminate: (ctx, id) => actions.people.terminate(ctx, id),
      "reset-credentials": (ctx, id) => actions.people.resetCredentials(ctx, id),
    },
  }),
  rbac: createResourceRouter({ getDelegate: () => prisma.role as never, searchField: "name", get: async (ctx, id) => {
    const role = await prisma.role.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!role) throw new AppError("NOT_FOUND", "Role not found", 404);
    const grants = await prisma.rolePermission.findMany({ where: { roleId: id } });
    const permissions = await prisma.permission.findMany({ where: { id: { in: grants.map((grant) => grant.permissionId) } } });
    const assignments = await prisma.userRole.findMany({ where: { organizationId: ctx.organizationId, roleId: id } });
    return { role, permissions: grants.map((grant) => ({ ...permissions.find((permission) => permission.id === grant.permissionId), scope: grant.scope })), entityRestrictions: [...new Set(assignments.map((assignment) => assignment.entityId).filter(Boolean))] };
  } }),
  policies: (() => {
    const parsePolicy = (body: Record<string, unknown>) => ({
      name: String(body.name ?? ""), objectType: String(body.objectType ?? ""), priority: Number(body.priority ?? 100),
      effectiveFrom: body.effectiveFrom ? String(body.effectiveFrom) : undefined, enabled: body.enabled === true || body.enabled === "true",
      rules: Array.isArray(body.rules) ? body.rules as Array<Record<string, unknown>> : [],
    });
    const router = createResourceRouter({
      getDelegate: () => prisma.policy as never, searchField: "name",
      create: (ctx, body) => actions.adminConfiguration.createPolicy(ctx, parsePolicy(body)),
      actions: {
        version: (ctx, id, body) => actions.adminConfiguration.versionPolicy(ctx, id, parsePolicy(body)),
        disable: (ctx, id) => actions.adminConfiguration.disablePolicy(ctx, id),
      },
    });
    router.post("/simulate", async (req, res, next) => {
      try {
        const ctx = getContext(req);
        assertCan(ctx, "roles.assign");
        const input = z.object({
          objectType: z.string().min(2).max(40),
          amount: z.coerce.number().nonnegative(),
          hasReceipt: z.boolean().optional(),
          hasMemo: z.boolean().optional(),
          category: z.string().optional(),
          outOfPolicy: z.boolean().optional(),
        }).strict().parse(req.body);
        const { loadPolicyRules, evaluatePolicy } = await import("../engines/policy");
        const { rules, policyNames } = await loadPolicyRules(
          (args) => prisma.policy.findMany(args as never),
          ctx.organizationId,
          input.objectType,
        );
        const evaluation = evaluatePolicy({ ...input, rules });
        return ok(res, { evaluation, policyNames, rulesApplied: rules.length });
      } catch (error) { next(error); }
    });
    return router;
  })(),
  approvals: (() => {
    const parseWorkflow = (body: Record<string, unknown>) => ({
      name: String(body.name ?? ""), objectType: String(body.objectType ?? ""),
      enabled: body.enabled === true || body.enabled === "true", effectiveFrom: body.effectiveFrom ? String(body.effectiveFrom) : undefined,
      steps: Array.isArray(body.steps) ? body.steps as Array<Record<string, unknown>> : [],
    });
    const router = createResourceRouter({
      getDelegate: () => prisma.approvalWorkflow as never, searchField: "name",
      create: (ctx, body) => actions.adminConfiguration.createWorkflow(ctx, parseWorkflow(body)),
      actions: {
        version: (ctx, id, body) => actions.adminConfiguration.versionWorkflow(ctx, id, parseWorkflow(body)),
        enable: (ctx, id) => actions.adminConfiguration.setWorkflowEnabled(ctx, id, true),
        disable: (ctx, id) => actions.adminConfiguration.setWorkflowEnabled(ctx, id, false),
      },
    });
    router.post("/preview", async (req, res, next) => {
      try {
        const ctx = getContext(req); assertCan(ctx, "roles.assign");
        const { resolveWorkflowSteps } = await import("../engines/workflow");
        const input = z.object({ steps: z.array(z.record(z.unknown())), amount: z.coerce.number().nonnegative(), departmentId: z.string().optional(), legalEntityId: z.string().optional() }).parse(req.body);
        return ok(res, { steps: resolveWorkflowSteps({ steps: input.steps, amount: input.amount, departmentId: input.departmentId, legalEntityId: input.legalEntityId }), selfApprovalProtected: true, separationOfDuties: true });
      } catch (error) { next(error); }
    });
    return router;
  })(),
  "accounting-dimensions": createResourceRouter({
    getDelegate: () => prisma.accountingDimension as never,
    create: async (ctx, body) => {
      const input = z.object({ key: z.string().trim().min(2).max(80), label: z.string().trim().min(2).max(120), values: z.array(z.object({ id: z.string().min(1).max(120), label: z.string().min(1).max(160), active: z.boolean().optional() })).min(1) }).strict().parse(body);
      return prisma.$transaction(async (tx) => {
        const dimension = await tx.accountingDimension.create({ data: { organizationId: ctx.organizationId, key: input.key, label: input.label, values: input.values, source: "LOCAL", providerSynced: false } });
        await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting_dimension.create", objectType: "AccountingDimension", objectId: dimension.id, newValue: { key: dimension.key, valueCount: input.values.length }, correlationId: ctx.correlationId } });
        await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "accounting_dimension.created", payload: { dimensionId: dimension.id } } });
        return dimension;
      });
    },
    actions: {
      update: async (ctx, id, body) => {
        const input = z.object({ label: z.string().trim().min(2).max(120), values: z.array(z.object({ id: z.string().min(1).max(120), label: z.string().min(1).max(160), active: z.boolean().optional() })).min(1) }).strict().parse(body);
        return prisma.$transaction(async (tx) => {
          const current = await tx.accountingDimension.findFirst({ where: { id, organizationId: ctx.organizationId } });
          if (!current) throw new AppError("NOT_FOUND", "Accounting dimension not found", 404);
          if (current.providerSynced) throw new AppError("PROVIDER_MANAGED", "Provider-synced dimensions cannot be edited locally", 409);
          const updated = await tx.accountingDimension.update({ where: { id }, data: { label: input.label, values: input.values } });
          await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting_dimension.update", objectType: "AccountingDimension", objectId: id, oldValue: { label: current.label, values: current.values }, newValue: { label: updated.label, values: updated.values }, correlationId: ctx.correlationId } });
          await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "accounting_dimension.updated", payload: { dimensionId: id } } });
          return updated;
        });
      },
    },
  }),
  budgets: (() => {
    const router = Router();
    router.get("/", async (req, res, next) => {
      try {
        return ok(res, await actions.budgets.list(getContext(req)));
      } catch (error) {
        next(error);
      }
    });
    router.get("/:id", async (req, res, next) => {
      try {
        return ok(res, await actions.budgets.getDetail(getContext(req), req.params.id));
      } catch (error) {
        next(error);
      }
    });
    router.post("/", async (req, res, next) => {
      try {
        const ctx = getContext(req);
        assertResourcePermission(ctx, "budget.manage");
        return ok(res, await actions.budgets.create(ctx, {
          name: String(req.body?.name ?? ""),
          legalEntityId: String(req.body?.legalEntityId),
          amount: String(req.body?.amount ?? ""),
          currency: String(req.body?.currency ?? "USD"),
          period: req.body?.period != null ? String(req.body.period) : undefined,
        }), {}, 201);
      } catch (error) {
        next(error);
      }
    });
    router.post("/:id/update", async (req, res, next) => {
      try {
        const ctx = getContext(req); assertResourcePermission(ctx, "budget.manage");
        const input = z.object({ name: z.string().trim().min(2).max(120), amount: z.coerce.number().positive(), period: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]) }).passthrough().parse(req.body);
        const budget = await prisma.budget.findFirst({ where: { id: req.params.id, organizationId: ctx.organizationId } });
        if (!budget) throw new AppError("NOT_FOUND", "Budget not found", 404);
        assertEntityPermission(ctx, "budget.manage", budget.legalEntityId);
        if (input.amount < Number(budget.actualAmount) + Number(budget.committedAmount)) throw new AppError("ACTIVE_FINANCIAL_STATE", "Budget cannot be reduced below actual plus committed spend", 409);
        const updated = await prisma.$transaction(async (tx) => { const row = await tx.budget.update({ where: { id: budget.id }, data: { name: input.name, amount: input.amount, period: input.period, freshness: new Date() } }); await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "budget.update", objectType: "Budget", objectId: budget.id, oldValue: { name: budget.name, amount: budget.amount, period: budget.period }, newValue: { name: row.name, amount: row.amount, period: row.period }, correlationId: ctx.correlationId } }); await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "budget.updated", payload: { budgetId: budget.id } } }); return row; });
        return ok(res, updated);
      } catch (error) { next(error); }
    });
    return router;
  })(),
  entitlements: createResourceRouter({ getDelegate: () => prisma.entitlement as never }),
  "country-capabilities": createResourceRouter({ getDelegate: () => prisma.countryCapability as never }),
  cards: createResourceRouter({
    getDelegate: () => prisma.card as never,
    get: (ctx, id) => actions.cards.getDetail(ctx, id),
    actions: {
      freeze: (ctx, id) => actions.cards.freeze(ctx, id),
      unfreeze: (ctx, id) => actions.cards.unfreeze(ctx, id),
      terminate: (ctx, id) => actions.cards.terminate(ctx, id),
      "set-controls": (ctx, id, body) => actions.cards.setControls(ctx, id, {
        merchantLock: body.merchantLock === null ? null : body.merchantLock != null ? String(body.merchantLock) : undefined,
        allowedMccs: body.allowedMccs === null ? null : body.allowedMccs != null ? String(body.allowedMccs) : undefined,
        perTransactionLimit: body.perTransactionLimit === null ? null : body.perTransactionLimit != null ? String(body.perTransactionLimit) : undefined,
        velocityMaxAmount: body.velocityMaxAmount === null ? null : body.velocityMaxAmount != null ? String(body.velocityMaxAmount) : undefined,
        velocityMaxCount: body.velocityMaxCount === null ? null : body.velocityMaxCount != null ? Number(body.velocityMaxCount) : undefined,
        velocityWindowHours: body.velocityWindowHours != null ? Number(body.velocityWindowHours) : undefined,
      }),
    },
  }),
  funds: createResourceRouter({
    getDelegate: () => prisma.fund as never,
    searchField: "name",
    get: (ctx, id) => actions.cards.getFundDetail(ctx, id),
  }),
  "business-limits": createResourceRouter({
    getDelegate: () => prisma.businessLimit as never,
    create: async (ctx, body) => {
      const input = z.object({
        legalEntityId: z.string().uuid(),
        amount: z.coerce.number().positive(),
        currency: z.string().length(3),
      }).parse(body);
      const entity = await prisma.legalEntity.findFirst({ where: { id: input.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity || entity.currency !== input.currency) throw new AppError("INVALID_ENTITY", "Entity or currency is unavailable", 400);
      return prisma.businessLimit.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: entity.id,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
        },
      });
    },
  }),
  "spend-programs": createResourceRouter({
    getDelegate: () => prisma.spendProgram as never, searchField: "name",
    create: async (ctx, body) => {
      const input = z.object({
        name: z.string().trim().min(2),
        legalEntityId: z.string().uuid(),
        maxAmount: z.coerce.number().positive(),
        currency: z.string().length(3),
        budgetId: z.string().uuid().optional().or(z.literal("")),
        defaultFulfillmentType: z.enum(["VIRTUAL_CARD", "FUND_ONLY"]).optional(),
        merchantLockDefault: z.string().trim().max(120).optional().or(z.literal("")),
        defaultValidDays: z.coerce.number().int().positive().max(3650).optional(),
        allowedMccsDefault: z.string().trim().max(200).optional().or(z.literal("")),
        perTransactionLimitDefault: z.coerce.number().positive().optional(),
        velocityMaxAmountDefault: z.coerce.number().positive().optional(),
        velocityMaxCountDefault: z.coerce.number().int().positive().max(10_000).optional(),
      }).parse(body);
      const entity = await prisma.legalEntity.findFirst({ where: { id: input.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity || entity.currency !== input.currency) throw new AppError("INVALID_ENTITY", "Entity or currency is unavailable", 400);
      const budget = input.budgetId ? await prisma.budget.findFirst({ where: { id: input.budgetId, organizationId: ctx.organizationId, legalEntityId: entity.id } }) : null;
      if (input.budgetId && !budget) throw new AppError("INVALID_BUDGET", "Budget is unavailable", 400);
      return prisma.spendProgram.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: entity.id,
          name: input.name,
          maxAmount: new Prisma.Decimal(input.maxAmount),
          currency: input.currency,
          budgetId: budget?.id,
          defaultFulfillmentType: input.defaultFulfillmentType ?? "VIRTUAL_CARD",
          merchantLockDefault: input.merchantLockDefault || null,
          defaultValidDays: input.defaultValidDays ?? null,
          allowedMccsDefault: input.allowedMccsDefault || null,
          perTransactionLimitDefault: input.perTransactionLimitDefault != null ? new Prisma.Decimal(input.perTransactionLimitDefault) : null,
          velocityMaxAmountDefault: input.velocityMaxAmountDefault != null ? new Prisma.Decimal(input.velocityMaxAmountDefault) : null,
          velocityMaxCountDefault: input.velocityMaxCountDefault ?? null,
        },
      });
    },
    actions: {
      update: (ctx, id, body) => actions.receipts.updateProgram(ctx, id, { name: String(body.name ?? ""), description: body.description ? String(body.description) : undefined, maxAmount: String(body.maxAmount ?? ""), currency: String(body.currency ?? "USD"), merchantLockDefault: body.merchantLockDefault ? String(body.merchantLockDefault) : undefined, allowedMccsDefault: body.allowedMccsDefault ? String(body.allowedMccsDefault) : undefined, perTransactionLimitDefault: body.perTransactionLimitDefault ? String(body.perTransactionLimitDefault) : undefined, velocityMaxAmountDefault: body.velocityMaxAmountDefault ? String(body.velocityMaxAmountDefault) : undefined, velocityMaxCountDefault: body.velocityMaxCountDefault ? Number(body.velocityMaxCountDefault) : undefined }),
      deactivate: (ctx, id) => actions.spend.deactivateProgram(ctx, id),
    },
  }),
  "spend-requests": createResourceRouter({
    getDelegate: () => prisma.spendRequest as never,
    searchField: "name",
    get: (ctx, id) => actions.spend.getRequestDetail(ctx, id),
    create: (ctx, body) =>
      actions.spend.createRequest(ctx, {
        programId: String(body.programId),
        name: String(body.name),
        amount: String(body.amount),
        currency: String(body.currency ?? "USD"),
        legalEntityId: String(body.legalEntityId),
        purpose: body.purpose != null ? String(body.purpose) : undefined,
        vendorId: body.vendorId ? String(body.vendorId) : undefined,
        fulfillmentType: body.fulfillmentType === "FUND_ONLY" || body.fulfillmentType === "VIRTUAL_CARD"
          ? body.fulfillmentType
          : undefined,
        recurrence: body.recurrence != null ? String(body.recurrence) : undefined,
        expiresAt: body.expiresAt ? String(body.expiresAt) : undefined,
        category: body.category != null ? String(body.category) : undefined,
        attachmentId: body.attachmentId ? String(body.attachmentId) : undefined,
        comments: body.comments != null ? String(body.comments) : undefined,
      }),
    actions: { approve: (ctx, id) => actions.spend.approveRequest(ctx, id) },
  }),
  authorizations: createResourceRouter({
    getDelegate: () => prisma.cardAuthorization as never,
    create: (ctx, body) => actions.cards.authorize(ctx, z.object({
      cardId: z.string().uuid(), amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
      currency: z.string().regex(/^[A-Z]{3}$/), merchant: z.string().trim().min(1).max(200),
      merchantCategory: z.string().trim().min(1).max(80), idempotencyKey: z.string().min(8).max(120),
    }).strict().parse(body)),
  }),
  transactions: createResourceRouter({
    getDelegate: () => prisma.txn as never,
    searchField: "merchant",
    actions: {
      clear: (ctx, id) => actions.cards.clear(ctx, id),
      capture: (ctx, id, body) => actions.cards.capture(ctx, id, {
        amount: body.amount != null ? String(body.amount) : undefined,
      }),
      void: (ctx, id) => actions.cards.void(ctx, id),
      reverse: (ctx, id) => actions.cards.reverse(ctx, id),
    },
  }),
  disputes: createResourceRouter({
    getDelegate: () => prisma.disputeCase as never,
    create: (ctx, body) => actions.specialist.openDispute(ctx, String(body.transactionId), String(body.reason)),
  }),
  repayments: createResourceRouter({ getDelegate: () => prisma.repayment as never }),
  expenses: createResourceRouter({
    getDelegate: () => prisma.expense as never,
    get: (ctx, id) => actions.expenses.getDetail(ctx, id),
    actions: {
      submit: (ctx, id) => actions.expenses.submit(ctx, id),
      approve: (ctx, id) => actions.expenses.approve(ctx, id),
      split: (ctx, id, body) => actions.expenses.split(ctx, id, (body.splits as never) ?? []),
      "update-memo": (ctx, id, body) => actions.expenses.updateMemo(ctx, id, { memo: String(body.memo ?? "") }),
    },
  }),
  receipts: createResourceRouter({
    getDelegate: () => prisma.receipt as never,
    get: (ctx, id, query) => actions.receipts.getLinkCandidates(ctx, id, typeof query.q === "string" ? query.q : ""),
    create: (ctx, body) => actions.receipts.createFromAttachment(ctx, z.object({
      attachmentId: z.string().uuid(),
      expenseId: z.string().uuid().optional(),
      transactionId: z.string().uuid().optional(),
    }).strict().parse(body)),
    actions: {
      link: (ctx, id, body) => actions.receipts.link(ctx, id, {
        expenseId: body.expenseId ? String(body.expenseId) : undefined,
        transactionId: body.transactionId ? String(body.transactionId) : undefined,
      }),
    },
  }),
  reimbursements: createResourceRouter({
    getDelegate: () => prisma.reimbursement as never,
    get: (ctx, id) => actions.reimbursements.getDetail(ctx, id),
    create: (ctx, body) => actions.reimbursements.create(ctx, z.object({
      legalEntityId: z.string().uuid(),
      type: z.enum(["STANDARD", "MILEAGE", "PER_DIEM"]),
      currency: z.string().length(3),
      memo: z.string().trim().min(2).max(500),
      amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
      merchant: z.string().trim().max(200).optional(),
      category: z.string().trim().max(120).optional(),
      expenseDate: z.string().optional(),
      destination: z.string().trim().max(200).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      eligibleDays: z.coerce.number().int().positive().max(365).optional(),
      department: z.string().trim().max(120).optional(),
      project: z.string().trim().max(120).optional(),
      paymentDestination: z.string().trim().max(200).optional(),
      receiptId: z.string().uuid().optional(),
      attachmentId: z.string().uuid().optional(),
      distanceMiles: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
      mileageRate: z.string().regex(/^\d+(?:\.\d{1,4})?$/).optional(),
      perDiemNights: z.coerce.number().int().positive().max(365).optional(),
      perDiemRate: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
    }).strict().parse(body)),
    actions: {
      submit: (ctx, id) => actions.reimbursements.submit(ctx, id),
      approve: (ctx, id) => actions.reimbursements.approve(ctx, id),
      schedule: (ctx, id, body) => actions.reimbursements.schedule(ctx, id, {
        rail: body.rail != null ? String(body.rail) : undefined,
        idempotencyKey: body.idempotencyKey != null ? String(body.idempotencyKey) : undefined,
      }),
      "confirm-payout": (ctx, id) => actions.reimbursements.confirmPayout(ctx, id),
      "fail-payout": (ctx, id, body) => actions.reimbursements.failPayout(ctx, id, {
        reason: body.reason != null ? String(body.reason) : undefined,
      }),
      "mark-returned": (ctx, id, body) => actions.reimbursements.markReturned(ctx, id, {
        reason: body.reason != null ? String(body.reason) : undefined,
      }),
    },
  }),
  procurement: createResourceRouter({
    getDelegate: () => prisma.purchaseRequest as never,
    searchField: "name",
    create: (ctx, body) => actions.procurement.create(ctx, {
      name: String(body.name ?? ""),
      legalEntityId: String(body.legalEntityId),
      programId: String(body.programId),
      amount: String(body.amount),
      currency: String(body.currency ?? "USD"),
      outcomeType: body.outcomeType as "PURCHASE_ORDER" | "VIRTUAL_CARD" | "VENDOR_SETUP" | undefined,
      vendorId: body.vendorId != null ? String(body.vendorId) : undefined,
      proposedVendorName: body.proposedVendorName != null ? String(body.proposedVendorName) : undefined,
      departmentId: body.departmentId != null ? String(body.departmentId) : undefined,
      category: body.category != null ? String(body.category) : undefined,
      frequency: body.frequency != null ? String(body.frequency) : undefined,
      desiredDate: body.desiredDate != null ? String(body.desiredDate) : undefined,
      attachmentId: body.attachmentId != null ? String(body.attachmentId) : undefined,
      contractId: body.contractId != null ? String(body.contractId) : undefined,
      memo: body.memo != null ? String(body.memo) : undefined,
      formAnswers: body.formAnswers && typeof body.formAnswers === "object"
        ? body.formAnswers as Record<string, unknown>
        : undefined,
      lines: Array.isArray(body.lines)
        ? body.lines.map((line) => {
            const row = line as Record<string, unknown>;
            return {
              description: String(row.description ?? ""),
              quantity: row.quantity as string | number | undefined,
              unitAmount: row.unitAmount as string | number | undefined,
              amount: row.amount as string | number | undefined,
              category: row.category != null ? String(row.category) : undefined,
            };
          })
        : undefined,
    }),
    get: (ctx, id) => actions.procurement.getRequestDetail(ctx, id),
    actions: {
      submit: (ctx, id) => actions.procurement.submit(ctx, id),
      approve: (ctx, id) => actions.procurement.approve(ctx, id),
    },
  }),
  "procurement-programs": createResourceRouter({
    getDelegate: () => prisma.procurementProgram as never, searchField: "name",
    create: async (ctx, body) => {
      const input = z.object({
        name: z.string().trim().min(2),
        description: z.string().optional(),
        defaultOutcomeType: z.enum(["PURCHASE_ORDER", "VIRTUAL_CARD", "VENDOR_SETUP"]).optional(),
        matchTolerancePct: z.number().optional(),
        requireReceiving: z.boolean().optional(),
        workflowId: z.string().uuid().optional(),
        budgetId: z.string().uuid().optional(),
        legalEntityId: z.string().uuid().optional(),
      }).parse(body);
      return prisma.procurementProgram.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description ?? "",
          defaultOutcomeType: input.defaultOutcomeType ?? "PURCHASE_ORDER",
          matchTolerancePct: input.matchTolerancePct ?? 0.01,
          requireReceiving: input.requireReceiving ?? true,
          workflowId: input.workflowId ?? null,
          budgetId: input.budgetId ?? null,
          legalEntityId: input.legalEntityId ?? null,
        },
      });
    },
  }),
  "purchase-orders": createResourceRouter({
    getDelegate: () => prisma.purchaseOrder as never,
    get: (ctx, id) => actions.procurement.getPoDetail(ctx, id),
    actions: {
      receive: (ctx, id, body) => actions.procurement.receive(ctx, id, {
        amount: body.amount != null ? String(body.amount) : undefined,
        quantity: body.quantity != null ? String(body.quantity) : undefined,
        purchaseOrderLineId: body.purchaseOrderLineId != null ? String(body.purchaseOrderLineId) : undefined,
        receiptType: body.receiptType as "AMOUNT" | "QUANTITY" | "SERVICE" | undefined,
        memo: body.memo != null ? String(body.memo) : undefined,
        idempotencyKey: body.idempotencyKey != null ? String(body.idempotencyKey) : undefined,
        allowOverride: body.allowOverride === true || body.allowOverride === "true",
      }),
      match: (ctx, id, body) => actions.procurement.match(ctx, id, {
        billId: String(body.billId),
        invoicedQuantity: body.invoicedQuantity != null ? String(body.invoicedQuantity) : undefined,
      }),
      "request-change": (ctx, id, body) => actions.procurement.requestChangeOrder(ctx, id, {
        reason: String(body.reason ?? ""),
        amount: body.amount != null ? String(body.amount) : undefined,
        description: body.description != null ? String(body.description) : undefined,
        expectedDelivery: body.expectedDelivery != null ? String(body.expectedDelivery) : undefined,
      }),
    },
  }),
  receiving: createResourceRouter({
    getDelegate: () => prisma.receivingRecord as never,
    create: (ctx, body) => actions.procurement.receive(ctx, String(body.purchaseOrderId), {
      amount: body.amount != null ? String(body.amount) : undefined,
      quantity: body.quantity != null ? String(body.quantity) : undefined,
      receiptType: body.receiptType as "AMOUNT" | "QUANTITY" | "SERVICE" | undefined,
      memo: body.memo != null ? String(body.memo) : undefined,
      idempotencyKey: body.idempotencyKey != null ? String(body.idempotencyKey) : undefined,
    }),
  }),
  matches: createResourceRouter({
    getDelegate: () => prisma.matchRecord as never,
    actions: {
      resolve: (ctx, id, body) => actions.procurement.resolveException(ctx, id, {
        resolution: String(body.resolution ?? "RESOLVED") as "APPROVED_OVERRIDE" | "CORRECTED" | "REJECTED" | "RESOLVED" | "REQUESTED_RECEIVING_UPDATE" | "REQUESTED_CORRECTED_INVOICE" | "COMMENTED",
        note: body.note != null ? String(body.note) : undefined,
      }),
    },
  }),
  "po-change-orders": createResourceRouter({
    getDelegate: () => prisma.poChangeOrder as never,
    actions: {
      approve: (ctx, id) => actions.procurement.approveChangeOrder(ctx, id),
    },
  }),
  vendors: createResourceRouter({
    getDelegate: () => prisma.vendor as never,
    searchField: "name",
    create: (ctx, body) => actions.vendors.create(ctx, {
      name: String(body.name ?? ""),
      legalName: body.legalName != null ? String(body.legalName) : undefined,
      displayName: body.displayName != null ? String(body.displayName) : undefined,
      category: body.category != null ? String(body.category) : undefined,
      legalEntityId: String(body.legalEntityId),
      taxId: body.taxId != null ? String(body.taxId) : undefined,
      riskLevel: body.riskLevel != null ? String(body.riskLevel) : undefined,
      notes: body.notes != null ? String(body.notes) : undefined,
    }),
    get: (ctx, id) => actions.vendors.getDetail(ctx, id),
    actions: {
      update: (ctx, id, body) => actions.paymentRuns.update(ctx, id, { name: String(body.name ?? ""), legalName: body.legalName ? String(body.legalName) : undefined, displayName: body.displayName ? String(body.displayName) : undefined, category: body.category ? String(body.category) : undefined, riskLevel: body.riskLevel ? String(body.riskLevel) : undefined, notes: body.notes ? String(body.notes) : undefined, ownerId: body.ownerId ? String(body.ownerId) : null }),
      deactivate: (ctx, id) => actions.paymentRuns.deactivate(ctx, id),
      "set-bank": (ctx, id, body) => actions.vendors.setBankAccount(ctx, id, {
        last4: String(body.last4 ?? ""),
        routingMasked: String(body.routingMasked ?? ""),
        changeReason: body.changeReason != null ? String(body.changeReason) : undefined,
        paymentMethod: body.paymentMethod != null ? String(body.paymentMethod) : undefined,
        beneficiaryName: body.beneficiaryName != null ? String(body.beneficiaryName) : undefined,
        currency: body.currency != null ? String(body.currency) : undefined,
        country: body.country != null ? String(body.country) : undefined,
      }),
      "verify-bank": (ctx, id, body) => actions.vendors.verifyBankAccount(ctx, id, String(body.bankAccountId ?? "")),
    },
  }),
  contracts: createResourceRouter({ getDelegate: () => prisma.contract as never, searchField: "name" }),
  renewals: createResourceRouter({ getDelegate: () => prisma.renewal as never }),
  sourcing: createResourceRouter({ getDelegate: () => prisma.vendor as never, searchField: "name" }),
  "price-intelligence": createResourceRouter({ getDelegate: () => prisma.vendor as never, searchField: "name" }),
  "license-intelligence": createResourceRouter({ getDelegate: () => prisma.vendor as never, searchField: "name" }),
  bills: createResourceRouter({
    getDelegate: () => prisma.bill as never,
    create: (ctx, body) =>
      body.attachmentId && body.fromDocument
        ? actions.bills.createFromDocument(ctx, {
            attachmentId: String(body.attachmentId),
            legalEntityId: String(body.legalEntityId),
            vendorId: body.vendorId != null ? String(body.vendorId) : undefined,
            draft: body.draft === true || body.draft === "true",
            allowPossibleDuplicate: body.allowPossibleDuplicate === true || body.allowPossibleDuplicate === "true",
          })
        : actions.bills.create(ctx, {
        vendorId: body.vendorId != null ? String(body.vendorId) : undefined,
        vendorName: body.vendorName != null ? String(body.vendorName) : undefined,
        legalEntityId: String(body.legalEntityId),
        invoiceNumber: String(body.invoiceNumber),
        amount: String(body.amount),
        currency: String(body.currency ?? "USD"),
        dueDate: body.dueDate != null ? String(body.dueDate) : undefined,
        invoiceDate: body.invoiceDate != null ? String(body.invoiceDate) : undefined,
        memo: body.memo != null ? String(body.memo) : undefined,
        attachmentId: body.attachmentId != null ? String(body.attachmentId) : undefined,
        purchaseOrderId: body.purchaseOrderId != null ? String(body.purchaseOrderId) : undefined,
        taxAmount: body.taxAmount != null ? String(body.taxAmount) : undefined,
        subtotal: body.subtotal != null ? String(body.subtotal) : undefined,
        departmentId: body.departmentId != null ? String(body.departmentId) : undefined,
        businessOwnerId: body.businessOwnerId != null ? String(body.businessOwnerId) : undefined,
        paymentMethod: body.paymentMethod != null ? String(body.paymentMethod) : undefined,
        draft: body.draft === true || body.draft === "true",
        allowPossibleDuplicate: body.allowPossibleDuplicate === true || body.allowPossibleDuplicate === "true",
        lines: Array.isArray(body.lines)
          ? body.lines.map((line) => {
              const row = line as Record<string, unknown>;
              return {
                description: String(row.description ?? ""),
                amount: String(row.amount ?? ""),
                quantity: row.quantity != null ? String(row.quantity) : undefined,
                unitPrice: row.unitPrice != null ? String(row.unitPrice) : undefined,
                taxAmount: row.taxAmount != null ? String(row.taxAmount) : undefined,
                category: row.category != null ? String(row.category) : undefined,
                glAccount: row.glAccount != null ? String(row.glAccount) : undefined,
                department: row.department != null ? String(row.department) : undefined,
                location: row.location != null ? String(row.location) : undefined,
                project: row.project != null ? String(row.project) : undefined,
              };
            })
          : undefined,
      }),
    get: (ctx, id) => actions.bills.getDetail(ctx, id),
    actions: {
      submit: (ctx, id) => actions.bills.submit(ctx, id),
      approve: (ctx, id) => actions.bills.approve(ctx, id),
      cancel: (ctx, id) => actions.paymentRuns.cancelBill(ctx, id),
      "edit-draft": (ctx, id, body) => actions.paymentRuns.editDraft(ctx, id, {
        vendorId: String(body.vendorId ?? ""), legalEntityId: String(body.legalEntityId ?? ""),
        invoiceNumber: String(body.invoiceNumber ?? ""), invoiceDate: body.invoiceDate ? String(body.invoiceDate) : undefined,
        dueDate: body.dueDate ? String(body.dueDate) : undefined, currency: String(body.currency ?? "USD"),
        memo: body.memo ? String(body.memo) : undefined, attachmentId: body.attachmentId ? String(body.attachmentId) : undefined,
        departmentId: body.departmentId ? String(body.departmentId) : undefined,
        lines: Array.isArray(body.lines) ? body.lines.map((line) => {
          const row = line as Record<string, unknown>;
          return { description: String(row.description ?? ""), quantity: String(row.quantity ?? "1"), unitPrice: String(row.unitPrice ?? "0"), taxAmount: row.taxAmount != null ? String(row.taxAmount) : undefined, category: row.category != null ? String(row.category) : undefined, glAccount: row.glAccount != null ? String(row.glAccount) : undefined, department: row.department != null ? String(row.department) : undefined, location: row.location != null ? String(row.location) : undefined, project: row.project != null ? String(row.project) : undefined };
        }) : [],
      }),
      "update-coding": (ctx, id, body) => actions.bills.updateCoding(ctx, id, {
        codingSource: body.codingSource != null ? String(body.codingSource) : undefined,
        lines: Array.isArray(body.lines)
          ? body.lines.map((line) => {
              const row = line as Record<string, unknown>;
              return {
                id: row.id != null ? String(row.id) : undefined,
                description: String(row.description ?? ""),
                amount: String(row.amount ?? ""),
                category: row.category != null ? String(row.category) : undefined,
                glAccount: row.glAccount != null ? String(row.glAccount) : undefined,
                department: row.department != null ? String(row.department) : undefined,
                location: row.location != null ? String(row.location) : undefined,
                project: row.project != null ? String(row.project) : undefined,
              };
            })
          : undefined,
      }),
    },
  }),
  payments: createResourceRouter({
    getDelegate: () => prisma.payment as never,
    create: (ctx, body) =>
      actions.payments.schedule(ctx, z.object({
        billId: z.string().uuid(), amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
        rail: z.enum(["ACH", "WIRE", "CHECK"]).optional(),
        idempotencyKey: z.string().regex(/^[\w.-]{8,120}$/),
        paymentRunId: z.string().uuid().optional(),
      }).strict().parse(body)),
    get: (ctx, id) => actions.payments.getDetail(ctx, id),
    actions: {
      release: (ctx, id) => actions.payments.release(ctx, id),
      cancel: (ctx, id) => actions.paymentRuns.cancelPayment(ctx, id),
      "confirm-settlement": (ctx, id) => actions.payments.confirmSettlement(ctx, id),
    },
  }),
  "payment-runs": createResourceRouter({
    getDelegate: () => prisma.paymentRun as never,
    create: (ctx, body) => actions.paymentRuns.create(ctx, {
      legalEntityId: String(body.legalEntityId),
      name: String(body.name ?? ""),
      sourceAccountId: body.sourceAccountId ? String(body.sourceAccountId) : undefined,
    }),
    get: (ctx, id) => actions.paymentRuns.getDetail(ctx, id),
    actions: {
      release: (ctx, id) => actions.paymentRuns.release(ctx, id),
      "add-payments": (ctx, id, body) => actions.paymentRuns.addPayments(ctx, id, {
        paymentIds: Array.isArray(body.paymentIds) ? body.paymentIds.map(String) : [],
      }),
      "remove-payments": (ctx, id, body) => actions.paymentRuns.removePayments(ctx, id, {
        paymentIds: Array.isArray(body.paymentIds) ? body.paymentIds.map(String) : [],
      }),
    },
  }),
  travel: createResourceRouter({
    getDelegate: () => prisma.travelTrip as never,
    searchField: "name",
    create: (ctx, body) => actions.travel.createTrip(ctx, {
      name: String(body.name ?? ""),
      legalEntityId: String(body.legalEntityId),
      travelerId: body.travelerId != null ? String(body.travelerId) : undefined,
      destination: String(body.destination ?? ""),
      origin: body.origin != null ? String(body.origin) : undefined,
      purpose: body.purpose != null ? String(body.purpose) : undefined,
      department: body.department != null ? String(body.department) : undefined,
      international: body.international === true || body.international === "true",
      startDate: String(body.startDate ?? ""),
      endDate: String(body.endDate ?? ""),
      estimatedAmount: String(body.estimatedAmount ?? body.amount ?? ""),
      currency: body.currency != null ? String(body.currency) : undefined,
      repriceTolerance: body.repriceTolerance != null ? String(body.repriceTolerance) : undefined,
    }),
    get: (ctx, id) => actions.travel.getDetail(ctx, id),
    actions: {
      search: (ctx, id, body) => actions.travel.search(ctx, id, {
        type: String(body.type ?? "FLIGHT").toUpperCase() as "FLIGHT" | "HOTEL" | "CAR",
        origin: body.origin != null ? String(body.origin) : undefined,
        cabin: body.cabin != null ? String(body.cabin) : undefined,
      }),
      "select-quote": (ctx, id, body) => actions.travel.selectQuote(ctx, id, {
        quoteId: String(body.quoteId ?? ""),
        type: String(body.type ?? "FLIGHT").toUpperCase() as "FLIGHT" | "HOTEL" | "CAR",
        supplier: String(body.supplier ?? ""),
        description: body.description != null ? String(body.description) : undefined,
        amount: String(body.amount ?? ""),
        currency: String(body.currency ?? "USD"),
        outOfPolicy: body.outOfPolicy === true || body.outOfPolicy === "true",
        policyResult: body.policyResult != null ? String(body.policyResult) : undefined,
        refundable: body.refundable === undefined ? undefined : body.refundable === true || body.refundable === "true",
        cancellationTerms: body.cancellationTerms != null ? String(body.cancellationTerms) : undefined,
        offerExpiry: body.offerExpiry != null ? String(body.offerExpiry) : undefined,
        provider: body.provider != null ? String(body.provider) : undefined,
        providerOfferId: body.providerOfferId != null ? String(body.providerOfferId) : undefined,
        itinerary: body.itinerary && typeof body.itinerary === "object" ? body.itinerary as Record<string, unknown> : undefined,
        startsAt: body.startsAt != null ? String(body.startsAt) : undefined,
        endsAt: body.endsAt != null ? String(body.endsAt) : undefined,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata as Record<string, unknown> : undefined,
      }),
      submit: (ctx, id) => actions.travel.submit(ctx, id),
      approve: (ctx, id) => actions.travel.approve(ctx, id),
      "link-fund": (ctx, id, body) => actions.travel.linkFund(ctx, id, String(body.fundId)),
      "link-expense": (ctx, id, body) => actions.travel.linkExpense(ctx, id, String(body.expenseId)),
      provision: (ctx, id) => actions.travel.provisionFundCard(ctx, id),
      "import-booking": (ctx, id, body) => actions.travel.importBooking(ctx, id, {
        type: String(body.type ?? "FLIGHT").toUpperCase() as "FLIGHT" | "HOTEL" | "CAR",
        supplier: String(body.supplier ?? "External"),
        amount: String(body.amount ?? ""),
        currency: String(body.currency ?? "USD"),
        confirmationNumber: body.confirmationNumber != null ? String(body.confirmationNumber) : undefined,
        description: body.description != null ? String(body.description) : undefined,
      }),
    },
  }),
  "travel-bookings": createResourceRouter({
    getDelegate: () => prisma.travelBooking as never,
    actions: {
      "book-mock": (ctx, id, body) => actions.travel.bookMock(ctx, id, {
        idempotencyKey: body.idempotencyKey != null ? String(body.idempotencyKey) : undefined,
        skipReprice: body.skipReprice === true || body.skipReprice === "true",
      }),
      reprice: (ctx, id, body) => actions.travel.reprice(ctx, id, {
        forceHigh: body.forceHigh === true || body.forceHigh === "true",
      }),
      confirm: (ctx, id) => actions.travel.confirmBooking(ctx, id),
      cancel: (ctx, id) => actions.travel.cancelBooking(ctx, id),
      refund: (ctx, id) => actions.travel.refundBooking(ctx, id),
    },
  }),
  banking: createResourceRouter({ getDelegate: () => prisma.bankAccount as never, searchField: "name" }),
  treasury: createResourceRouter({
    getDelegate: () => prisma.bankTransfer as never,
    create: (ctx, body) =>
      actions.treasury.createTransfer(ctx, {
        fromAccountId: String(body.fromAccountId),
        toAccountId: String(body.toAccountId),
        amount: String(body.amount),
        currency: String(body.currency ?? "USD"),
      }),
    actions: {
      approve: (ctx, id) => actions.treasury.approve(ctx, id),
      release: (ctx, id) => actions.treasury.release(ctx, id),
      "confirm-settlement": (ctx, id) => actions.treasury.confirmSettlement(ctx, id),
    },
  }),
  accounting: createResourceRouter({
    getDelegate: () => prisma.accountingEntry as never,
    get: (ctx, id) => actions.accounting.getDetail(ctx, id),
    actions: {
      code: (ctx, id, body) => actions.accounting.code(ctx, id, z.object({
        category: z.string().max(120).optional(),
        memo: z.string().max(500).optional(),
        coding: z.record(z.string().max(120)).optional(),
      }).strict().parse(body)),
      ready: (ctx, id) => actions.accounting.markReady(ctx, id),
      "undo-ready": (ctx, id) => actions.accounting.undoReady(ctx, id),
      retry: (ctx, id) => actions.accounting.retry(ctx, id),
      sync: async (ctx, id) => {
        const result = await actions.accounting.sync(ctx, [id]);
        if (process.env.NODE_ENV !== "production") {
          const confirmed = await actions.accounting.confirmSync(ctx, result.job.id);
          return { ...result, confirmed };
        }
        return result;
      },
      "confirm-sync": (ctx, id) => actions.accounting.confirmSync(ctx, id),
    },
  }),
  "accounting-rules": createResourceRouter({
    getDelegate: () => prisma.accountingRule as never,
    searchField: "name",
    create: (ctx, body) => actions.accounting.createRule(ctx, {
      name: String(body.name ?? ""),
      match: body.match && typeof body.match === "object" ? body.match as Record<string, unknown> : {
        ...(body.sourceType ? { sourceType: String(body.sourceType) } : {}),
        ...(body.memoContains ? { memoContains: String(body.memoContains) } : {}),
      },
      coding: {
        ...(body.category ? { category: String(body.category) } : {}),
        coding: Object.fromEntries(
          [["glAccount", body.glAccount], ["department", body.department]]
            .filter(([, value]) => value != null && String(value).trim())
            .map(([key, value]) => [String(key), String(value)]),
        ),
      },
      priority: body.priority != null ? Number(body.priority) : undefined,
    }),
  }),
  reconciliation: createResourceRouter({ getDelegate: () => prisma.accountingEntry as never }),
  "erp-sync": createResourceRouter({
    getDelegate: () => prisma.syncJob as never,
    create: async (ctx, body) => {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : undefined;
      const result = await actions.accounting.sync(ctx, ids);
      if (process.env.NODE_ENV !== "production") {
        const confirmed = await actions.accounting.confirmSync(ctx, result.job.id);
        return { ...result, confirmed };
      }
      return result;
    },
  }),
  customers: createResourceRouter({ getDelegate: () => prisma.customer as never, searchField: "name" }),
  invoices: createResourceRouter({ getDelegate: () => prisma.invoice as never }),
  "incoming-payments": createResourceRouter({ getDelegate: () => prisma.incomingPayment as never }),
  collections: createResourceRouter({ getDelegate: () => prisma.invoice as never }),
  "cash-application": createResourceRouter({
    getDelegate: () => prisma.cashApplication as never,
    create: (ctx, body) =>
      actions.receivables.applyCash(ctx, String(body.incomingPaymentId), String(body.invoiceId), String(body.amount)),
  }),
  rewards: createResourceRouter({ getDelegate: () => prisma.rewardLedger as never }),
  "tax-operations": createResourceRouter({ getDelegate: () => prisma.taxForm as never }),
  "ai-token-spend": createResourceRouter({ getDelegate: () => prisma.aiUsageRecord as never }),
  router: createResourceRouter({
    getDelegate: () => prisma.routerLog as never,
    create: (ctx, body) => actions.specialist.routeModel(ctx, String(body.model ?? "gpt-4.1")),
  }),
  "agent-finance": createResourceRouter({ getDelegate: () => prisma.agentIdentity as never, searchField: "name" }),
  sheets: createResourceRouter({ getDelegate: () => prisma.workbook as never, searchField: "name" }),
  reporting: (() => {
    const router = Router();
    router.get("/", async (req, res, next) => {
      try {
        const ctx = getContext(req);
        assertCan(ctx, "report.read");
        return ok(res, await actions.reporting.dashboard(ctx));
      } catch (error) {
        next(error);
      }
    });
    return router;
  })(),
  search: (() => {
    const router = Router();
    router.get("/", async (req, res, next) => {
      try {
        const ctx = getContext(req);
        return ok(res, await searchOrganization(ctx, String(req.query.q ?? "")));
      } catch (error) {
        next(error);
      }
    });
    return router;
  })(),
  documents: (() => {
    const router = createResourceRouter({ getDelegate: () => prisma.attachment as never });
    router.post("/upload", async (req, res, next) => {
      try {
        const ctx = getContext(req);
        const input = z.object({
          name: z.string().min(1).max(255),
          mimeType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
          classification: z.enum(["RECEIPT", "INVOICE", "VENDOR_DOCUMENT"]),
          contentBase64: z.string().min(4).max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
        }).strict().parse(req.body);
        const permissions = input.classification === "RECEIPT" ? ["expense.create", "reimbursement.create"]
          : input.classification === "INVOICE" ? ["bill.create"] : ["vendor.create"];
        if (!permissions.some((permission) => can(ctx, permission))) throw new AppError("FORBIDDEN", "You cannot upload this document type", 403);
        const buffer = Buffer.from(input.contentBase64, "base64");
        return ok(res, await ingestDocument(ctx, buffer, input), {}, 201);
      } catch (error) {
        next(error);
      }
    });
    return router;
  })(),
  notifications: (() => {
    const router = Router();
    router.get("/", async (req, res, next) => {
      try {
        return ok(res, await actions.notifications.listMine(getContext(req)));
      } catch (error) {
        next(error);
      }
    });
    router.post("/mark-all-read", async (req, res, next) => {
      try {
        return ok(res, await actions.notifications.markAllRead(getContext(req)));
      } catch (error) {
        next(error);
      }
    });
    router.post("/:id/mark-read", async (req, res, next) => {
      try {
        return ok(res, await actions.notifications.markRead(getContext(req), req.params.id));
      } catch (error) {
        next(error);
      }
    });
    return router;
  })(),
  integrations: (() => {
    const router = Router();
    router.get("/", async (req, res, next) => {
      try {
        const ctx = getContext(req);
        if (!ctx.roles.includes("Owner") && !ctx.permissions.includes("*")
          && !ctx.permissions.includes("report.read") && !ctx.permissions.includes("accounting.read") && !ctx.permissions.includes("accounting.sync")) {
          throw new AppError("FORBIDDEN", "Missing access to integrations", 403);
        }
        return ok(res, await actions.integrations.listHealth(ctx));
      } catch (error) {
        next(error);
      }
    });
    router.post("/:id/ping", async (req, res, next) => {
      try {
        const ctx = getContext(req);
        assertResourcePermission(ctx, "accounting.sync");
        return ok(res, await actions.integrations.ping(ctx, req.params.id));
      } catch (error) {
        next(error);
      }
    });
    return router;
  })(),
  operations: (() => {
    const router = Router();
    router.get("/worker-health", async (req, res, next) => {
      try {
        const ctx = getContext(req);
        if (!ctx.roles.includes("Owner") && !ctx.permissions.includes("*") && !ctx.permissions.includes("audit.read")) {
          throw new AppError("FORBIDDEN", "Worker diagnostics require audit access", 403);
        }
        return ok(res, await getWorkerDiagnostics());
      } catch (error) {
        next(error);
      }
    });
    return router;
  })(),
  "saved-views": (() => {
    const router = Router();
    router.get("/", async (req, res, next) => {
      try {
        const resource = typeof req.query.resource === "string" ? req.query.resource : undefined;
        return ok(res, await actions.savedViews.list(getContext(req), resource));
      } catch (error) {
        next(error);
      }
    });
    router.post("/", async (req, res, next) => {
      try {
        return ok(res, await actions.savedViews.create(getContext(req), {
          resource: String(req.body?.resource ?? ""),
          name: String(req.body?.name ?? ""),
          filters: req.body?.filters && typeof req.body.filters === "object" ? req.body.filters as Record<string, unknown> : undefined,
          columns: Array.isArray(req.body?.columns) ? req.body.columns.map(String) : undefined,
        }), {}, 201);
      } catch (error) {
        next(error);
      }
    });
    router.post("/:id/delete", async (req, res, next) => {
      try {
        return ok(res, await actions.savedViews.remove(getContext(req), req.params.id));
      } catch (error) {
        next(error);
      }
    });
    return router;
  })(),
  "developer-platform": createResourceRouter({ getDelegate: () => prisma.oAuthApp as never, searchField: "name" }),
  audit: createResourceRouter({ getDelegate: () => prisma.auditEvent as never, select: { id: true, organizationId: true, actorId: true, actorType: true, action: true, objectType: true, objectId: true, correlationId: true, createdAt: true } }),
  ai: createResourceRouter({ getDelegate: () => prisma.aiRecommendation as never }),
};

export type ModuleName = keyof typeof routers;
