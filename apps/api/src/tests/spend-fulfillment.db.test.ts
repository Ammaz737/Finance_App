import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../platform/auth";
import { spend, cards } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let entityId = "";
let requesterId = "";
let approverId = "";
let programCardId = "";
let programFundId = "";
let budgetId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [entityId],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "m3-session",
    correlationId: `m3-${suffix}`,
    ...partial,
  };
}

function approvedTxnId(auth: { decision: string; transactionId?: string } | Record<string, unknown>) {
  const row = auth as { decision: string; transactionId?: string };
  expect(row.decision).toBe("APPROVED");
  expect(row.transactionId).toBeTruthy();
  return row.transactionId as string;
}

describe.runIf(runDb)("M3 spend fulfillment", () => {
  beforeAll(async () => {
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `M3 ${suffix}`, slug: `m3-${suffix}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({ data: { organizationId: org.id, name: "M3 US", country: "US", currency: "USD" } });
    entityId = entity.id;
    const [requester, approver] = await Promise.all([
      prisma.user.create({ data: { organizationId: org.id, email: `req.${suffix}@m3.test`, passwordHash, firstName: "Req", lastName: "User", status: "ACTIVE" } }),
      prisma.user.create({ data: { organizationId: org.id, email: `apr.${suffix}@m3.test`, passwordHash, firstName: "Apr", lastName: "User", status: "ACTIVE" } }),
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
      data: { organizationId: org.id, legalEntityId: entity.id, name: "Ops", amount: 5000, currency: "USD", ownerId: approver.id },
    });
    budgetId = budget.id;
    const cardProgram = await prisma.spendProgram.create({
      data: {
        organizationId: org.id, legalEntityId: entity.id, name: "Amazon Lock",
        maxAmount: 1000, currency: "USD", budgetId: budget.id,
        defaultFulfillmentType: "VIRTUAL_CARD", merchantLockDefault: "amazon", defaultValidDays: 30,
      },
    });
    const fundProgram = await prisma.spendProgram.create({
      data: {
        organizationId: org.id, legalEntityId: entity.id, name: "Fund Only",
        maxAmount: 1000, currency: "USD", defaultFulfillmentType: "FUND_ONLY",
      },
    });
    programCardId = cardProgram.id;
    programFundId = fundProgram.id;
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    await prisma.expense.deleteMany({ where: { organizationId: orgId } });
    await prisma.accountingEntry.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await prisma.txn.deleteMany({ where: { organizationId: orgId } });
    await prisma.cardAuthorization.deleteMany({ where: { organizationId: orgId } });
    await prisma.ledgerEntry.deleteMany({ where: { organizationId: orgId } });
    await prisma.ledgerTransaction.deleteMany({ where: { organizationId: orgId } });
    await prisma.inboxItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.approvalAction.deleteMany({ where: { instanceId: { in: (await prisma.approvalInstance.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((i) => i.id) } } });
    await prisma.approvalInstance.deleteMany({ where: { organizationId: orgId } });
    await prisma.card.deleteMany({ where: { organizationId: orgId } });
    await prisma.fund.deleteMany({ where: { organizationId: orgId } });
    await prisma.spendRequest.deleteMany({ where: { organizationId: orgId } });
    await prisma.spendProgram.deleteMany({ where: { organizationId: orgId } });
    await prisma.budget.deleteMany({ where: { organizationId: orgId } });
    await prisma.businessLimit.deleteMany({ where: { organizationId: orgId } });
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

  it("approves into one virtual card and rejects duplicate fulfillment", async () => {
    process.env.NODE_ENV = "development";
    const requester = ctx({ userId: requesterId, organizationId: orgId });
    const approver = ctx({ userId: approverId, organizationId: orgId });
    const request = await spend.createRequest(requester, {
      programId: programCardId,
      name: `Laptop ${suffix}`,
      purpose: "Engineering gear",
      amount: "100.00",
      currency: "USD",
      legalEntityId: entityId,
    });
    expect(request.fulfillmentType).toBe("VIRTUAL_CARD");
    expect(request.expiresAt).toBeTruthy();

    const first = await spend.approveRequest(approver, request.id);
    expect(first.request.status).toBe("FULFILLED");
    expect(first.fund).toBeTruthy();
    expect(first.card?.providerRef).toMatch(/^mock_/);
    expect(first.card?.merchantLock?.toLowerCase()).toBe("amazon");

    const funds = await prisma.fund.findMany({ where: { organizationId: orgId, spendRequestId: request.id } });
    const cardRows = await prisma.card.findMany({ where: { organizationId: orgId, fundId: first.fund!.id } });
    expect(funds).toHaveLength(1);
    expect(cardRows).toHaveLength(1);

    const budget = await prisma.budget.findUniqueOrThrow({ where: { id: budgetId } });
    expect(Number(budget.committedAmount)).toBeGreaterThanOrEqual(100);

    const again = await spend.approveRequest(approver, request.id);
    expect(again.request.status).toBe("FULFILLED");
    expect(again.fund?.id).toBe(first.fund!.id);
    expect(again.card?.id).toBe(first.card!.id);
    expect(await prisma.fund.count({ where: { organizationId: orgId, spendRequestId: request.id } })).toBe(1);
    expect(await prisma.card.count({ where: { organizationId: orgId, fundId: first.fund!.id } })).toBe(1);
  });

  it("fulfills FUND_ONLY without issuing a card", async () => {
    const requester = ctx({ userId: requesterId, organizationId: orgId });
    const approver = ctx({ userId: approverId, organizationId: orgId });
    const request = await spend.createRequest(requester, {
      programId: programFundId,
      name: `Stipend ${suffix}`,
      amount: "50.00",
      currency: "USD",
      legalEntityId: entityId,
    });
    expect(request.fulfillmentType).toBe("FUND_ONLY");
    const result = await spend.approveRequest(approver, request.id);
    expect(result.fund).toBeTruthy();
    expect(result.card).toBeNull();
    const cardsForFund = await prisma.card.findMany({ where: { organizationId: orgId, fundId: result.fund!.id } });
    expect(cardsForFund).toHaveLength(0);
  });

  it("declines authorization outside merchant lock", async () => {
    process.env.NODE_ENV = "development";
    const card = await prisma.card.findFirstOrThrow({
      where: { organizationId: orgId, merchantLock: { equals: "amazon", mode: "insensitive" } },
    });
    const owner = ctx({ userId: approverId, organizationId: orgId, permissions: ["*", "card.issue"] });
    const declined = await cards.authorize(owner, {
      cardId: card.id,
      amount: "10.00",
      currency: "USD",
      merchant: "Walmart",
      merchantCategory: "retail",
      idempotencyKey: `lock-${suffix}-${crypto.randomUUID()}`,
    });
    expect(declined.decision).toBe("DECLINED");
    expect(declined.reason).toBe("MERCHANT_LOCK");
  });

  it("runs request → approval → card → capture end-to-end", async () => {
    process.env.NODE_ENV = "development";
    const requester = ctx({ userId: requesterId, organizationId: orgId });
    const approver = ctx({ userId: approverId, organizationId: orgId, permissions: ["*", "card.issue"] });
    const request = await spend.createRequest(requester, {
      programId: programCardId,
      name: `Monitor ${suffix}`,
      purpose: "Desk setup",
      amount: "200.00",
      currency: "USD",
      legalEntityId: entityId,
    });
    const approved = await spend.approveRequest(approver, request.id);
    expect(approved.card).toBeTruthy();
    const fundBefore = await prisma.fund.findUniqueOrThrow({ where: { id: approved.fund!.id } });
    expect(Number(fundBefore.availableAmount)).toBe(200);

    const auth = await cards.authorize(approver, {
      cardId: approved.card!.id,
      amount: "80.00",
      currency: "USD",
      merchant: "Amazon Basics",
      merchantCategory: "retail",
      idempotencyKey: `e2e-auth-${suffix}`,
    });
    const holdId = approvedTxnId(auth);

    const fundHeld = await prisma.fund.findUniqueOrThrow({ where: { id: approved.fund!.id } });
    expect(Number(fundHeld.availableAmount)).toBe(120);

    const captured = await cards.capture(approver, holdId, { amount: "75.00" });
    expect(captured.transaction.status).toBe("CLEARED");
    expect(Number(captured.transaction.amount)).toBe(75);
    expect(captured.expense?.status).toBe("INCOMPLETE");

    const fundAfter = await prisma.fund.findUniqueOrThrow({ where: { id: approved.fund!.id } });
    expect(Number(fundAfter.availableAmount)).toBe(125); // 120 + 5 release from partial capture

    const budget = await prisma.budget.findUniqueOrThrow({ where: { id: budgetId } });
    expect(Number(budget.actualAmount)).toBeGreaterThanOrEqual(75);
  });

  it("voids a pending hold and restores fund capacity", async () => {
    process.env.NODE_ENV = "development";
    const card = await prisma.card.findFirstOrThrow({
      where: { organizationId: orgId, merchantLock: { equals: "amazon", mode: "insensitive" } },
    });
    const owner = ctx({ userId: approverId, organizationId: orgId, permissions: ["*", "card.issue"] });
    const fundBefore = await prisma.fund.findUniqueOrThrow({ where: { id: card.fundId } });
    const auth = await cards.authorize(owner, {
      cardId: card.id,
      amount: "12.00",
      currency: "USD",
      merchant: "Amazon",
      merchantCategory: "retail",
      idempotencyKey: `void-${suffix}`,
    });
    const voided = await cards.void(owner, approvedTxnId(auth));
    expect(voided.transaction.status).toBe("VOIDED");
    const fundAfter = await prisma.fund.findUniqueOrThrow({ where: { id: card.fundId } });
    expect(Number(fundAfter.availableAmount)).toBe(Number(fundBefore.availableAmount));
  });

  it("reverses a cleared transaction and cancels its expense", async () => {
    process.env.NODE_ENV = "development";
    const card = await prisma.card.findFirstOrThrow({
      where: { organizationId: orgId, merchantLock: { equals: "amazon", mode: "insensitive" } },
    });
    const owner = ctx({ userId: approverId, organizationId: orgId, permissions: ["*", "card.issue"] });
    const fundBefore = await prisma.fund.findUniqueOrThrow({ where: { id: card.fundId } });
    const auth = await cards.authorize(owner, {
      cardId: card.id,
      amount: "15.00",
      currency: "USD",
      merchant: "Amazon",
      merchantCategory: "retail",
      idempotencyKey: `rev-auth-${suffix}`,
    });
    const holdId = approvedTxnId(auth);
    const cleared = await cards.clear(owner, holdId);
    expect(cleared.transaction.status).toBe("CLEARED");
    const reversed = await cards.reverse(owner, holdId);
    expect(reversed.transaction.status).toBe("REVERSED");
    const expense = await prisma.expense.findFirst({ where: { organizationId: orgId, transactionId: holdId } });
    expect(expense?.status).toBe("CANCELLED");
    const fundAfter = await prisma.fund.findUniqueOrThrow({ where: { id: card.fundId } });
    expect(Number(fundAfter.availableAmount)).toBe(Number(fundBefore.availableAmount));
  });

  it("enforces MCC, per-transaction, and velocity controls", async () => {
    process.env.NODE_ENV = "development";
    const card = await prisma.card.findFirstOrThrow({
      where: { organizationId: orgId, merchantLock: { equals: "amazon", mode: "insensitive" } },
    });
    const owner = ctx({ userId: approverId, organizationId: orgId, permissions: ["*", "card.issue"] });
    await cards.setControls(owner, card.id, {
      allowedMccs: "software,office",
      perTransactionLimit: "40.00",
      velocityMaxCount: 1,
      velocityMaxAmount: "50.00",
      velocityWindowHours: 24,
    });

    const mcc = await cards.authorize(owner, {
      cardId: card.id, amount: "10.00", currency: "USD", merchant: "Amazon",
      merchantCategory: "grocery", idempotencyKey: `mcc-${suffix}`,
    });
    expect(mcc.decision).toBe("DECLINED");
    expect(mcc.reason).toBe("MCC_BLOCKED");

    const perTxn = await cards.authorize(owner, {
      cardId: card.id, amount: "45.00", currency: "USD", merchant: "Amazon",
      merchantCategory: "software", idempotencyKey: `pertxn-${suffix}`,
    });
    expect(perTxn.decision).toBe("DECLINED");
    expect(perTxn.reason).toBe("PER_TXN_LIMIT");

    const first = await cards.authorize(owner, {
      cardId: card.id, amount: "20.00", currency: "USD", merchant: "Amazon",
      merchantCategory: "software", idempotencyKey: `vel1-${suffix}`,
    });
    const firstId = approvedTxnId(first);

    const second = await cards.authorize(owner, {
      cardId: card.id, amount: "10.00", currency: "USD", merchant: "Amazon",
      merchantCategory: "office", idempotencyKey: `vel2-${suffix}`,
    });
    expect(second.decision).toBe("DECLINED");
    expect(second.reason).toBe("VELOCITY_COUNT");

    await cards.void(owner, firstId);
    await cards.setControls(owner, card.id, {
      allowedMccs: null,
      perTransactionLimit: null,
      velocityMaxCount: null,
      velocityMaxAmount: null,
    });
  });
});
