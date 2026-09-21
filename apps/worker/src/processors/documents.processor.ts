import type { PrismaClient } from "@prisma/client";

type ScanResult = { status: "CLEAN" | "INFECTED" | "ERROR" | "SKIPPED"; engine: string; detail?: string };

function scanAttachment(): ScanResult {
  if (process.env.NODE_ENV === "production" && process.env.FEATURE_SANDBOX_DOCUMENT_SCAN !== "true") {
    return {
      status: "SKIPPED",
      engine: "quarantine-only",
      detail: "No malware scanner configured; attachment remains quarantined",
    };
  }
  return {
    status: "CLEAN",
    engine: "sandbox-clean",
    detail: "Sandbox acknowledgment only; not a certified malware engine",
  };
}

/**
 * Document quarantine processor.
 * Production without a configured engine keeps QUARANTINED.
 * Local/sandbox acknowledges CLEAN so receipt OCR can run.
 */
export async function processDocumentQuarantineJob(
  prisma: PrismaClient,
  data: { attachmentId?: string; objectId?: string },
): Promise<void> {
  const attachmentId = data.attachmentId ?? data.objectId;
  if (!attachmentId) throw new Error("Document job has no attachment ID");
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.malwareStatus === "CLEAN" || attachment.malwareStatus === "INFECTED") return;

  const scan = scanAttachment();
  const malwareStatus = scan.status === "CLEAN" ? "CLEAN"
    : scan.status === "INFECTED" ? "INFECTED"
      : "QUARANTINED";

  await prisma.$transaction(async (tx) => {
    await tx.attachment.update({
      where: { id: attachment.id },
      data: { malwareStatus },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: attachment.organizationId,
        actorType: "SYSTEM",
        action: "document.scan",
        objectType: "Attachment",
        objectId: attachment.id,
        newValue: { malwareStatus, scan },
      },
    });
    if (malwareStatus === "CLEAN" && attachment.classification === "RECEIPT") {
      await tx.outboxEvent.create({
        data: {
          organizationId: attachment.organizationId,
          type: "receipt.ocr_requested",
          payload: { attachmentId: attachment.id },
        },
      });
    }
    if (malwareStatus === "CLEAN" && attachment.classification === "INVOICE") {
      await tx.outboxEvent.create({
        data: {
          organizationId: attachment.organizationId,
          type: "invoice.ocr_requested",
          payload: { attachmentId: attachment.id },
        },
      });
    }
  });
}
