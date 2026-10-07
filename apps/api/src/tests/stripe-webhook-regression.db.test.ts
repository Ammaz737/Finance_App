import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "../database/client";
import { applyStripeIssuingAuthorizationRequest, applyStripeIssuingTransactionCreated } from "../modules/cards/application/stripe-issuing-webhook";
describe.runIf(process.env.RUN_DB_TESTS !== "0")("Stripe webhook atomic ledger regression", () => {
  let orgId: string, cardId: string, fundId: string;
  const remoteCard = `ic_regression_${Date.now()}`;
  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Stripe regression", slug: `stripe-regression-${Date.now()}` } }); orgId = org.id;
    const entity = await prisma.legalEntity.create({ data: { organizationId: orgId, name: "Regression US", country: "US", currency: "USD" } });
    const user = await prisma.user.create({ data: { organizationId: orgId, email: `stripe-${Date.now()}@test.invalid`, passwordHash: "unused", firstName: "Test", lastName: "Stripe", status: "ACTIVE" } });
    const fund = await prisma.fund.create({ data: { organizationId: orgId, legalEntityId: entity.id, ownerId: user.id, name: "Regression fund", currency: "USD", limitAmount: "100", availableAmount: "100" } }); fundId = fund.id;
    const card = await prisma.card.create({ data: { organizationId: orgId, legalEntityId: entity.id, holderId: user.id, fundId, type: "VIRTUAL", last4: "4242", token: remoteCard, stripeCardId: remoteCard, provider: "stripe", status: "ACTIVE" } }); cardId = card.id;
  });
  afterAll(async () => {
    if (!orgId) return;
    for (const delegate of [prisma.accountingEntry, prisma.expense, prisma.txn, prisma.cardAuthorization, prisma.card, prisma.fund, prisma.outboxEvent, prisma.user, prisma.legalEntity] as any[]) await delegate.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } });
  });
  it("reserves once for concurrently delivered copies of an authorization", async () => {
    const auth = { id: `iauth_${remoteCard}`, card: remoteCard, amount: 1000, currency: "usd", merchant_data: { name: "Regression Merchant", category: "software" } } as unknown as Stripe.Issuing.Authorization;
    const decisions = await Promise.all([applyStripeIssuingAuthorizationRequest(auth), applyStripeIssuingAuthorizationRequest(auth)]);
    expect(decisions.map(d => d.decision)).toEqual(["APPROVED", "APPROVED"]);
    expect(await prisma.cardAuthorization.count({ where: { organizationId: orgId } })).toBe(1);
    expect((await prisma.fund.findUniqueOrThrow({ where: { id: fundId } })).availableAmount.toString()).toBe("90");
  });
  it("captures once, credits a refund once, and creates no refund expense", async () => {
    const capture = { id: `ipi_capture_${remoteCard}`, card: remoteCard, authorization: `iauth_${remoteCard}`, amount: -1000, currency: "usd", type: "capture", merchant_data: { name: "Regression Merchant" } } as unknown as Stripe.Issuing.Transaction;
    await Promise.all([applyStripeIssuingTransactionCreated(capture), applyStripeIssuingTransactionCreated(capture)]);
    expect((await prisma.fund.findUniqueOrThrow({ where: { id: fundId } })).availableAmount.toString()).toBe("90");
    expect(await prisma.expense.count({ where: { organizationId: orgId } })).toBe(1);
    const refund = { ...capture, id: `ipi_refund_${remoteCard}`, type: "refund", amount: 1000 } as Stripe.Issuing.Transaction;
    await Promise.all([applyStripeIssuingTransactionCreated(refund), applyStripeIssuingTransactionCreated(refund)]);
    expect((await prisma.fund.findUniqueOrThrow({ where: { id: fundId } })).availableAmount.toString()).toBe("100");
    expect(await prisma.txn.count({ where: { organizationId: orgId, cardId } })).toBe(2);
    expect(await prisma.expense.count({ where: { organizationId: orgId } })).toBe(1);
    expect((await prisma.accountingEntry.findMany({ where: { organizationId: orgId }, orderBy: { amount: "asc" } })).map(e => e.amount?.toString())).toEqual(["-10", "10"]);
    expect(await prisma.outboxEvent.count({ where: { organizationId: orgId } })).toBe(2);
  });
  it("debits an unreserved force capture only once", async () => {
    const capture = { id: `ipi_force_${remoteCard}`, card: remoteCard, authorization: null, amount: -500, currency: "usd", type: "capture", merchant_data: { name: "Force capture" } } as unknown as Stripe.Issuing.Transaction;
    await Promise.all([applyStripeIssuingTransactionCreated(capture), applyStripeIssuingTransactionCreated(capture)]);
    expect((await prisma.fund.findUniqueOrThrow({ where: { id: fundId } })).availableAmount.toString()).toBe("95");
  });
  it("rolls back all ledger effects on failure and safely retries", async () => {
    const capture = { id: `ipi_retry_${remoteCard}`, card: remoteCard, authorization: null, amount: -700, currency: "usd", type: "capture", merchant_data: { name: "Retry capture" } } as unknown as Stripe.Issuing.Transaction;
    const original = prisma.$transaction.bind(prisma);
    prisma.$transaction = (async (callback: any, options: any) => original(async (tx: any) => {
      await callback(tx);
      throw new Error("Injected commit failure");
    }, options)) as typeof prisma.$transaction;
    try { await expect(applyStripeIssuingTransactionCreated(capture)).rejects.toThrow("Injected commit failure"); } finally { prisma.$transaction = original; }
    expect(await prisma.txn.count({ where: { stripeTransactionId: capture.id } })).toBe(0);
    expect((await prisma.fund.findUniqueOrThrow({ where: { id: fundId } })).availableAmount.toString()).toBe("95");
    expect(await prisma.expense.count({ where: { organizationId: orgId } })).toBe(2);
    await applyStripeIssuingTransactionCreated(capture);
    expect((await prisma.fund.findUniqueOrThrow({ where: { id: fundId } })).availableAmount.toString()).toBe("88");
    expect(await prisma.expense.count({ where: { organizationId: orgId } })).toBe(3);
  });
});
