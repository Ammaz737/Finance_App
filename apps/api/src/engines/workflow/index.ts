import { Prisma } from "@prisma/client";
import { prisma } from "../../database/client";
import { AppError } from "../../platform/http";
import { syncApprovalInboxItem } from "../inbox/sync";

type WorkflowStep = { type?: string; userId?: string; role?: string };
type Db = Prisma.TransactionClient | typeof prisma;

export function eligibleForStep(input: {
  step: WorkflowStep;
  actorId: string;
  actorRoles: string[];
  managerId: string | null;
}) {
  if (input.step.userId) return input.step.userId === input.actorId;
  if (input.step.role) return input.actorRoles.includes(input.step.role) || input.actorRoles.includes("Owner");
  switch (input.step.type) {
    case "manager": return input.managerId === input.actorId;
    case "finance": case "ap": case "budget": return input.actorRoles.some((role) => ["Owner", "Finance Admin", "Accounts Payable Admin", "Controller"].includes(role));
    case "controller": return input.actorRoles.some((role) => ["Owner", "Controller", "Accounting Admin"].includes(role));
    case "legal": case "cfo": return input.actorRoles.includes("Owner");
    default: return false;
  }
}

export async function startApproval(input: {
  organizationId: string;
  workflowId?: string | null;
  objectType: string;
  objectId: string;
  requesterId: string;
  steps?: number;
  title?: string;
  amount?: string | number;
  currency?: string;
  legalEntityId?: string;
  priority?: string;
  policySummary?: string;
}, db: Db = prisma) {
  const workflow = input.workflowId
    ? await db.approvalWorkflow.findFirst({
        where: { id: input.workflowId, organizationId: input.organizationId },
      })
    : await db.approvalWorkflow.findFirst({
        where: { organizationId: input.organizationId, objectType: input.objectType },
      });
  const steps = Array.isArray(workflow?.steps) ? (workflow?.steps as unknown[]).length : input.steps ?? 1;
  const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const instance = await db.approvalInstance.create({
    data: {
      organizationId: input.organizationId,
      workflowId: workflow?.id ?? "default",
      objectType: input.objectType,
      objectId: input.objectId,
      requesterId: input.requesterId,
      status: "IN_REVIEW",
      currentStep: 0,
      priority: input.priority ?? (Number(input.amount ?? 0) >= 10000 ? "HIGH" : "NORMAL"),
      dueAt,
    },
  });
  await syncApprovalInboxItem({
    organizationId: input.organizationId,
    instanceId: instance.id,
    objectType: input.objectType,
    objectId: input.objectId,
    requesterId: input.requesterId,
    title: input.title ?? input.objectType,
    amount: input.amount,
    currency: input.currency,
    legalEntityId: input.legalEntityId,
    currentStep: 0,
    totalSteps: steps,
    status: "IN_REVIEW",
    priority: instance.priority,
    dueAt,
    policySummary: input.policySummary ?? "",
    availableActions: ["approve", "reject", "request_info"],
  }, db);
  return { instance, steps };
}

async function decideApproval(tx: Prisma.TransactionClient, input: {
  instanceId: string;
  actorId: string;
  action: "approve" | "reject";
  comment?: string;
}) {
  const instance = await tx.approvalInstance.findUnique({ where: { id: input.instanceId } });
  if (!instance) throw new AppError("NOT_FOUND", "Approval instance not found", 404);
  if (!["IN_REVIEW", "INFO_REQUESTED"].includes(instance.status)) throw new AppError("INVALID_STATE", "Approval is no longer pending", 409);
  if (instance.requesterId === input.actorId) throw new AppError("SOD_VIOLATION", "Requester cannot decide their own approval", 403);

  const [actor, requester, workflow] = await Promise.all([
    tx.user.findFirst({ where: { id: input.actorId, organizationId: instance.organizationId, status: "ACTIVE" } }),
    tx.user.findFirst({ where: { id: instance.requesterId, organizationId: instance.organizationId } }),
    instance.workflowId === "default" ? Promise.resolve(null) : tx.approvalWorkflow.findFirst({ where: { id: instance.workflowId, organizationId: instance.organizationId } }),
  ]);
  if (!actor || !requester) throw new AppError("FORBIDDEN", "Actor or requester is unavailable", 403);
  const assignments = await tx.userRole.findMany({ where: { userId: input.actorId, organizationId: instance.organizationId } });
  const roles = await tx.role.findMany({ where: { id: { in: assignments.map((assignment) => assignment.roleId) }, organizationId: instance.organizationId } });
  const steps = Array.isArray(workflow?.steps) ? workflow.steps as WorkflowStep[] : [{ type: "finance" }];
  const step = steps[instance.currentStep];
  if (!step || !eligibleForStep({ step, actorId: input.actorId, actorRoles: roles.map((role) => role.name), managerId: requester.managerId })) {
    throw new AppError("NOT_ASSIGNED", "You are not eligible for this approval step", 403);
  }
  const next = input.action === "approve" ? instance.currentStep + 1 : instance.currentStep;
  const status = input.action === "reject" ? "REJECTED" : next >= steps.length ? "APPROVED" : "IN_REVIEW";
  const claim = await tx.approvalInstance.updateMany({
    where: { id: instance.id, status: instance.status, currentStep: instance.currentStep },
    data: { status, currentStep: next, infoRequestedAt: null, infoRequestComment: "" },
  });
  if (claim.count !== 1) throw new AppError("APPROVAL_CONFLICT", "Approval changed; refresh and try again", 409);
  await tx.approvalAction.create({ data: { instanceId: instance.id, actorId: input.actorId, action: input.action, comment: input.comment ?? "" } });
  const updated = await tx.approvalInstance.findUniqueOrThrow({ where: { id: instance.id } });
  await syncApprovalInboxItem({
    organizationId: instance.organizationId,
    instanceId: instance.id,
    objectType: instance.objectType,
    objectId: instance.objectId,
    requesterId: instance.requesterId,
    title: instance.objectType,
    currentStep: updated.currentStep,
    totalSteps: steps.length,
    status: updated.status,
    priority: updated.priority,
    dueAt: updated.dueAt,
  }, tx);
  return updated;
}

export async function actOnApproval(input: {
  instanceId: string;
  actorId: string;
  action: "approve" | "reject";
  comment?: string;
}, db?: Prisma.TransactionClient) {
  if (db) return decideApproval(db, input);
  return prisma.$transaction((tx) => decideApproval(tx, input));
}

export function progressLabel(current: number, total: number, status: string) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "INFO_REQUESTED") return "Info requested";
  return `${current} of ${total} approvals`;
}
