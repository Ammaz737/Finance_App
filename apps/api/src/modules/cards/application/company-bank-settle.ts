import { Prisma } from "@prisma/client";
import { postLedger } from "../../../engines/ledger";
import { isStripeCardIssuer } from "../../../integrations/card-issuer";
import { AppError } from "../../../platform/http";

/**
 * When a card charge clears, debit the entity's company bank (prefer Operating).
 * Mock issuer only — Stripe Issuing already moves real FA cash on capture.
 */
export async function settleCompanyBankForCardClear(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    legalEntityId: string;
    amount: Prisma.Decimal;
    currency: string;
    transactionId: string;
    direction: "debit" | "credit";
  },
) {
  if (input.amount.lessThanOrEqualTo(0)) return null;
  // Real Stripe FA is the cash register; do not mutate seed/local BankAccount balances.
  if (isStripeCardIssuer()) return null;

  const memo =
    input.direction === "debit"
      ? `card.bank_debit txn ${input.transactionId}`
      : `card.bank_credit txn ${input.transactionId}`;
  const already = await tx.ledgerTransaction.findFirst({
    where: { organizationId: input.organizationId, memo },
    select: { id: true },
  });
  if (already) return null;

  const accounts = await tx.bankAccount.findMany({
    where: {
      organizationId: input.organizationId,
      legalEntityId: input.legalEntityId,
      currency: input.currency,
    },
    orderBy: { name: "asc" },
  });
  if (!accounts.length) {
    throw new AppError(
      "NO_COMPANY_BANK",
      "No company bank account for this entity/currency — card spend cannot settle without company cash",
      400,
    );
  }

  const account = accounts.find((row) => /operating/i.test(row.name)) ?? accounts[0]!;

  if (input.direction === "debit") {
    const claimed = await tx.bankAccount.updateMany({
      where: { id: account.id, available: { gte: input.amount } },
      data: { available: { decrement: input.amount }, freshness: new Date() },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        "INSUFFICIENT_COMPANY_CASH",
        `Company bank "${account.name} ••••${account.last4}" has insufficient available balance`,
        400,
      );
    }
    await postLedger(
      input.organizationId,
      memo,
      [
        { account: `bank:${account.id}`, direction: "DEBIT", amount: String(input.amount), currency: input.currency },
        { account: "company.card_spend", direction: "CREDIT", amount: String(input.amount), currency: input.currency },
      ],
      tx,
    );
  } else {
    await tx.bankAccount.update({
      where: { id: account.id },
      data: { available: { increment: input.amount }, freshness: new Date() },
    });
    await postLedger(
      input.organizationId,
      memo,
      [
        { account: "company.card_spend", direction: "DEBIT", amount: String(input.amount), currency: input.currency },
        { account: `bank:${account.id}`, direction: "CREDIT", amount: String(input.amount), currency: input.currency },
      ],
      tx,
    );
  }

  return account;
}
