import { prisma } from "../../database/client";
import type { Prisma } from "@prisma/client";

export async function writeAudit(input: {
  organizationId: string;
  actorId?: string;
  actorType?: string;
  action: string;
  objectType: string;
  objectId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  correlationId?: string;
}) {
  await prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType ?? "INTERNAL_USER",
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId,
      oldValue: input.oldValue,
      newValue: input.newValue,
      correlationId: input.correlationId,
    },
  });
}

export async function writeOutbox(organizationId: string, type: string, payload: Prisma.InputJsonValue) {
  await prisma.outboxEvent.create({
    data: { organizationId, type, payload },
  });
}
