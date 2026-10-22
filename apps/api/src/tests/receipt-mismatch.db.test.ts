import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../database/client";
import { getDocumentContent } from "../engines/documents";
import { getInboxTaskDetail } from "../engines/inbox";
import { fileStorage } from "../platform/storage";
import { startApproval } from "../engines/workflow";
import { expenses, receipts } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";

describe.runIf(process.env.RUN_DB_TESTS !== "0")("receipt mismatch regression", () => {
  let ctx: RequestContext, orgId: string, expenseId: string, receiptId: string;
  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Receipt regression", slug: `receipt-regression-${Date.now()}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({ data: { organizationId: orgId, name: "Test US", country: "US", currency: "USD" } });
    const user = await prisma.user.create({ data: { organizationId: orgId, email: `receipt-${Date.now()}@test.invalid`, passwordHash: "unused", firstName: "Test", lastName: "Employee" } });
    ctx = { actorType: "INTERNAL_USER", organizationId: orgId, userId: user.id, entityIds: [entity.id], roles: ["Owner"], permissions: ["*"], grants: [{ permission: "*", scope: "ORGANIZATION", entityId: null }], entitlements: [], sessionId: "test", correlationId: "receipt-test" };
    const expense = await prisma.expense.create({ data: { organizationId: orgId, legalEntityId: entity.id, userId: user.id, amount: "250", currency: "USD", merchant: "OpenAI", memo: "Subscription" } });
    expenseId = expense.id;
    const attachment = await prisma.attachment.create({ data: { organizationId: orgId, originalName: "furniture_invoice_100_usd.pdf", storedName: "test.pdf", mimeType: "application/pdf", size: 1, checksum: "test", storagePath: "unused-test-file", classification: "RECEIPT", malwareStatus: "CLEAN", createdBy: user.id } });
    const receipt = await receipts.createFromAttachment(ctx, { attachmentId: attachment.id, expenseId });
    receiptId = receipt.id;
    expect(receipt.matchStatus).toBe("MISMATCH");
  });
  afterAll(async () => {
    if (!orgId) return;
    await prisma.approvalAction.deleteMany({ where: { instanceId: { in: (await prisma.approvalInstance.findMany({ where: { organizationId: orgId } })).map(i => i.id) } } });
    for (const delegate of [prisma.inboxItem, prisma.approvalInstance, prisma.aiRecommendation, prisma.expense, prisma.receipt, prisma.attachment, prisma.auditEvent, prisma.outboxEvent, prisma.user, prisma.legalEntity] as any[]) await delegate.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } });
  });
  it("does not turn an explicit mismatched link into a match", async () => {
    expect((await receipts.link(ctx, receiptId, { expenseId })).matchStatus).toBe("MISMATCH");
  });
  it("blocks submit and approval even when a legacy receipt says MATCHED", async () => {
    await prisma.receipt.update({ where: { id: receiptId }, data: { matchStatus: "MATCHED" } });
    await expect(expenses.submit(ctx, expenseId)).rejects.toMatchObject({ code: "RECEIPT_MISMATCH" });
    await prisma.expense.update({ where: { id: expenseId }, data: { status: "SUBMITTED" } });
    await expect(expenses.approve(ctx, expenseId)).rejects.toMatchObject({ code: "RECEIPT_MISMATCH" });
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).status).toBe("SUBMITTED");
  });
  it("shows the mismatch and incomplete receipt requirement on existing records", async () => {
    const detail = await expenses.getDetail(ctx, expenseId);
    expect(detail.receipt?.matchStatus).toBe("MISMATCH");
    expect(detail.requirements.complete).toBe(false);
    expect((await receipts.withMatchStatus(await prisma.receipt.findMany({ where: { organizationId: orgId } })))[0].matchStatus).toBe("MISMATCH");
  });
  it("accepts corrected extracted amount and merchant", async () => {
    await prisma.receipt.update({ where: { id: receiptId }, data: { amountGuess: "250", merchantGuess: "OpenAI", ocrPayload: { currencyGuess: "USD" } } });
    expect((await receipts.link(ctx, receiptId, { expenseId })).matchStatus).toBe("MATCHED");
    expect((await expenses.getDetail(ctx, expenseId)).requirements.complete).toBe(true);
  });
  it("reopens a submitted mismatch for replacement and starts a fresh review on resubmit", async () => {
    await prisma.receipt.update({ where: { id: receiptId }, data: { amountGuess: "100", merchantGuess: "Furniture" } });
    await prisma.expense.update({ where: { id: expenseId }, data: { status: "SUBMITTED" } });
    const review = await startApproval({ organizationId: orgId, objectType: "expense", objectId: expenseId, requesterId: ctx.userId });
    const attachment = await prisma.attachment.create({ data: { organizationId: orgId, originalName: "OpenAI_250_usd.pdf", storedName: "replacement.pdf", mimeType: "application/pdf", size: 1, checksum: "replacement", storagePath: "unused-replacement", classification: "RECEIPT", malwareStatus: "CLEAN", createdBy: ctx.userId } });
    const replacement = await receipts.createFromAttachment(ctx, { attachmentId: attachment.id, expenseId });
    expect(replacement.matchStatus).toBe("MATCHED");
    const detail = await expenses.getDetail(ctx, expenseId);
    expect(detail.expense.status).toBe("INCOMPLETE");
    expect(detail.receipt?.id).toBe(replacement.id);
    expect((await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } })).expenseId).toBeNull();
    expect((await prisma.approvalInstance.findUniqueOrThrow({ where: { id: review.instance.id } })).status).toBe("CANCELED");
    expect((await prisma.inboxItem.findFirstOrThrow({ where: { approvalInstanceId: review.instance.id } })).status).toBe("DONE");
    await expenses.submit(ctx, expenseId);
    expect(await prisma.approvalInstance.count({ where: { organizationId: orgId, objectId: expenseId, status: "IN_REVIEW" } })).toBe(1);
  });

  it("shows the uploaded invoice to the assigned manager and protects file access", async () => {
    const record = await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: record.receiptId! } });
    const manager = await prisma.user.create({ data: { organizationId: orgId, email: `manager-${Date.now()}@test.invalid`, passwordHash: "unused", firstName: "Test", lastName: "Manager" } });
    await prisma.user.update({ where: { id: ctx.userId }, data: { managerId: manager.id } });
    const approver: RequestContext = { ...ctx, userId: manager.id, roles: ["Manager"], permissions: ["expense.approve"], grants: [{ permission: "expense.approve", scope: "DIRECT_REPORTS", entityId: record.legalEntityId }] };
    const instance = await prisma.approvalInstance.findFirstOrThrow({ where: { organizationId: orgId, objectId: expenseId, status: "IN_REVIEW" } });
    const task = await getInboxTaskDetail(approver, instance.id);
    expect(task.document?.id).toBe(receipt.attachmentId);
    expect(task.document?.name).toBe("OpenAI_250_usd.pdf");
    const storage = vi.spyOn(fileStorage, "get").mockResolvedValue(Buffer.from("%PDF-test"));
    try {
      expect((await getDocumentContent(approver, receipt.attachmentId)).contentBase64).toBe(Buffer.from("%PDF-test").toString("base64"));
      const unrelated: RequestContext = { ...approver, permissions: ["expense.read"], grants: [{ permission: "expense.read", scope: "SELF", entityId: record.legalEntityId }] };
      await expect(getDocumentContent(unrelated, receipt.attachmentId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getDocumentContent({ ...approver, organizationId: "other-tenant" }, receipt.attachmentId)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await prisma.attachment.update({ where: { id: receipt.attachmentId }, data: { malwareStatus: "QUARANTINED" } });
      await expect(getDocumentContent(approver, receipt.attachmentId)).rejects.toMatchObject({ code: "ATTACHMENT_QUARANTINED" });
      expect(storage).toHaveBeenCalledTimes(1);
    } finally { storage.mockRestore(); }
  });

});
