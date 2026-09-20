import { PrismaClient } from "@prisma/client";
import { processSupportedEvent, supportedEvents } from "./dispatch";
import { claimOutboxBatch, markOutboxFailure, markOutboxPublished } from "./outbox";

const prisma = new PrismaClient();

/**
 * Recovery command for local/on-prem environments where Redis is temporarily
 * unavailable. It uses the same claims, retry schedule and idempotent
 * processors as the continuous worker, but handles supported events inline.
 */
async function drainOnce(): Promise<number> {
  const pending = await claimOutboxBatch(prisma, 50, Object.keys(supportedEvents));
  let processed = 0;

  for (const event of pending) {
    try {
      await processSupportedEvent(prisma, event.type, event.payload);
      await markOutboxPublished(prisma, event.id);
      processed += 1;
      console.log(`Processed ${event.type} (${event.id})`);
    } catch (error) {
      const outcome = await markOutboxFailure(prisma, event.id, error);
      console.error(`Outbox ${event.id} ${outcome}`, error);
    }
  }

  return pending.length;
}

async function main(): Promise<void> {
  await prisma.$connect();
  let claimed = 0;
  do {
    claimed = await drainOnce();
  } while (claimed > 0);
}

void main()
  .catch((error: unknown) => {
    console.error("Outbox drain failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
