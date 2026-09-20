import { PrismaClient } from "@prisma/client";

function mockExternalId(entryId: string, existing?: string | null) {
  return existing?.trim() || `qbo_${entryId}`;
}

/** Applies mock ERP ack. Retries reuse the same externalId and never create a second posting. */
export async function processAccountingSyncJob(
  prisma: PrismaClient,
  data: { jobId?: string; entryIds?: string[] },
): Promise<void> {
  if (!data.jobId) throw new Error("Accounting sync job is incomplete");
  const job = await prisma.syncJob.findUnique({ where: { id: data.jobId } });
  if (!job || job.status === "COMPLETED" || job.status === "COMPLETED_WITH_ERRORS") return;
  if (job.provider !== "MOCK_QBO" || process.env.NODE_ENV === "production") {
    throw new Error(`Accounting adapter ${job.provider} is not configured for this environment`);
  }

  const entryIds = Array.isArray(job.entryIds) && (job.entryIds as unknown[]).length
    ? (job.entryIds as unknown[]).map(String)
    : (data.entryIds ?? []);
  if (!entryIds.length) throw new Error("Accounting sync job has no entries");

  const claim = await prisma.syncJob.updateMany({
    where: { id: job.id, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "PROCESSING" },
  });
  if (claim.count !== 1 && job.status !== "PROCESSING") return;

  let successCount = 0;
  let failureCount = 0;

  for (const entryId of entryIds) {
    const entry = await prisma.accountingEntry.findFirst({
      where: { id: entryId, organizationId: job.organizationId },
    });
    if (!entry) {
      failureCount += 1;
      continue;
    }
    try {
      if (entry.status === "SYNCED" && entry.externalId) {
        await prisma.syncAttempt.create({
          data: {
            organizationId: job.organizationId,
            syncJobId: job.id,
            entryId,
            status: "SKIPPED",
            externalId: entry.externalId,
          },
        });
        successCount += 1;
        continue;
      }
      const externalId = mockExternalId(entry.id, entry.externalId);
      const updated = await prisma.accountingEntry.updateMany({
        where: {
          id: entryId,
          organizationId: job.organizationId,
          status: { in: ["SYNCING", "SYNC_ERROR", "READY_TO_SYNC"] },
        },
        data: {
          status: "SYNCED",
          externalId,
          syncedAt: new Date(),
          syncError: null,
          syncAttemptCount: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        const current = await prisma.accountingEntry.findUniqueOrThrow({ where: { id: entryId } });
        if (current.status === "SYNCED" && current.externalId === externalId) {
          successCount += 1;
          await prisma.syncAttempt.create({
            data: {
              organizationId: job.organizationId,
              syncJobId: job.id,
              entryId,
              status: "REUSED",
              externalId,
            },
          });
          continue;
        }
        throw new Error("Entry changed during sync");
      }
      await prisma.syncAttempt.create({
        data: {
          organizationId: job.organizationId,
          syncJobId: job.id,
          entryId,
          status: entry.externalId ? "REUSED" : "SUCCEEDED",
          externalId,
        },
      });
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : "Sync failed";
      await prisma.accountingEntry.updateMany({
        where: { id: entryId, organizationId: job.organizationId, status: { in: ["SYNCING", "READY_TO_SYNC"] } },
        data: { status: "SYNC_ERROR", syncError: message, syncAttemptCount: { increment: 1 } },
      });
      await prisma.syncAttempt.create({
        data: {
          organizationId: job.organizationId,
          syncJobId: job.id,
          entryId,
          status: "FAILED",
          error: message,
        },
      });
    }
  }

  const finalStatus = failureCount === 0 ? "COMPLETED" : successCount === 0 ? "FAILED" : "COMPLETED_WITH_ERRORS";
  await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      successCount,
      failureCount,
      completedAt: new Date(),
      error: failureCount ? `${failureCount} entr${failureCount === 1 ? "y" : "ies"} failed` : null,
    },
  });
  await prisma.outboxEvent.create({
    data: {
      organizationId: job.organizationId,
      type: "accounting.synced",
      payload: { jobId: job.id, successCount, failureCount },
    },
  });
}
