import { PrismaClient } from "@prisma/client";
import { postQuickBooksEntry } from "../integrations/quickbooks";

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
  if (job.provider !== "MOCK_QBO" && job.provider !== "QUICKBOOKS_ONLINE") {
    throw new Error(`Accounting adapter ${job.provider} is not configured for this environment`);
  }
  if (job.provider === "MOCK_QBO" && process.env.NODE_ENV === "production") {
    throw new Error("Mock accounting is not allowed in production");
  }

  const rawEntryIds = Array.isArray(job.entryIds) && (job.entryIds as unknown[]).length
    ? (job.entryIds as unknown[]).map(String)
    : (data.entryIds ?? []);
  if (!rawEntryIds.length) throw new Error("Accounting sync job has no entries");
  const dependencyOrder: Record<string, number> = { BILL: 0, CARD_TRANSACTION: 1, EXPENSE: 1, REIMBURSEMENT: 1, PAYMENT: 2 };
  const orderedEntries = await prisma.accountingEntry.findMany({
    where: { organizationId: job.organizationId, id: { in: rawEntryIds } },
    select: { id: true, sourceType: true },
  });
  const sourceTypeById = new Map(orderedEntries.map((entry) => [entry.id, entry.sourceType]));
  const entryIds = [...rawEntryIds].sort((left, right) =>
    (dependencyOrder[sourceTypeById.get(left) ?? ""] ?? 1) - (dependencyOrder[sourceTypeById.get(right) ?? ""] ?? 1));

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
      const providerResult = job.provider === "QUICKBOOKS_ONLINE"
        ? await postQuickBooksEntry(prisma, entry)
        : { externalId: mockExternalId(entry.id, entry.externalId), reused: Boolean(entry.externalId) };
      const externalId = providerResult.externalId;
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
          status: providerResult.reused ? "REUSED" : "SUCCEEDED",
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
