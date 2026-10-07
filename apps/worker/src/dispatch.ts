import type { PrismaClient } from "@prisma/client";
import { processPaymentsJob, processReimbursementPayoutJob } from "./processors/payments.processor";
import { processAccountingSyncJob } from "./processors/accounting-sync.processor";
import { processDocumentQuarantineJob } from "./processors/documents.processor";
import { processOcrJob } from "./processors/ocr.processor";
import { allEventTypes, eventDefinition } from "./event-catalog";
import { processQuickBooksWebhook } from "./integrations/quickbooks";

export const supportedEvents = Object.fromEntries(
  allEventTypes.map((type) => [type, eventDefinition(type)!.queue]),
) as Record<string, string>;

export function queueForEvent(type: string): string | null {
  return eventDefinition(type)?.queue ?? null;
}

export async function processSupportedEvent(
  prisma: PrismaClient,
  type: string,
  payload: unknown,
): Promise<void> {
  const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};

  if (type === "payment.released") {
    await processPaymentsJob(prisma, data as { paymentId?: string; objectId?: string });
    return;
  }
  if (type === "reimbursement.scheduled") {
    await processReimbursementPayoutJob(prisma, data as { reimbursementId?: string; objectId?: string });
    return;
  }
  if (type === "accounting.sync_requested") {
    await processAccountingSyncJob(prisma, data as { jobId?: string; entryIds?: string[] });
    return;
  }
  if (type === "quickbooks.webhook_received") {
    const webhookEventId = typeof data.webhookEventId === "string" ? data.webhookEventId : "";
    const connectionId = typeof data.connectionId === "string" ? data.connectionId : "";
    if (!webhookEventId || !connectionId) throw new Error("QuickBooks webhook job is incomplete");
    await processQuickBooksWebhook(prisma, webhookEventId, connectionId);
    return;
  }
  if (type === "document.quarantined") {
    await processDocumentQuarantineJob(prisma, data as { attachmentId?: string; objectId?: string });
    return;
  }
  if (type === "receipt.ocr_requested") {
    await processOcrJob(prisma, data as { attachmentId?: string; receiptId?: string; objectId?: string });
    return;
  }
  if (type === "invoice.ocr_requested") {
    await processOcrJob(prisma, { ...(data as { attachmentId?: string; objectId?: string }), purpose: "invoice" });
    return;
  }

  const definition = eventDefinition(type);
  if (definition?.classification === "informational" || definition?.classification === "deprecated") return;

  throw new Error(`No worker registered for ${type}`);
}
