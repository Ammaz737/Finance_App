import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../platform/auth";
import { spend, cards, expenses, receipts } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";
import { ingestDocument } from "../engines/documents";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let entityId = "";
let requesterId = "";
let approverId = "";
let programId = "";
let sharedExpenseId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [entityId],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "m4-session",
    correlationId: `m4-${suffix}`,
    ...partial,
  };
}

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

async function clearCardSpend(label: string, amount: string) {
  const requester = ctx({ userId: requesterId, organizationId: orgId });
  const approver = ctx({ userId: approverId, organizationId: orgId, permissions: ["*", "card.issue"] });
  const request = await spend.createRequest(requester, {
    programId,
    name: `${label} ${suffix}`,
    amount,
    currency: "USD",
    legalEntityId: entityId,
  });
  const approved = await spend.approveRequest(approver, request.id);
  expect(approved.card).toBeTruthy();
  expect(approved.card?.merchantLock).toBeNull();
  const auth = await cards.authorize(approver, {
    cardId: approved.card!.id,
    amount,
    currency: "USD",
    merchant: "BestBuy",
    merchantCategory: "electronics",
    idempotencyKey: `m4-${label}-${suffix}-${amount}`,
  });
  expect(auth.decision).toBe("APPROVED");
  const txnId = (auth as { transactionId?: string }).transactionId;
  expect(txnId).toBeTruthy();
  const cleared = await cards.clear(approver, txnId!);
  return { approved, txnId: txnId!, cleared };
}

describe.runIf(runDb)("M4 receipts and expenses", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `M4 ${suffix}`, slug: `m4-${suffix}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({ data: { organizationId: org.id, name: "M4 US", country: "US", currency: "USD" } });
    entityId = entity.id;
    const [requester, approver] = await Promise.all([
      prisma.user.create({ data: { organizationId: org.id, email: `req.${suffix}@m4.test`, passwordHash, firstName: "Req", lastName: "User", status: "ACTIVE" } }),
      prisma.user.create({ data: { organizationId: org.id, email: `apr.${suffix}@m4.test`, passwordHash, firstName: "Apr", lastName: "User", status: "ACTIVE" } }),
    ]);
    requesterId = requester.id;
    approverId = approver.id;
    const role = await prisma.role.create({ data: { organizationId: org.id, name: "Owner" } });
    let star = await prisma.permission.findUnique({ where: { key: "*" } });
    if (!star) star = await prisma.permission.create({ data: { key: "*", label: "*" } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: star.id, scope: "ORGANIZATION" } });
    await prisma.userRole.createMany({
      data: [
        { organizationId: org.id, userId: requester.id, roleId: role.id },
        { organizationId: org.id, userId: approver.id, roleId: role.id },
      ],
    });
    const budget = await prisma.budget.create({
      data: { organizationId: org.id, legalEntityId: entity.id, name: "Ops", amount: 10000, currency: "USD", ownerId: approver.id },
    });
    const program = await prisma.spendProgram.create({
      data: {
        organizationId: org.id, legalEntityId: entity.id, name: "Tools",
        maxAmount: 2000, currency: "USD", budgetId: budget.id,
        defaultFulfillmentType: "VIRTUAL_CARD", defaultValidDays: 30,
        merchantLockDefault: null,
      },
    });
    programId = program.id;
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    await prisma.expenseSplit.deleteMany({ where: { organizationId: orgId } });
    await prisma.expense.deleteMany({ where: { organizationId: orgId } });
    await prisma.receipt.deleteMany({ where: { organizationId: orgId } });
    await prisma.accountingEntry.deleteMany({ where: { organizationId: orgId } });
    await prisma.aiRecommendation.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await prisma.txn.deleteMany({ where: { organizationId: orgId } });
    await prisma.cardAuthorization.deleteMany({ where: { organizationId: orgId } });
    await prisma.ledgerEntry.deleteMany({ where: { organizationId: orgId } });
    await prisma.ledgerTransaction.deleteMany({ where: { organizationId: orgId } });
    await prisma.inboxItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.approvalAction.deleteMany({ where: { instanceId: { in: (await prisma.approvalInstance.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((i) => i.id) } } });
    await prisma.approvalInstance.deleteMany({ where: { organizationId: orgId } });
    await prisma.attachment.deleteMany({ where: { organizationId: orgId } });
    await prisma.card.deleteMany({ where: { organizationId: orgId } });
    await prisma.fund.deleteMany({ where: { organizationId: orgId } });
    await prisma.spendRequest.deleteMany({ where: { organizationId: orgId } });
    await prisma.spendProgram.deleteMany({ where: { organizationId: orgId } });
    await prisma.budget.deleteMany({ where: { organizationId: orgId } });
    await prisma.auditEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.outboxEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.userRole.deleteMany({ where: { organizationId: orgId } });
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: (await prisma.role.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((r) => r.id) } } });
    await prisma.role.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.legalEntity.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it("clears once into a single expense and accounting source owned by the cardholder", async () => {
    process.env.NODE_ENV = "development";
    const { txnId, cleared } = await clearCardSpend("Laptop", "120.00");
    expect(cleared.expense?.userId).toBe(requesterId);
    sharedExpenseId = cleared.expense!.id;

    const approver = ctx({ userId: approverId, organizationId: orgId, permissions: ["*", "card.issue"] });
    const second = await cards.clear(approver, txnId);
    expect(second.expense?.id).toBe(cleared.expense?.id);

    const expenseRows = await prisma.expense.findMany({ where: { organizationId: orgId, transactionId: txnId } });
    expect(expenseRows).toHaveLength(1);
    const accounting = await prisma.accountingEntry.findMany({
      where: { organizationId: orgId, sourceType: "CARD_TRANSACTION", sourceId: txnId },
    });
    expect(accounting).toHaveLength(1);
  });

  it("blocks submit without receipt, then allows submit after receipt link", async () => {
    process.env.NODE_ENV = "development";
    if (!sharedExpenseId) {
      const created = await clearCardSpend("ReceiptGate", "90.00");
      sharedExpenseId = created.cleared.expense!.id;
    }
    const requester = ctx({ userId: requesterId, organizationId: orgId, permissions: ["*", "expense.create"] });
    await expenses.updateMemo(requester, sharedExpenseId, { memo: "Engineering gear" });
    await expect(expenses.submit(requester, sharedExpenseId)).rejects.toMatchObject({ code: "EXPENSE_POLICY_BLOCK" });

    const attachment = await ingestDocument(requester, tinyPng(), {
      name: `amazon-89.50-${suffix}.png`,
      mimeType: "image/png",
      classification: "RECEIPT",
    });
    const receipt = await receipts.createFromAttachment(requester, {
      attachmentId: attachment.id,
      expenseId: sharedExpenseId,
    });
    expect(receipt.matchStatus).toBe("MATCHED");
    expect(receipt.ocrStatus).toBe("COMPLETED");
    expect(receipt.merchantGuess).toBeTruthy();

    const submitted = await expenses.submit(requester, sharedExpenseId);
    expect(["SUBMITTED", "IN_REVIEW"]).toContain(submitted.expense.status);
    expect(submitted.expense.receiptId).toBe(receipt.id);
  });

  it("keeps transactional splits balanced with org scope", async () => {
    process.env.NODE_ENV = "development";
    const created = await clearCardSpend("Splits", "80.00");
    const expenseId = created.cleared.expense!.id;
    const requester = ctx({ userId: requesterId, organizationId: orgId, permissions: ["*", "expense.create"] });

    await expect(expenses.split(requester, expenseId, [
      { amount: "10.00", category: "HW" },
    ])).rejects.toMatchObject({ code: "SPLIT_IMBALANCE" });

    const rows = await expenses.split(requester, expenseId, [
      { amount: "50.00", category: "HW", department: "Eng" },
      { amount: "30.00", category: "SHIPPING" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.organizationId === orgId)).toBe(true);
  });
});
