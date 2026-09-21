import type { PrismaClient } from "@prisma/client";

/** Deterministic sandbox OCR processor — never claims a live vendor result. */
export async function processOcrJob(
  prisma: PrismaClient,
  data: { attachmentId?: string; receiptId?: string; objectId?: string; purpose?: string },
): Promise<void> {
  let attachmentId = data.attachmentId ?? data.objectId;
  if (data.receiptId) {
    const linked = await prisma.receipt.findUnique({ where: { id: data.receiptId } });
    attachmentId = linked?.attachmentId ?? attachmentId;
  }
  if (!attachmentId) throw new Error("OCR job has no attachment or receipt ID");

  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new Error("OCR job attachment not found");
  if (attachment.malwareStatus !== "CLEAN") return;

  if (attachment.classification === "INVOICE" || data.purpose === "invoice") {
    await processInvoiceOcr(prisma, attachment.id);
    return;
  }

  const receipt = data.receiptId
    ? await prisma.receipt.findUnique({ where: { id: data.receiptId } })
    : await prisma.receipt.findFirst({ where: { attachmentId: attachment.id } });

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
    sandbox: true,
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

export async function processInvoiceOcr(prisma: PrismaClient, attachmentId: string): Promise<void> {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.malwareStatus !== "CLEAN") return;
  if (attachment.ocrStatus === "COMPLETED") return;

  const base = attachment.originalName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const amountMatch = attachment.originalName.match(/(\d+(?:\.\d{1,2})?)/);
  const invoiceMatch = attachment.originalName.match(/(INV[-\s]?\w+)/i);
  const payload = {
    engine: "mock-ocr",
    confidence: 0.72,
    sandbox: true,
    label: "SANDBOX / MOCK OCR",
    vendorGuess: base.replace(/\d+(?:\.\d{1,2})?/g, "").replace(/inv.*/i, "").trim() || "Unknown vendor",
    invoiceNumberGuess: invoiceMatch?.[1]?.replace(/\s+/g, "-").toUpperCase() ?? `INV-OCR-${attachment.id.slice(0, 6)}`,
    amountGuess: amountMatch?.[1] ?? "100.00",
    taxGuess: null,
    currencyGuess: "USD",
    invoiceDateGuess: new Date().toISOString().slice(0, 10),
    dueDateGuess: null,
    lineItemsGuess: [{ description: base || "Invoice line", amount: amountMatch?.[1] ?? "100.00" }],
  };

  await prisma.$transaction(async (tx) => {
    await tx.attachment.update({
      where: { id: attachment.id },
      data: { ocrStatus: "COMPLETED", ocrPayload: payload },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: attachment.organizationId,
        actorType: "SYSTEM",
        action: "invoice.ocr",
        objectType: "Attachment",
        objectId: attachment.id,
        newValue: payload,
      },
    });
    await tx.outboxEvent.create({
      data: {
        organizationId: attachment.organizationId,
        type: "invoice.ocr_completed",
        payload: { attachmentId: attachment.id, confidence: payload.confidence, sandbox: true },
      },
    });
  });
}
