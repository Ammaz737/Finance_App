import { Queue, Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { processSupportedEvent, queueForEvent, supportedEvents } from "./dispatch";
import { claimOutboxBatch, markOutboxFailure, markOutboxPublished } from "./outbox";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
const queues = new Map<string, Queue>();
const heartbeat = new IORedis(connection.url, { maxRetriesPerRequest: null });
const HEARTBEAT_KEY = "finance:worker:heartbeat";

async function publishOutbox() {
  const supportedTypes = Object.keys(supportedEvents);
  const pending = await claimOutboxBatch(prisma, 50, supportedTypes);
  for (const event of pending) {
    const name = queueForEvent(event.type);
    if (!name) {
      await markOutboxFailure(prisma, event.id, new Error(`No worker registered for ${event.type}`));
      continue;
    }
    try {
      const queue = queues.get(name);
      if (!queue) throw new Error(`Queue ${name} is unavailable`);
      await queue.add(event.type, event.payload, {
        jobId: event.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
      });
      await markOutboxPublished(prisma, event.id);
    } catch (error) {
      const outcome = await markOutboxFailure(prisma, event.id, error);
      console.error(`Outbox ${event.id} ${outcome}`, error);
    }
  }
}

async function main() {
  await prisma.$connect();
  for (const name of new Set(Object.values(supportedEvents))) {
    queues.set(name, new Queue(name, { connection }));
    new Worker(
      name,
      async (job) => {
        await processSupportedEvent(prisma, job.name, job.data);
      },
      { connection },
    );
  }
  setInterval(() => {
    void publishOutbox().catch((error: unknown) => console.error("Outbox dispatch failed", error));
  }, 2000);
  const beat = () => heartbeat.set(HEARTBEAT_KEY, new Date().toISOString(), "PX", 15_000);
  await beat();
  setInterval(() => void beat().catch((error: unknown) => console.error("Worker heartbeat failed", error)), 5_000);
  console.log("Worker listening for payments, accounting sync, documents, OCR, informational events, and outbox retry/DLQ");
}

void main();
