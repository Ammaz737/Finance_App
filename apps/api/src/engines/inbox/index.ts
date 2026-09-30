import { Prisma } from "@prisma/client";
import { prisma } from "../../database/client";
import type { RequestContext } from "../../platform/auth/context";
import { AppError } from "../../platform/http";
import { actOnApproval, eligibleForStep, progressLabel } from "../workflow";
import { evaluatePolicy, loadPolicyRules } from "../policy";
import * as actions from "../../application/actions";
import { can } from "../../platform/rbac";
import { syncApprovalInboxItem } from "./sync";

type Step = { type?: string; role?: string; userId?: string };

export type InboxTask = {
  id: string;
  type: string;
  objectType: string;
  objectId: string;
  name: string;
  amount: string;
  currency: string;
  entity?: string;
  requestedBy: string;
  priority: string;
  status: string;
  policySummary: string;
  policyResult?: string;
  currentStep: number;
  totalSteps: number;
  dueAt: string | null;
  availableActions: string[];
  createdAt: string;
  approvalInstanceId?: string;
  invoiceNumber?: string;
  duplicateStatus?: string;
  vendorId?: string;
  approvalProgress?: string;
  sourceType?: string;
  sourceId?: string;
  category?: string;
};

function amountOf(object: { amount?: Prisma.Decimal | number | string }): string {
  return object.amount != null ? String(object.amount) : "0";
}

export async function listInboxTasks(ctx: RequestContext): Promise<InboxTask[]> {
  const [instances, payments, accounting] = await Promise.all([
    prisma.approvalInstance.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ["IN_REVIEW", "INFO_REQUESTED"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    can(ctx, "payment.release")
      ? prisma.payment.findMany({ where: { organizationId: ctx.organizationId, status: "SCHEDULED" }, take: 100, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    can(ctx, "accounting.code")
      ? prisma.accountingEntry.findMany({ where: { organizationId: ctx.organizationId, status: { in: ["NEEDS_REVIEW", "SYNC_ERROR"] } }, take: 100, orderBy: { updatedAt: "desc" } })
      : Promise.resolve([]),
  ]);

  const [workflows, requesters, entities, spendRequests, expenses, reimbursements, bills, procurement, travelTrips, actionsLog] = await Promise.all([
    prisma.approvalWorkflow.findMany({ where: { id: { in: instances.map((item) => item.workflowId) }, organizationId: ctx.organizationId } }),
    prisma.user.findMany({
      where: { id: { in: [...new Set([
        ...instances.map((item) => item.requesterId),
        ...payments.map((item) => item.createdBy),
      ])] }, organizationId: ctx.organizationId },
      select: { id: true, firstName: true, lastName: true, managerId: true },
    }),
    prisma.legalEntity.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, name: true } }),
    prisma.spendRequest.findMany({ where: { id: { in: instances.filter((i) => i.objectType === "spend_request").map((i) => i.objectId) }, organizationId: ctx.organizationId } }),
    prisma.expense.findMany({ where: { id: { in: instances.filter((i) => i.objectType === "expense").map((i) => i.objectId) }, organizationId: ctx.organizationId } }),
    prisma.reimbursement.findMany({ where: { id: { in: instances.filter((i) => i.objectType === "reimbursement").map((i) => i.objectId) }, organizationId: ctx.organizationId } }),
    prisma.bill.findMany({ where: { id: { in: instances.filter((i) => i.objectType === "bill").map((i) => i.objectId) }, organizationId: ctx.organizationId } }),
    prisma.purchaseRequest.findMany({ where: { id: { in: instances.filter((i) => i.objectType === "procurement").map((i) => i.objectId) }, organizationId: ctx.organizationId } }),
    prisma.travelTrip.findMany({ where: { id: { in: instances.filter((i) => i.objectType === "travel").map((i) => i.objectId) }, organizationId: ctx.organizationId } }),
    prisma.approvalAction.findMany({ where: { instanceId: { in: instances.map((i) => i.id) } }, orderBy: { createdAt: "asc" } }),
  ]);

  const entityName = (id?: string | null) => entities.find((item) => item.id === id)?.name;
  const tasks: InboxTask[] = [];

  for (const instance of instances) {
    const workflow = workflows.find((item) => item.id === instance.workflowId);
    // Prefer steps pinned on the instance (same source as actOnApproval). Falling back to
    // workflow.steps or a single finance step used to hide step-2 tasks from Finance/Owner
    // after the manager approved when workflow lookup failed or was disabled.
    const pinned = Array.isArray(instance.resolvedSteps) ? (instance.resolvedSteps as Step[]) : [];
    const fromWorkflow = Array.isArray(workflow?.steps) ? (workflow.steps as Step[]) : [];
    const steps = pinned.length ? pinned : fromWorkflow.length ? fromWorkflow : [{ type: "finance" }];
    const requester = requesters.find((item) => item.id === instance.requesterId);
    const step = steps[instance.currentStep];
    if (!requester || requester.id === ctx.userId || !step || !eligibleForStep({
      step,
      actorId: ctx.userId,
      actorRoles: ctx.roles,
      managerId: requester.managerId,
      assigneeUserId: instance.assigneeUserId,
    })) continue;

    const object = instance.objectType === "spend_request" ? spendRequests.find((item) => item.id === instance.objectId)
      : instance.objectType === "expense" ? expenses.find((item) => item.id === instance.objectId)
      : instance.objectType === "reimbursement" ? reimbursements.find((item) => item.id === instance.objectId)
      : instance.objectType === "bill" ? bills.find((item) => item.id === instance.objectId)
      : instance.objectType === "procurement" ? procurement.find((item) => item.id === instance.objectId)
      : instance.objectType === "travel" ? travelTrips.find((item) => item.id === instance.objectId)
      : null;
    if (!object) continue;

    const name = instance.objectType === "reimbursement" && "memo" in object
      ? `Reimbursement: ${String(object.memo || "")}`
      : instance.objectType === "travel" && "destination" in object
        ? `Travel: ${String((object as { name?: string; destination?: string }).name || (object as { destination?: string }).destination || "")}`
      : "name" in object ? String(object.name)
      : "merchant" in object ? String(object.merchant)
      : "invoiceNumber" in object ? String(object.invoiceNumber)
      : instance.objectType;

    const policyResult = "policyResult" in object ? String(object.policyResult || "") : "";
    const legalEntityId = "legalEntityId" in object ? String(object.legalEntityId) : undefined;
    const amountValue = "estimatedAmount" in object && (object as { estimatedAmount?: unknown }).estimatedAmount != null
      ? amountOf({ amount: (object as { estimatedAmount: Prisma.Decimal | number | string }).estimatedAmount })
      : "amount" in object
        ? amountOf(object as { amount?: Prisma.Decimal | number | string })
        : "0";
    const availableActions = instance.status === "INFO_REQUESTED"
      ? ["approve", "reject"]
      : ["approve", "reject", "request_info"];

    tasks.push({
      id: instance.id,
      type: instance.objectType === "bill"
        ? "BILL_APPROVAL"
        : instance.objectType === "procurement"
          ? "PROCUREMENT_REQUEST"
          : instance.objectType === "reimbursement"
            ? "REIMBURSEMENT_APPROVAL"
            : instance.objectType === "travel"
              ? "TRAVEL_REQUEST"
              : "APPROVAL",
      objectType: instance.objectType,
      objectId: instance.objectId,
      name,
      amount: amountValue,
      currency: "currency" in object ? String(object.currency) : "USD",
      entity: entityName(legalEntityId),
      requestedBy: `${requester.firstName} ${requester.lastName}`,
      priority: instance.priority || "NORMAL",
      status: instance.status,
      policySummary: policyResult ? `Policy ${policyResult}` : (actionsLog.some((a) => a.instanceId === instance.id) ? progressLabel(instance.currentStep, steps.length, instance.status) : "Awaiting review"),
      policyResult: policyResult || undefined,
      currentStep: instance.currentStep + 1,
      totalSteps: steps.length,
      dueAt: instance.dueAt?.toISOString() ?? null,
      availableActions,
      createdAt: instance.createdAt.toISOString(),
      approvalInstanceId: instance.id,
      ...(instance.objectType === "bill" && "invoiceNumber" in object
        ? {
            invoiceNumber: String((object as { invoiceNumber: string }).invoiceNumber),
            duplicateStatus: "duplicateStatus" in object ? String((object as { duplicateStatus?: string }).duplicateStatus ?? "CLEAR") : "CLEAR",
            vendorId: "vendorId" in object ? String((object as { vendorId: string }).vendorId) : undefined,
            approvalProgress: progressLabel(instance.currentStep, steps.length, instance.status),
          }
        : {}),
      ...(instance.objectType === "procurement"
        ? {
            approvalProgress: progressLabel(instance.currentStep, steps.length, instance.status),
            vendorId: "vendorId" in object && (object as { vendorId?: string | null }).vendorId
              ? String((object as { vendorId: string }).vendorId)
              : undefined,
          }
        : {}),
      ...(instance.objectType === "travel"
        ? {
            approvalProgress: progressLabel(instance.currentStep, steps.length, instance.status),
            destination: "destination" in object ? String((object as { destination?: string }).destination ?? "") : undefined,
            purpose: "purpose" in object ? String((object as { purpose?: string }).purpose ?? "") : undefined,
            startDate: "startDate" in object && (object as { startDate?: Date | null }).startDate
              ? new Date((object as { startDate: Date }).startDate).toISOString()
              : undefined,
            endDate: "endDate" in object && (object as { endDate?: Date | null }).endDate
              ? new Date((object as { endDate: Date }).endDate).toISOString()
              : undefined,
            international: "international" in object ? Boolean((object as { international?: boolean }).international) : false,
            travelerId: "travelerId" in object ? String((object as { travelerId: string }).travelerId) : undefined,
            href: `/app/travel/trips/${instance.objectId}`,
          }
        : {}),
    });
  }

  for (const payment of payments) {
    if (payment.createdBy === ctx.userId) continue;
    const creator = requesters.find((item) => item.id === payment.createdBy);
    tasks.push({
      id: `payment:${payment.id}`,
      type: "PAYMENT_RELEASE",
      objectType: "payment",
      objectId: payment.id,
      name: `Release payment`,
      amount: String(payment.amount),
      currency: payment.currency,
      entity: entityName(payment.legalEntityId),
      requestedBy: creator ? `${creator.firstName} ${creator.lastName}` : "Payment creator",
      priority: Number(payment.amount) >= 25000 ? "HIGH" : "NORMAL",
      status: payment.status,
      policySummary: "Bill approved — awaiting payment release",
      currentStep: 1,
      totalSteps: 1,
      dueAt: null,
      availableActions: ["release"],
      createdAt: payment.createdAt.toISOString(),
    });
  }

  for (const entry of accounting) {
    const sourceLabel = entry.sourceType === "BILL" ? "Bill / invoice"
      : entry.sourceType === "PAYMENT" ? "Payment"
      : entry.sourceType === "REIMBURSEMENT" ? "Reimbursement"
      : entry.sourceType === "CARD" || entry.sourceType === "EXPENSE" ? "Card / expense"
      : entry.sourceType;
    tasks.push({
      id: `accounting:${entry.id}`,
      type: "ACCOUNTING_EXCEPTION",
      objectType: "accounting",
      objectId: entry.id,
      name: `${sourceLabel} coding`,
      amount: entry.amount != null ? String(entry.amount) : "0",
      currency: entry.currency || "USD",
      entity: entityName(entry.legalEntityId),
      requestedBy: "Accounting queue",
      priority: entry.status === "SYNC_ERROR" ? "HIGH" : "NORMAL",
      status: entry.status,
      policySummary: entry.syncError || entry.category || "Needs coding review",
      currentStep: 1,
      totalSteps: 1,
      dueAt: null,
      availableActions: ["open"],
      createdAt: entry.updatedAt.toISOString(),
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      category: entry.category || undefined,
    });
  }

  if (can(ctx, "procurement.review")) {
    const matchExceptions = await prisma.matchRecord.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["EXCEPTION", "BLOCKED"] },
        exceptionStatus: { in: ["OPEN", "IN_REVIEW", ""] },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    for (const match of matchExceptions) {
      if (match.exceptionStatus === "OPEN" || match.exceptionStatus === "IN_REVIEW" || match.exceptionStatus === "") {
        tasks.push({
          id: `match:${match.id}`,
          type: "PROCUREMENT_MATCH_EXCEPTION",
          objectType: "match",
          objectId: match.id,
          name: match.reasonCode || match.explanation || "Match exception",
          amount: String(match.variance),
          currency: "USD",
          requestedBy: "Procurement match",
          priority: match.status === "BLOCKED" ? "HIGH" : "NORMAL",
          status: match.exceptionStatus || "OPEN",
          policySummary: match.explanation,
          currentStep: 1,
          totalSteps: 1,
          dueAt: null,
          availableActions: ["resolve", "open"],
          createdAt: match.createdAt.toISOString(),
        });
      }
    }
  }

  return tasks.sort((a, b) => {
    const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as Record<string, number>;
    return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) || b.createdAt.localeCompare(a.createdAt);
  });
}

export async function getInboxTaskDetail(ctx: RequestContext, id: string) {
  const tasks = await listInboxTasks(ctx);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new AppError("NOT_FOUND", "Inbox task not found", 404);

  let timeline: Array<{ at: string; actor: string; action: string; comment: string }> = [];
  let policy: Awaited<ReturnType<typeof evaluatePolicy>> | null = null;

  if (task.approvalInstanceId) {
    const [actionsLog, users] = await Promise.all([
      prisma.approvalAction.findMany({ where: { instanceId: task.approvalInstanceId }, orderBy: { createdAt: "asc" } }),
      prisma.user.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    timeline = actionsLog.map((item) => {
      const actor = users.find((user) => user.id === item.actorId);
      return {
        at: item.createdAt.toISOString(),
        actor: actor ? `${actor.firstName} ${actor.lastName}` : item.actorId.slice(0, 8),
        action: item.action,
        comment: item.comment,
      };
    });
    const policyObjectType = task.objectType === "spend_request" ? "spend_request" : task.objectType;
    const { rules } = await loadPolicyRules(
      (args) => prisma.policy.findMany(args as never),
      ctx.organizationId,
      policyObjectType,
    );
    policy = evaluatePolicy({
      objectType: policyObjectType,
      amount: Number(task.amount),
      rules,
    });
  }

  return { ...task, timeline, policy };
}

export async function decideInboxTask(ctx: RequestContext, id: string, decision: "approve" | "reject" | "request_info" | "release", comment = "") {
  if (id.startsWith("payment:") && decision === "release") {
    return actions.payments.release(ctx, id.slice("payment:".length));
  }
  if (id.startsWith("accounting:")) {
    throw new AppError("OPEN_IN_ACCOUNTING", "Open this item in Accounting to code or sync", 400);
  }
  if (id.startsWith("match:")) {
    throw new AppError("OPEN_IN_MATCH", "Open this match exception in Procurement to resolve", 400);
  }

  const instance = await prisma.approvalInstance.findFirst({
    where: { id, organizationId: ctx.organizationId, status: { in: ["IN_REVIEW", "INFO_REQUESTED"] } },
  });
  if (!instance) throw new AppError("NOT_FOUND", "Approval task not found", 404);

  if (decision === "request_info") {
    if (!comment.trim()) throw new AppError("COMMENT_REQUIRED", "Explain what information is needed", 400);
    return prisma.$transaction(async (tx) => {
      const claim = await tx.approvalInstance.updateMany({
        where: { id: instance.id, organizationId: ctx.organizationId, status: { in: ["IN_REVIEW", "INFO_REQUESTED"] } },
        data: { status: "INFO_REQUESTED", infoRequestedAt: new Date(), infoRequestComment: comment.trim() },
      });
      if (claim.count !== 1) throw new AppError("APPROVAL_CONFLICT", "Task changed; refresh and try again", 409);
      await tx.approvalAction.create({ data: { instanceId: instance.id, actorId: ctx.userId, action: "request_info", comment: comment.trim() } });
      await syncApprovalInboxItem({
        organizationId: ctx.organizationId,
        instanceId: instance.id,
        objectType: instance.objectType,
        objectId: instance.objectId,
        requesterId: instance.requesterId,
        title: instance.objectType,
        currentStep: instance.currentStep,
        totalSteps: 1,
        status: "INFO_REQUESTED",
        policySummary: comment.trim(),
        availableActions: ["approve", "reject"],
      }, tx);
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "approval.request_info",
          objectType: instance.objectType, objectId: instance.objectId, newValue: { comment: comment.trim() },
          correlationId: ctx.correlationId,
        },
      });
      return tx.approvalInstance.findUniqueOrThrow({ where: { id: instance.id } });
    });
  }

  if (decision === "approve") {
    const result = instance.objectType === "spend_request" ? await actions.spend.approveRequest(ctx, instance.objectId)
      : instance.objectType === "expense" ? await actions.expenses.approve(ctx, instance.objectId)
      : instance.objectType === "reimbursement" ? await actions.reimbursements.approve(ctx, instance.objectId)
      : instance.objectType === "bill" ? await actions.bills.approve(ctx, instance.objectId)
      : instance.objectType === "procurement" ? await actions.procurement.approve(ctx, instance.objectId)
      : instance.objectType === "travel" ? await actions.travel.approve(ctx, instance.objectId)
      : null;
    if (!result) throw new AppError("UNSUPPORTED_APPROVAL", "This task type cannot be approved yet", 400);
    const updated = await prisma.approvalInstance.findFirst({ where: { id: instance.id } });
    if (updated) {
      await syncApprovalInboxItem({
        organizationId: ctx.organizationId,
        instanceId: instance.id,
        objectType: instance.objectType,
        objectId: instance.objectId,
        requesterId: instance.requesterId,
        title: instance.objectType,
        currentStep: updated.currentStep,
        totalSteps: updated.currentStep || 1,
        status: updated.status,
      });
    }
    return result;
  }

  if (decision !== "reject") throw new AppError("UNKNOWN_ACTION", "Unknown decision", 404);
  const rejected = await actOnApproval({ instanceId: instance.id, actorId: ctx.userId, action: "reject", comment });
  const where = { id: instance.objectId, organizationId: ctx.organizationId };
  if (instance.objectType === "spend_request") await prisma.spendRequest.updateMany({ where, data: { status: "REJECTED" } });
  else if (instance.objectType === "expense") await prisma.expense.updateMany({ where, data: { status: "REJECTED" } });
  else if (instance.objectType === "reimbursement") await prisma.reimbursement.updateMany({ where, data: { status: "REJECTED" } });
  else if (instance.objectType === "bill") await prisma.bill.updateMany({ where, data: { status: "REJECTED" } });
  else if (instance.objectType === "procurement") await prisma.purchaseRequest.updateMany({ where, data: { status: "REJECTED" } });
  else if (instance.objectType === "travel") await prisma.travelTrip.updateMany({ where, data: { status: "REJECTED" } });
  await syncApprovalInboxItem({
    organizationId: ctx.organizationId,
    instanceId: instance.id,
    objectType: instance.objectType,
    objectId: instance.objectId,
    requesterId: instance.requesterId,
    title: instance.objectType,
    currentStep: rejected.currentStep,
    totalSteps: 1,
    status: "REJECTED",
  });
  await prisma.auditEvent.create({
    data: {
      organizationId: ctx.organizationId, actorId: ctx.userId, action: "approval.reject",
      objectType: instance.objectType, objectId: instance.objectId, newValue: { status: "REJECTED", comment },
      correlationId: ctx.correlationId,
    },
  });
  return rejected;
}
