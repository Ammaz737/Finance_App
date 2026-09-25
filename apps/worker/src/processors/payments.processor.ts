import { PrismaClient } from "@prisma/client";

function mockSettle(providerRef: string) {
  return { settlementId: `mock_settle_${providerRef}`, status: "COMPLETED" as const };
}

/** Settles simulated payments only when the on-prem sandbox explicitly enables the mock rail. */
export async function processPaymentsJob(prisma: PrismaClient, data: { paymentId?: string; objectId?: string }): Promise<void> {
  const paymentId = data.paymentId ?? data.objectId;
  if (!paymentId) throw new Error("Payment job has no payment ID");
  if (process.env.PAYMENT_PROVIDER_MODE !== "mock") {
    throw new Error("Payment provider is not configured; payment remains PROCESSING");
  }
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === "SETTLED" || payment.status === "COMPLETED") return;
    if (payment.status !== "PROCESSING" && payment.status !== "SENT") {
      throw new Error(`Payment ${paymentId} is not processing/sent`);
    }
    if (!payment.providerRef) throw new Error(`Payment ${paymentId} missing provider ref`);
    if (payment.settlementId) return;

    const settled = mockSettle(payment.providerRef);

    const bill = await tx.bill.findFirst({ where: { id: payment.billId, organizationId: payment.organizationId } });
    if (!bill || bill.remainingAmount.lessThan(payment.amount)) throw new Error("Bill has insufficient remaining balance");

    const claim = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ["PROCESSING", "SENT"] }, settlementId: null },
      data: { status: "SETTLED", settlementId: settled.settlementId, settledAt: new Date() },
    });
    if (claim.count !== 1) return;

    const billClaim = await tx.bill.updateMany({
      where: { id: bill.id, remainingAmount: { gte: payment.amount } },
      data: { remainingAmount: { decrement: payment.amount } },
    });
    if (billClaim.count !== 1) throw new Error("Bill balance changed before settlement");

    const updatedBill = await tx.bill.findUniqueOrThrow({ where: { id: bill.id } });
    await tx.bill.update({
      where: { id: bill.id },
      data: { status: updatedBill.remainingAmount.lessThanOrEqualTo(0) ? "PAID" : "PARTIAL" },
    });
    await tx.accountingEntry.upsert({
      where: { organizationId_sourceType_sourceId: { organizationId: payment.organizationId, sourceType: "PAYMENT", sourceId: payment.id } },
      update: {},
      create: {
        organizationId: payment.organizationId,
        legalEntityId: payment.legalEntityId,
        sourceType: "PAYMENT",
        sourceId: payment.id,
        status: "NEEDS_REVIEW",
      },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: payment.organizationId,
        actorId: payment.releasedBy,
        actorType: "SYSTEM",
        action: "payment.settled",
        objectType: "Payment",
        objectId: payment.id,
        oldValue: { status: payment.status },
        newValue: { status: "SETTLED", mode: "mock", settlementId: settled.settlementId },
      },
    });
    await tx.outboxEvent.create({
      data: {
        organizationId: payment.organizationId,
        type: "payment.settled",
        payload: { paymentId: payment.id, objectId: payment.id, settlementId: settled.settlementId },
      },
    });
  });
}

/** Settles mock reimbursement payouts. Idempotent; never marks PAID without provider confirm. */
export async function processReimbursementPayoutJob(
  prisma: PrismaClient,
  data: { reimbursementId?: string; objectId?: string },
): Promise<void> {
  const reimbursementId = data.reimbursementId ?? data.objectId;
  if (!reimbursementId) throw new Error("Reimbursement job has no ID");
  if (process.env.PAYMENT_PROVIDER_MODE !== "mock" && process.env.NODE_ENV === "production") {
    throw new Error("Payout provider is not configured; reimbursement remains SCHEDULED");
  }
  await prisma.$transaction(async (tx) => {
    const record = await tx.reimbursement.findUnique({ where: { id: reimbursementId } });
    if (!record || record.status === "PAID") return;
    if (record.status !== "SCHEDULED" && record.status !== "PROCESSING") {
      throw new Error(`Reimbursement ${reimbursementId} is not scheduled`);
    }
    if (!record.providerRef) throw new Error(`Reimbursement ${reimbursementId} missing provider ref`);

    const settlementRef = `mock_settle_${record.providerRef}`;
    const claim = await tx.reimbursement.updateMany({
      where: { id: reimbursementId, status: { in: ["SCHEDULED", "PROCESSING"] } },
      data: {
        status: "PAID",
        payoutStatus: "SETTLED",
        paidAt: new Date(),
        settlementRef,
        failureReason: "",
      },
    });
    if (claim.count !== 1) return;

    await tx.accountingEntry.upsert({
      where: {
        organizationId_sourceType_sourceId: {
          organizationId: record.organizationId,
          sourceType: "REIMBURSEMENT",
          sourceId: record.id,
        },
      },
      update: {},
      create: {
        organizationId: record.organizationId,
        legalEntityId: record.legalEntityId,
        sourceType: "REIMBURSEMENT",
        sourceId: record.id,
        status: "NEEDS_REVIEW",
        amount: record.amount,
        currency: record.currency,
        memo: record.memo,
      },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: record.organizationId,
        actorId: record.releasedBy ?? record.userId,
        actorType: "SYSTEM",
        action: "reimbursement.payout_confirm",
        objectType: "Reimbursement",
        objectId: record.id,
        oldValue: { status: record.status },
        newValue: { status: "PAID", mode: "mock", settlementRef },
      },
    });
    await tx.outboxEvent.create({
      data: {
        organizationId: record.organizationId,
        type: "reimbursement.paid",
        payload: { reimbursementId: record.id, objectId: record.id, settlementRef },
      },
    });
  });
}
