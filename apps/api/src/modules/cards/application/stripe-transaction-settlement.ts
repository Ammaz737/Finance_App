import { Prisma } from "@prisma/client";
import { prisma } from "../../../database/client";
import { pickAccountingRule } from "../../accounting/domain/rules";

function dec(value: string | number) {
  return new Prisma.Decimal(value);
}

async function resolveBudgetForFund(
  tx: Prisma.TransactionClient,
  organizationId: string,
  legalEntityId: string,
  fundId: string | null | undefined,
) {
  if (!fundId) return null;
  const fund = await tx.fund.findFirst({ where: { id: fundId, organizationId } });
  if (!fund?.spendRequestId) return null;
  const request = await tx.spendRequest.findFirst({
    where: { id: fund.spendRequestId, organizationId },
    select: { programId: true },
  });
  if (!request?.programId) return null;
  const program = await tx.spendProgram.findFirst({
    where: { id: request.programId, organizationId, legalEntityId },
    select: { budgetId: true },
  });
  if (!program?.budgetId) return null;
  return tx.budget.findFirst({ where: { id: program.budgetId, organizationId, legalEntityId } });
}

async function applyBudgetCapture(
  tx: Prisma.TransactionClient,
  organizationId: string,
  legalEntityId: string,
  fundId: string | null | undefined,
  amount: Prisma.Decimal,
) {
  const budget = await resolveBudgetForFund(tx, organizationId, legalEntityId, fundId);
  if (!budget) return;
  const committedRelease = amount.greaterThan(0) ? Prisma.Decimal.min(budget.committedAmount, amount) : dec(0);
  await tx.budget.update({
    where: { id: budget.id },
    data: {
      actualAmount: { increment: amount },
      committedAmount: { decrement: committedRelease },
      freshness: new Date(),
    },
  });
}

async function queueAccountingEntry(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    legalEntityId: string;
    sourceType: string;
    sourceId: string;
    amount: Prisma.Decimal;
    currency: string;
    memo: string;
  },
) {
  const rules = await tx.accountingRule.findMany({
    where: { organizationId: input.organizationId, enabled: true },
    orderBy: { priority: "asc" },
  });
  const applied = pickAccountingRule(rules, {
    sourceType: input.sourceType,
    category: "",
    memo: input.memo,
    amount: Number(input.amount),
  });
  const category = applied?.category?.trim() || "";
  const memo = applied?.memo?.trim() || input.memo;
  const coding = applied?.coding ?? {};

  await tx.accountingEntry.upsert({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
    update: {
      status: "NEEDS_REVIEW",
      amount: input.amount,
      currency: input.currency,
      ...(memo ? { memo } : {}),
      ...(category ? { category } : {}),
      ...(Object.keys(coding).length ? { coding } : {}),
      syncError: null,
    },
    create: {
      organizationId: input.organizationId,
      legalEntityId: input.legalEntityId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: "NEEDS_REVIEW",
      amount: input.amount,
      currency: input.currency,
      memo,
      category,
      coding,
    },
  });
}

/** After Stripe issuing_transaction.created — mirror mock capture side effects. */
export async function settleStripeIssuingTransaction(input: {
  organizationId: string;
  legalEntityId: string;
  cardId: string;
  fundId: string;
  holderId: string;
  transactionId: string;
  amount: Prisma.Decimal;
  currency: string;
  merchant: string;
}, transaction?: Prisma.TransactionClient) {
  const settle = async (tx: Prisma.TransactionClient) => {
    await applyBudgetCapture(tx, input.organizationId, input.legalEntityId, input.fundId, input.amount);

    const existingExpense = await tx.expense.findFirst({
      where: { organizationId: input.organizationId, transactionId: input.transactionId },
    });
    // Credits are accounting reversals, not new expenses requiring receipts/approval.
    if (!existingExpense && input.amount.greaterThan(0)) {
      try {
        await tx.expense.create({
          data: {
            organizationId: input.organizationId,
            legalEntityId: input.legalEntityId,
            userId: input.holderId,
            transactionId: input.transactionId,
            amount: input.amount,
            currency: input.currency,
            merchant: input.merchant,
            memo: input.merchant,
            status: "INCOMPLETE",
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }

    await queueAccountingEntry(tx, {
      organizationId: input.organizationId,
      legalEntityId: input.legalEntityId,
      sourceType: "CARD_TRANSACTION",
      sourceId: input.transactionId,
      amount: input.amount,
      currency: input.currency,
      memo: input.merchant,
    });

    await tx.outboxEvent.create({
      data: {
        organizationId: input.organizationId,
        type: "transaction.cleared",
        payload: { objectType: "Transaction", objectId: input.transactionId, source: "stripe" },
      },
    });
  };
  if (transaction) await settle(transaction);
  else await prisma.$transaction(settle);
}
