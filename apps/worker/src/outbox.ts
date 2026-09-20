import type { PrismaClient } from "@prisma/client";

const MAX_ATTEMPTS = 5;
const CLAIM_STALE_MS = 60_000;

export type OutboxClaim = {
  id: string;
  organizationId: string;
  type: string;
  payload: unknown;
  attempts: number;
};

export function planOutboxFailure(attempts: number): {
  nextAttempts: number;
  dead: boolean;
  backoffMs: number;
} {
  const nextAttempts = attempts + 1;
  return {
    nextAttempts,
    dead: nextAttempts >= MAX_ATTEMPTS,
    backoffMs: Math.min(60_000, 2_000 * 2 ** Math.max(0, nextAttempts - 1)),
  };
}

export async function claimOutboxBatch(prisma: PrismaClient, limit = 50, types?: string[]): Promise<OutboxClaim[]> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS);
  const candidates = await prisma.outboxEvent.findMany({
    where: {
      publishedAt: null,
      deadLetterAt: null,
      availableAt: { lte: now },
      ...(types?.length ? { type: { in: types } } : {}),
      OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const claimed: OutboxClaim[] = [];
  for (const event of candidates) {
    const result = await prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        publishedAt: null,
        deadLetterAt: null,
        availableAt: { lte: now },
        OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
      },
      data: { claimedAt: now },
    });
    if (result.count === 1) {
      claimed.push({
        id: event.id,
        organizationId: event.organizationId,
        type: event.type,
        payload: event.payload,
        attempts: event.attempts,
      });
    }
  }
  return claimed;
}

export async function markOutboxPublished(prisma: PrismaClient, id: string): Promise<void> {
  await prisma.outboxEvent.updateMany({
    where: { id, publishedAt: null },
    data: { publishedAt: new Date(), claimedAt: null, lastError: null },
  });
}

export async function markOutboxFailure(prisma: PrismaClient, id: string, error: unknown): Promise<"retry" | "dead"> {
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown outbox failure";
  const event = await prisma.outboxEvent.findUnique({ where: { id } });
  if (!event || event.publishedAt) return "retry";
  const plan = planOutboxFailure(event.attempts);
  if (plan.dead) {
    await prisma.outboxEvent.update({
      where: { id },
      data: { attempts: plan.nextAttempts, lastError: message, deadLetterAt: new Date(), claimedAt: null },
    });
    return "dead";
  }
  await prisma.outboxEvent.update({
    where: { id },
    data: {
      attempts: plan.nextAttempts,
      lastError: message,
      availableAt: new Date(Date.now() + plan.backoffMs),
      claimedAt: null,
    },
  });
  return "retry";
}

export { MAX_ATTEMPTS };
