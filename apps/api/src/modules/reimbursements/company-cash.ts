import { Prisma } from "@prisma/client";
import { postLedger } from "../../engines/ledger";
import { AppError } from "../../platform/http";
import { env } from "../../config/env";
import { getCardIssuer } from "../../integrations/card-issuer";

export const SANDBOX_REIMBURSEMENT_CASH = "sandbox.stripe.reimbursement_cash";

/** Provider cash stays unchanged; only explicit mock-payout ledger adjustments are subtracted. */
export function adjustedSandboxCash(available: Array<{currency: string; amount: string}>, deductions: Array<{currency: string; amount: string}>) {
  const totals = new Map<string, Prisma.Decimal>();
  for (const row of deductions) totals.set(row.currency, (totals.get(row.currency) ?? new Prisma.Decimal(0)).plus(row.amount));
  return available.map(row => ({currency: row.currency, amount: new Prisma.Decimal(row.amount).minus(totals.get(row.currency) ?? 0).toFixed(2)}));
}

/** Called only after claiming a successful payout, in the same transaction. */
export async function debitReimbursementCash(tx: Prisma.TransactionClient, record: {
  id: string; organizationId: string; legalEntityId: string; currency: string; amount: Prisma.Decimal;
}) {
  const issuer = getCardIssuer();
  if (issuer.name === "stripe") {
    if (env.nodeEnv === "production" || !env.stripeSecretKey.startsWith("sk_test_")) {
      throw new AppError("PROVIDER_REQUIRED", "Mock reimbursement cash settlement requires Stripe test mode", 409);
    }
    // Serialize different reimbursements sharing this tenant's sandbox cash pool.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM organizations WHERE id = ${record.organizationId} FOR UPDATE`);
    const balance = await issuer.getCompanyBalance?.();
    if (!balance) throw new AppError("COMPANY_CASH_UNAVAILABLE", "Stripe sandbox company balance is unavailable; retry later", 409);
    const entries = await tx.ledgerEntry.findMany({where: {organizationId: record.organizationId, account: SANDBOX_REIMBURSEMENT_CASH, direction: "DEBIT"}, select: {currency: true, amount: true}});
    const available = adjustedSandboxCash(balance.available, entries.map(row => ({currency: row.currency, amount: String(row.amount)}))).find(row => row.currency === record.currency);
    if (!available || new Prisma.Decimal(available.amount).lessThan(record.amount)) throw new AppError("INSUFFICIENT_COMPANY_CASH", "Stripe sandbox cash after mock payouts is insufficient", 409);
    await postLedger(record.organizationId, `reimbursement.sandbox_cash_debit ${record.id}`, [
      {account: SANDBOX_REIMBURSEMENT_CASH, direction: "DEBIT", amount: String(record.amount), currency: record.currency},
      {account: "company.reimbursement_payout", direction: "CREDIT", amount: String(record.amount), currency: record.currency},
    ], tx);
    return null;
  }
  const accounts = await tx.bankAccount.findMany({
    where: { organizationId: record.organizationId, legalEntityId: record.legalEntityId, currency: record.currency },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const account = accounts.find(row => /operating/i.test(row.name)) ?? accounts[0];
  if (!account) throw new AppError("NO_COMPANY_BANK", "No company bank account for this reimbursement entity/currency", 400);
  const debit = await tx.bankAccount.updateMany({
    where: { id: account.id, available: { gte: record.amount } },
    data: { available: { decrement: record.amount }, freshness: new Date() },
  });
  if (debit.count !== 1) throw new AppError("INSUFFICIENT_COMPANY_CASH", "Company account has insufficient cash for this reimbursement", 409);
  await postLedger(record.organizationId, `reimbursement.bank_debit ${record.id}`, [
    { account: `bank:${account.id}`, direction: "DEBIT", amount: String(record.amount), currency: record.currency },
    { account: "company.reimbursement_payout", direction: "CREDIT", amount: String(record.amount), currency: record.currency },
  ], tx);
  return account;
}
