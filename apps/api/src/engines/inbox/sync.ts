import { Prisma } from "@prisma/client";
import { prisma } from "../../database/client";

type Db = Prisma.TransactionClient | typeof prisma;

export async function syncApprovalInboxItem(input: {
  organizationId: string;
  instanceId: string;
  objectType: string;
  objectId: string;
  requesterId: string;
  title: string;
  amount?: string | number | Prisma.Decimal;
  currency?: string;
  legalEntityId?: string | null;
  currentStep: number;
  totalSteps: number;
  status: string;
  priority?: string;
  dueAt?: Date | null;
  policySummary?: string;
  availableActions?: string[];
}, db: Db = prisma) {
  const open = input.status === "IN_REVIEW" || input.status === "INFO_REQUESTED";
  const existing = await db.inboxItem.findFirst({
    where: { organizationId: input.organizationId, approvalInstanceId: input.instanceId },
  });
  const data = {
    type: "APPROVAL",
    objectType: input.objectType,
    objectId: input.objectId,
    approvalInstanceId: input.instanceId,
    requestedById: input.requesterId,
    legalEntityId: input.legalEntityId ?? null,
    title: input.title,
    amount: input.amount != null ? new Prisma.Decimal(input.amount) : null,
    currency: input.currency ?? "USD",
    priority: input.priority ?? "NORMAL",
    status: open ? (input.status === "INFO_REQUESTED" ? "INFO_REQUESTED" : "OPEN") : "DONE",
    policySummary: input.policySummary ?? "",
    currentStep: input.currentStep,
    totalSteps: input.totalSteps,
    dueAt: input.dueAt ?? null,
    availableActions: input.availableActions ?? (open ? ["approve", "reject", "request_info"] : []),
  };
  if (existing) {
    return db.inboxItem.update({ where: { id: existing.id }, data });
  }
  return db.inboxItem.create({ data: { organizationId: input.organizationId, ...data } });
}
