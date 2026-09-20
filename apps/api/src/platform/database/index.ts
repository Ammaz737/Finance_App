import { prisma } from "../../database/client";
import type { Prisma } from "@prisma/client";
import { writeAudit, writeOutbox } from "../events";
import type { RequestContext } from "../auth/context";

export async function auditedCommand<T>(
  ctx: RequestContext,
  command: { action: string; objectType: string; objectId: string; event?: string },
  run: (tx: Prisma.TransactionClient) => Promise<{ result: T; oldValue?: Prisma.InputJsonValue; newValue?: Prisma.InputJsonValue }>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const change = await run(tx);
    await tx.auditEvent.create({ data: {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorType: ctx.actorType,
      action: command.action,
      objectType: command.objectType,
      objectId: command.objectId,
      oldValue: change.oldValue,
      newValue: change.newValue,
      correlationId: ctx.correlationId,
    } });
    if (command.event) {
      await tx.outboxEvent.create({ data: {
        organizationId: ctx.organizationId,
        type: command.event,
        payload: { objectType: command.objectType, objectId: command.objectId, action: command.action },
      } });
    }
    return change.result;
  });
}

/** Legacy call sites are migrated to auditedCommand one workflow at a time. */
export async function mutate<T>(
  ctx: RequestContext,
  action: string,
  objectType: string,
  objectId: string,
  run: () => Promise<T>,
  extra?: { oldValue?: object; newValue?: object; event?: string },
) {
  const result = await run();
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action,
    objectType,
    objectId,
    oldValue: extra?.oldValue,
    newValue: extra?.newValue ?? (result as object),
    correlationId: ctx.correlationId,
  });
  if (extra?.event) {
    await writeOutbox(ctx.organizationId, extra.event, { objectType, objectId, action });
  }
  return result;
}
