import { prisma } from "../../database/client";
import { fileStorage } from "../../platform/storage";
import type { RequestContext } from "../../platform/auth/context";
import { AppError } from "../../platform/http";
import { scopedWhere } from "../../platform/resource-access";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Serve uploaded evidence only through the access scope of its parent record. */
export async function getDocumentContent(ctx: RequestContext, id: string) {
  const file = await prisma.attachment.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!file) throw new AppError("NOT_FOUND", "Document not found", 404);
  let allowed = file.createdBy === ctx.userId || ctx.roles.includes("Owner") || ctx.permissions.includes("*");
  const scope = async (resource: string) => {
    try { return await scopedWhere(ctx, resource); }
    catch (error) { if (error instanceof AppError && error.code === "FORBIDDEN") return null; throw error; }
  };
  const linked = await prisma.receipt.findMany({ where: { organizationId: ctx.organizationId, attachmentId: id } });
  if (!allowed && linked.length) {
    const expenseScope = await scope("expenses");
    if (expenseScope) allowed = Boolean(await prisma.expense.findFirst({ where: { AND: [expenseScope, {
      OR: [{ receiptId: { in: linked.map(r => r.id) } }, { id: { in: linked.flatMap(r => r.expenseId ? [r.expenseId] : []) } }],
    }] } }));
    if (!allowed) {
      const reimbursementScope = await scope("reimbursements");
      if (reimbursementScope) allowed = Boolean(await prisma.reimbursement.findFirst({ where: { AND: [reimbursementScope, { receiptId: { in: linked.map(r => r.id) } }] } }));
    }
  }
  if (!allowed) {
    const billScope = await scope("bills");
    if (billScope) allowed = Boolean(await prisma.bill.findFirst({ where: { AND: [billScope, { attachmentId: id }] } }));
  }
  if (!allowed) throw new AppError("FORBIDDEN", "You cannot view this document", 403);
  if (file.malwareStatus !== "CLEAN") throw new AppError("ATTACHMENT_QUARANTINED", "Document is awaiting a clean security scan", 409);
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.mimeType)) throw new AppError("UNSUPPORTED_DOCUMENT", "Unsupported document type", 400);
  return { id: file.id, name: file.originalName, mimeType: file.mimeType, contentBase64: (await fileStorage.get(file.storagePath)).toString("base64") };
}
export type DocumentClassification = "RECEIPT" | "INVOICE" | "VENDOR_DOCUMENT";

export function validateDocument(file: Buffer, meta: { name: string; mimeType: string; classification: DocumentClassification }) {
  if (!file.length || file.length > MAX_DOCUMENT_BYTES) throw new AppError("INVALID_DOCUMENT_SIZE", "Document must be between 1 byte and 5 MB", 400);
  if (!meta.name || meta.name.length > 255 || /[\\/\x00-\x1f]/.test(meta.name)) throw new AppError("INVALID_DOCUMENT_NAME", "Document name is invalid", 400);
  const signatures: Record<string, boolean> = {
    "application/pdf": file.subarray(0, 5).toString("ascii") === "%PDF-",
    "image/png": file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff,
  };
  if (!signatures[meta.mimeType]) throw new AppError("UNSUPPORTED_DOCUMENT", "Upload a PDF, PNG, or JPEG with matching file content", 400);
}

export async function ingestDocument(ctx: RequestContext, file: Buffer, meta: { name: string; mimeType: string; classification: DocumentClassification }) {
  validateDocument(file, meta);
  const stored = await fileStorage.upload(file, meta);
  return prisma.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({ data: {
      organizationId: ctx.organizationId,
      originalName: meta.name,
      storedName: stored.storedName,
      mimeType: meta.mimeType,
      size: stored.size,
      checksum: stored.checksum,
      storagePath: stored.storagePath,
      classification: meta.classification,
      malwareStatus: "QUARANTINED",
      createdBy: ctx.userId,
    } });
    await tx.auditEvent.create({ data: {
      organizationId: ctx.organizationId, actorId: ctx.userId, action: "document.upload",
      objectType: "Attachment", objectId: attachment.id,
      newValue: { classification: meta.classification, mimeType: meta.mimeType, size: stored.size, malwareStatus: "QUARANTINED" },
      correlationId: ctx.correlationId,
    } });
    await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "document.quarantined", payload: { attachmentId: attachment.id } } });
    return attachment;
  });
}
