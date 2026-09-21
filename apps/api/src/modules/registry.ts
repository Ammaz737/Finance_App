import { loginSchema } from "@finance/contracts";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../database/client";
import { createResourceRouter } from "../platform/resource-router";
import { assertResourcePermission } from "../platform/resource-access";
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

export const routers = {
  identity: identityRouter,
  inbox: inboxRouter,
  organizations: organizationRouter,
  entities: createResourceRouter({ getDelegate: () => prisma.legalEntity as never, searchField: "name", create: async (ctx, body) => {
    const input = z.object({ name: z.string().trim().min(2).max(120), country: z.string().regex(/^[A-Z]{2}$/), currency: z.string().regex(/^[A-Z]{3}$/) }).strict().parse(body);
    return prisma.$transaction(async (tx) => {
      const entity = await tx.legalEntity.create({ data: { organizationId: ctx.organizationId, ...input } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "entity.create", objectType: "LegalEntity", objectId: entity.id, newValue: input, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "entity.created", payload: { entityId: entity.id } } });
      return entity;
    });
  } }),
  departments: createResourceRouter({ getDelegate: () => prisma.department as never, searchField: "name", create: async (ctx, body) => {
    const input = z.object({ name: z.string().trim().min(2).max(120) }).strict().parse(body);
    return prisma.$transaction(async (tx) => {
      const department = await tx.department.create({ data: { organizationId: ctx.organizationId, name: input.name } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "department.create", objectType: "Department", objectId: department.id, newValue: input, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "department.created", payload: { departmentId: department.id } } });
      return department;
    });
  } }),
  locations: createResourceRouter({ getDelegate: () => prisma.location as never, searchField: "name", create: async (ctx, body) => {
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
      assertResourcePermission(ctx, "roles.assign");
      return actions.people.create(ctx, z.object({
        email: z.string().email().max(254), firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
        roleId: z.string().uuid(), managerId: z.string().uuid().optional().or(z.literal("")),
      }).parse(body));
    },
    actions: {
      publish: (ctx, id) => actions.people.publish(ctx, id),
      terminate: (ctx, id) => actions.people.terminate(ctx, id),
      "reset-credentials": (ctx, id) => actions.people.resetCredentials(ctx, id),
    },
  }),
  rbac: createResourceRouter({ getDelegate: () => prisma.role as never, searchField: "name" }),
  policies: (() => {
    const router = createResourceRouter({ getDelegate: () => prisma.policy as never, searchField: "name" });
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
  approvals: createResourceRouter({ getDelegate: () => prisma.approvalWorkflow as never, searchField: "name" }),
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
      receiptId: z.string().uuid().optional(),
      attachmentId: z.string().uuid().optional(),
      distanceMiles: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
      mileageRate: z.string().regex(/^\d+(?:\.\d{1,4})?$/).optional(),
      perDiemNights: z.coerce.number().int().positive().max(365).optional(),
      perDiemRate: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
    }).strict().parse(body)),
    actions: {
      approve: (ctx, id) => actions.reimbursements.approve(ctx, id),
      schedule: (ctx, id, body) => actions.reimbursements.schedule(ctx, id, {
        rail: body.rail != null ? String(body.rail) : undefined,
      }),
      "confirm-payout": (ctx, id) => actions.reimbursements.confirmPayout(ctx, id),
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
        defaultOutcomeType: z.enum(["PURCHASE_ORDER", "VIRTUAL_CARD", "VENDOR_SETUP"]).optional(),
      }).parse(body);
      return prisma.procurementProgram.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          defaultOutcomeType: input.defaultOutcomeType ?? "PURCHASE_ORDER",
        },
      });
    },
  }),
  "purchase-orders": createResourceRouter({
    getDelegate: () => prisma.purchaseOrder as never,
    get: (ctx, id) => actions.procurement.getPoDetail(ctx, id),
    actions: {
      receive: (ctx, id, body) => actions.procurement.receive(ctx, id, String(body.amount ?? ""), body.memo != null ? String(body.memo) : undefined),
      match: (ctx, id, body) => actions.procurement.match(ctx, id, { billId: String(body.billId) }),
    },
  }),
  receiving: createResourceRouter({
    getDelegate: () => prisma.receivingRecord as never,
    create: (ctx, body) => actions.procurement.receive(
      ctx,
      String(body.purchaseOrderId),
      String(body.amount),
      body.memo != null ? String(body.memo) : undefined,
    ),
  }),
  matches: createResourceRouter({
    getDelegate: () => prisma.matchRecord as never,
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
      "confirm-settlement": (ctx, id) => actions.payments.confirmSettlement(ctx, id),
    },
  }),
  "payment-runs": createResourceRouter({
    getDelegate: () => prisma.paymentRun as never,
    create: (ctx, body) => actions.paymentRuns.create(ctx, {
      legalEntityId: String(body.legalEntityId),
      name: String(body.name ?? ""),
    }),
    get: (ctx, id) => actions.paymentRuns.getDetail(ctx, id),
    actions: {
      release: (ctx, id) => actions.paymentRuns.release(ctx, id),
      "add-payments": (ctx, id, body) => actions.paymentRuns.addPayments(ctx, id, {
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
      purpose: body.purpose != null ? String(body.purpose) : undefined,
      startDate: String(body.startDate ?? ""),
      endDate: String(body.endDate ?? ""),
      estimatedAmount: String(body.estimatedAmount ?? body.amount ?? ""),
      currency: body.currency != null ? String(body.currency) : undefined,
    }),
    get: (ctx, id) => actions.travel.getDetail(ctx, id),
    actions: {
      search: (ctx, id, body) => actions.travel.search(ctx, id, {
        type: String(body.type ?? "FLIGHT").toUpperCase() as "FLIGHT" | "HOTEL" | "CAR",
      }),
      "select-quote": (ctx, id, body) => actions.travel.selectQuote(ctx, id, {
        quoteId: String(body.quoteId ?? ""),
        type: String(body.type ?? "FLIGHT").toUpperCase() as "FLIGHT" | "HOTEL" | "CAR",
        supplier: String(body.supplier ?? ""),
        description: body.description != null ? String(body.description) : undefined,
        amount: String(body.amount ?? ""),
        currency: String(body.currency ?? "USD"),
        outOfPolicy: body.outOfPolicy === true || body.outOfPolicy === "true",
        itinerary: body.itinerary && typeof body.itinerary === "object" ? body.itinerary as Record<string, unknown> : undefined,
        startsAt: body.startsAt != null ? String(body.startsAt) : undefined,
        endsAt: body.endsAt != null ? String(body.endsAt) : undefined,
      }),
      submit: (ctx, id) => actions.travel.submit(ctx, id),
      approve: (ctx, id) => actions.travel.approve(ctx, id),
      "link-fund": (ctx, id, body) => actions.travel.linkFund(ctx, id, String(body.fundId)),
      "link-expense": (ctx, id, body) => actions.travel.linkExpense(ctx, id, String(body.expenseId)),
    },
  }),
  "travel-bookings": createResourceRouter({
    getDelegate: () => prisma.travelBooking as never,
    actions: {
      "book-mock": (ctx, id) => actions.travel.bookMock(ctx, id),
      confirm: (ctx, id) => actions.travel.confirmBooking(ctx, id),
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
