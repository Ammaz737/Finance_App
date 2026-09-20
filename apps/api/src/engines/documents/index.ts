import { prisma } from "../../database/client";
import { fileStorage } from "../../platform/storage";
import type { RequestContext } from "../../platform/auth/context";
import { AppError } from "../../platform/http";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
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
