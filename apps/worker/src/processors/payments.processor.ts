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
