import type { PrismaClient } from "@prisma/client";

/** Deterministic sandbox OCR processor — never claims a live vendor result. */
export async function processOcrJob(
  prisma: PrismaClient,
  data: { attachmentId?: string; receiptId?: string; objectId?: string },
): Promise<void> {
  const attachmentId = data.attachmentId ?? data.objectId;
  if (!attachmentId && !data.receiptId) throw new Error("OCR job has no attachment or receipt ID");

  const receipt = data.receiptId
    ? await prisma.receipt.findUnique({ where: { id: data.receiptId } })
    : await prisma.receipt.findFirst({ where: { attachmentId: attachmentId! } });

  const attachment = await prisma.attachment.findUnique({
    where: { id: receipt?.attachmentId ?? attachmentId! },
  });
  if (!attachment) throw new Error("OCR job attachment not found");
  if (attachment.malwareStatus !== "CLEAN") return;

  const base = attachment.originalName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const merchantGuess = base || "Unknown merchant";
  const amountMatch = attachment.originalName.match(/(\d+(?:\.\d{1,2})?)/);
  const amountGuess = amountMatch?.[1] ?? null;
  const payload = {
    engine: "mock-ocr",
    confidence: 0.72,
    merchantGuess,
    amountGuess,
    currencyGuess: "USD",
  };

  await prisma.$transaction(async (tx) => {
    let target = receipt;
    if (!target) {
      target = await tx.receipt.create({
        data: {
          organizationId: attachment.organizationId,
          attachmentId: attachment.id,
          merchantGuess,
          amountGuess: amountGuess ? amountGuess : null,
          matchStatus: "UNMATCHED",
          ocrStatus: "COMPLETED",
          ocrPayload: payload,
        },
      });
    } else {
      target = await tx.receipt.update({
        where: { id: target.id },
        data: {
          merchantGuess,
          amountGuess: amountGuess ? amountGuess : null,
          ocrStatus: "COMPLETED",
          ocrPayload: payload,
        },
      });
    }
    await tx.auditEvent.create({
      data: {
        organizationId: attachment.organizationId,
        actorType: "SYSTEM",
        action: "receipt.ocr",
        objectType: "Receipt",
        objectId: target.id,
        newValue: payload,
      },
    });
  });
}
