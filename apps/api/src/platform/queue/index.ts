import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../../config/env";
import { prisma } from "../../database/client";

const connection = { url: env.redisUrl };

export const queues = {
  documents: new Queue("documents", { connection }),
  ocr: new Queue("ocr", { connection }),
  notifications: new Queue("notifications", { connection }),
  accountingSync: new Queue("accounting-sync", { connection }),
  payments: new Queue("payments", { connection }),
  webhooks: new Queue("webhooks", { connection }),
  ai: new Queue("ai", { connection }),
  events: new Queue("events", { connection }),
};

const redis = new IORedis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

export async function getWorkerDiagnostics() {
  if (redis.status === "wait") await redis.connect();
  const [pong, heartbeat, pending, retrying, dead, oldest, queueCounts] = await Promise.all([
    redis.ping(),
    redis.get("finance:worker:heartbeat"),
    prisma.outboxEvent.count({ where: { publishedAt: null, deadLetterAt: null } }),
    prisma.outboxEvent.count({ where: { publishedAt: null, deadLetterAt: null, attempts: { gt: 0 } } }),
    prisma.outboxEvent.count({ where: { deadLetterAt: { not: null } } }),
    prisma.outboxEvent.findFirst({ where: { publishedAt: null, deadLetterAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    Promise.all(Object.entries(queues).map(async ([name, queue]) => ({ name, counts: await queue.getJobCounts("wait", "active", "delayed", "failed") }))),
  ]);
  const heartbeatAgeMs = heartbeat ? Date.now() - new Date(heartbeat).getTime() : null;
  return {
    status: pong === "PONG" && heartbeatAgeMs !== null && heartbeatAgeMs < 15_000 ? "healthy" : "degraded",
    redis: pong,
    heartbeat,
    heartbeatAgeMs,
    outbox: {
      pending,
      retrying,
      dead,
      oldestAgeMs: oldest ? Date.now() - oldest.createdAt.getTime() : 0,
    },
    queues: queueCounts,
  };
}

export async function enqueue(queue: keyof typeof queues, name: string, data: object) {
  try {
    await queues[queue].add(name, data, { removeOnComplete: 100, attempts: 3 });
  } catch {
    // Redis is optional in local bootstrap; outbox remains source of truth.
  }
}
