import { Prisma } from "@prisma/client";
import { prisma } from "../../database/client";
import { AppError } from "../../platform/http";
import { syncApprovalInboxItem } from "../inbox/sync";

export type WorkflowStep = {
  type?: string;
  userId?: string;
  role?: string;
  /** sequential (default) or parallel — parallel steps sharing parallelGroup must all approve */
  mode?: "sequential" | "parallel";
  parallelGroup?: string;
  minAmount?: number;
  maxAmount?: number;
  departmentId?: string;
  legalEntityId?: string;
};

type Db = Prisma.TransactionClient | typeof prisma;

export function eligibleForStep(input: {
  step: WorkflowStep;
  actorId: string;
  actorRoles: string[];
  managerId: string | null;
  assigneeUserId?: string | null;
}) {
  if (input.assigneeUserId) return input.assigneeUserId === input.actorId;
  if (input.step.userId) return input.step.userId === input.actorId;
  if (input.step.role) return input.actorRoles.includes(input.step.role) || input.actorRoles.includes("Owner");
  switch (input.step.type) {
    // Direct manager is primary; Owner may override (same pattern as role/finance steps).
    case "manager":
      return input.managerId === input.actorId || input.actorRoles.includes("Owner");
    case "finance": case "ap": case "budget": return input.actorRoles.some((role) => ["Owner", "Finance Admin", "Accounts Payable Admin", "Controller"].includes(role));
    case "controller": return input.actorRoles.some((role) => ["Owner", "Controller", "Accounting Admin"].includes(role));
    case "legal": case "cfo": return input.actorRoles.includes("Owner");
    case "department_head": return input.actorRoles.some((role) => ["Owner", "Manager", "Department Head"].includes(role));
    default: return false;
  }
}

/** Select applicable steps for amount / department / entity routing. */
export function resolveWorkflowSteps(input: {
  steps: WorkflowStep[];
  amount?: number;
  departmentId?: string | null;
  legalEntityId?: string | null;
}): WorkflowStep[] {
  return input.steps.filter((step) => {
    if (step.minAmount != null && (input.amount ?? 0) < step.minAmount) return false;
    if (step.maxAmount != null && (input.amount ?? 0) > step.maxAmount) return false;
    if (step.departmentId && input.departmentId && step.departmentId !== input.departmentId) return false;
    if (step.departmentId && !input.departmentId) return false;
    if (step.legalEntityId && input.legalEntityId && step.legalEntityId !== input.legalEntityId) return false;
    if (step.legalEntityId && !input.legalEntityId) return false;
    return true;
  });
}

function parallelGroupIndices(steps: WorkflowStep[], index: number): number[] {
  const step = steps[index];
  if (!step || step.mode !== "parallel") return [index];
  const group = step.parallelGroup ?? `step-${index}`;
  return steps
    .map((candidate, i) => ({ candidate, i }))
    .filter(({ candidate, i }) => candidate.mode === "parallel" && (candidate.parallelGroup ?? `step-${i}`) === group)
    .map(({ i }) => i);
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
  departmentId?: string | null;
  priority?: string;
  policySummary?: string;
}, db: Db = prisma) {
  const workflow = input.workflowId
    ? await db.approvalWorkflow.findFirst({
        where: { id: input.workflowId, organizationId: input.organizationId },
      })
    : await db.approvalWorkflow.findFirst({
        where: {
          organizationId: input.organizationId,
          objectType: input.objectType,
          enabled: true,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
        orderBy: { version: "desc" },
      })
      // Seed historically created workflows with enabled=false (schema default). Fall back so
      // manager → finance chains still start instead of collapsing to a single finance step.
      ?? await db.approvalWorkflow.findFirst({
        where: { organizationId: input.organizationId, objectType: input.objectType },
        orderBy: { version: "desc" },
      });
  const rawSteps = Array.isArray(workflow?.steps) ? (workflow.steps as WorkflowStep[]) : undefined;
  const routed = rawSteps
    ? resolveWorkflowSteps({
        steps: rawSteps,
        amount: Number(input.amount ?? 0),
        departmentId: input.departmentId,
        legalEntityId: input.legalEntityId,
      })
    : undefined;
  const steps = routed?.length ? routed.length : input.steps ?? 1;
  const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const instance = await db.approvalInstance.create({
    data: {
      organizationId: input.organizationId,
      workflowId: workflow?.id ?? "default",
      workflowVersion: workflow?.version ?? 1,
      objectType: input.objectType,
      objectId: input.objectId,
      requesterId: input.requesterId,
      status: "IN_REVIEW",
      currentStep: 0,
      priority: input.priority ?? (Number(input.amount ?? 0) >= 10000 ? "HIGH" : "NORMAL"),
      dueAt,
      parallelApprovals: [],
      resolvedSteps: routed ?? rawSteps ?? [{ type: "finance" }],
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
  return { instance, steps, workflowVersion: workflow?.version ?? 1 };
}

async function loadSteps(tx: Prisma.TransactionClient, instance: {
  organizationId: string;
  workflowId: string;
  resolvedSteps: unknown;
}): Promise<WorkflowStep[]> {
  if (Array.isArray(instance.resolvedSteps) && instance.resolvedSteps.length) {
    return instance.resolvedSteps as WorkflowStep[];
  }
  if (instance.workflowId === "default") return [{ type: "finance" }];
  const workflow = await tx.approvalWorkflow.findFirst({
    where: { id: instance.workflowId, organizationId: instance.organizationId },
  });
  return Array.isArray(workflow?.steps) ? (workflow.steps as WorkflowStep[]) : [{ type: "finance" }];
}

async function decideApproval(tx: Prisma.TransactionClient, input: {
  instanceId: string;
  actorId: string;
  action: "approve" | "reject";
  comment?: string;
}) {
  const instance = await tx.approvalInstance.findUnique({ where: { id: input.instanceId } });
  if (!instance) throw new AppError("NOT_FOUND", "Approval instance not found", 404);
  if (!["IN_REVIEW", "INFO_REQUESTED", "ESCALATED"].includes(instance.status)) {
    throw new AppError("INVALID_STATE", "Approval is no longer pending", 409);
  }
  if (instance.requesterId === input.actorId) throw new AppError("SOD_VIOLATION", "Requester cannot decide their own approval", 403);

  const [actor, requester] = await Promise.all([
    tx.user.findFirst({ where: { id: input.actorId, organizationId: instance.organizationId, status: "ACTIVE" } }),
    tx.user.findFirst({ where: { id: instance.requesterId, organizationId: instance.organizationId } }),
  ]);
  if (!actor || !requester) throw new AppError("FORBIDDEN", "Actor or requester is unavailable", 403);
  const assignments = await tx.userRole.findMany({ where: { userId: input.actorId, organizationId: instance.organizationId } });
  const roles = await tx.role.findMany({ where: { id: { in: assignments.map((assignment) => assignment.roleId) }, organizationId: instance.organizationId } });
  const steps = await loadSteps(tx, instance);
  const step = steps[instance.currentStep];
  if (!step || !eligibleForStep({
    step,
    actorId: input.actorId,
    actorRoles: roles.map((role) => role.name),
    managerId: requester.managerId,
    assigneeUserId: instance.assigneeUserId,
  })) {
    const who =
      step?.type === "manager"
        ? "This step requires the employee's manager (or Owner)."
        : step?.type === "finance" || step?.type === "ap"
          ? "This step requires Finance / AP / Owner."
          : "You are not assigned to the current approval step.";
    throw new AppError("NOT_ASSIGNED", who, 403);
  }

  // Separation of duties: requester cannot decide (above).
  // Consecutive same-actor blocking is limited to explicitly distinct control steps
  // (different type/role/user) so serial same-role checklists still work.
  const prior = await tx.approvalAction.findFirst({
    where: { instanceId: instance.id, action: "approve" },
    orderBy: { createdAt: "desc" },
  });
  if (input.action === "approve" && prior && prior.actorId === input.actorId && instance.currentStep > 0) {
    const prevStep = steps[instance.currentStep - 1];
    const distinctControl = Boolean(
      prevStep
      && (
        (prevStep.type ?? "") !== (step.type ?? "")
        || (prevStep.role ?? "") !== (step.role ?? "")
        || (prevStep.userId ?? "") !== (step.userId ?? "")
      ),
    );
    if (distinctControl) {
      throw new AppError("SOD_VIOLATION", "Same actor cannot approve consecutive distinct control steps", 403);
    }
  }

  let next = instance.currentStep;
  let status = instance.status;
  let parallelApprovals = Array.isArray(instance.parallelApprovals)
    ? [...(instance.parallelApprovals as string[])]
    : [];

  if (input.action === "reject") {
    status = "REJECTED";
  } else if (step.mode === "parallel") {
    const group = parallelGroupIndices(steps, instance.currentStep);
    const marker = `${instance.currentStep}:${input.actorId}`;
    if (parallelApprovals.includes(marker)) {
      throw new AppError("ALREADY_APPROVED", "You already approved this parallel step", 409);
    }
    parallelApprovals.push(marker);
    const approvedInGroup = new Set(
      parallelApprovals
        .map((entry) => Number(String(entry).split(":")[0]))
        .filter((index) => group.includes(index)),
    );
    if (approvedInGroup.size >= group.length) {
      next = Math.max(...group) + 1;
      parallelApprovals = parallelApprovals.filter(
        (entry) => !group.includes(Number(String(entry).split(":")[0])),
      );
      status = next >= steps.length ? "APPROVED" : "IN_REVIEW";
    } else {
      const remaining = group.filter((index) => !approvedInGroup.has(index));
      next = remaining[0] ?? instance.currentStep;
      status = "IN_REVIEW";
    }
  } else {
    next = instance.currentStep + 1;
    status = next >= steps.length ? "APPROVED" : "IN_REVIEW";
  }

  const claim = await tx.approvalInstance.updateMany({
    where: { id: instance.id, status: instance.status, currentStep: instance.currentStep },
    data: {
      status,
      currentStep: next,
      infoRequestedAt: null,
      infoRequestComment: "",
      parallelApprovals,
      assigneeUserId: null,
    },
  });
  if (claim.count !== 1) throw new AppError("APPROVAL_CONFLICT", "Approval changed; refresh and try again", 409);
  await tx.approvalAction.create({
    data: { instanceId: instance.id, actorId: input.actorId, action: input.action, comment: input.comment ?? "" },
  });
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

export async function reassignApproval(input: {
  instanceId: string;
  actorId: string;
  assigneeUserId: string;
  organizationId: string;
  comment?: string;
}, db: Db = prisma) {
  const instance = await db.approvalInstance.findFirst({
    where: { id: input.instanceId, organizationId: input.organizationId },
  });
  if (!instance) throw new AppError("NOT_FOUND", "Approval instance not found", 404);
  if (!["IN_REVIEW", "INFO_REQUESTED", "ESCALATED"].includes(instance.status)) {
    throw new AppError("INVALID_STATE", "Approval is no longer pending", 409);
  }
  if (instance.requesterId === input.assigneeUserId) {
    throw new AppError("SOD_VIOLATION", "Cannot reassign approval to the requester", 403);
  }
  const assignee = await db.user.findFirst({
    where: { id: input.assigneeUserId, organizationId: input.organizationId, status: "ACTIVE" },
  });
  if (!assignee) throw new AppError("INVALID_ASSIGNEE", "Assignee is unavailable", 400);
  const updated = await db.approvalInstance.update({
    where: { id: instance.id },
    data: { assigneeUserId: input.assigneeUserId },
  });
  await db.approvalAction.create({
    data: {
      instanceId: instance.id,
      actorId: input.actorId,
      action: "reassign",
      comment: input.comment ?? `Reassigned to ${input.assigneeUserId}`,
    },
  });
  return updated;
}

export async function escalateApproval(input: {
  instanceId: string;
  organizationId: string;
  actorId?: string;
}, db: Db = prisma) {
  const instance = await db.approvalInstance.findFirst({
    where: { id: input.instanceId, organizationId: input.organizationId },
  });
  if (!instance) throw new AppError("NOT_FOUND", "Approval instance not found", 404);
  if (!["IN_REVIEW", "INFO_REQUESTED"].includes(instance.status)) {
    throw new AppError("INVALID_STATE", "Approval cannot be escalated", 409);
  }
  const now = new Date();
  if (instance.dueAt && instance.dueAt > now && !input.actorId) {
    throw new AppError("NOT_DUE", "Approval is not past due for automatic escalation", 409);
  }
  const steps = await loadSteps(db as Prisma.TransactionClient, instance);
  const next = Math.min(instance.currentStep + 1, Math.max(steps.length - 1, 0));
  const updated = await db.approvalInstance.update({
    where: { id: instance.id },
    data: {
      status: "ESCALATED",
      currentStep: next,
      escalatedAt: now,
      assigneeUserId: null,
      priority: "HIGH",
    },
  });
  await db.approvalAction.create({
    data: {
      instanceId: instance.id,
      actorId: input.actorId ?? "system",
      action: "escalate",
      comment: "Escalated past due or by operator",
    },
  });
  return updated;
}

export function progressLabel(current: number, total: number, status: string) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "INFO_REQUESTED") return "Info requested";
  if (status === "ESCALATED") return `Escalated — ${current} of ${total} approvals`;
  return `${current} of ${total} approvals`;
}
