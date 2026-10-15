import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { debitReimbursementCash, adjustedSandboxCash } from "../modules/reimbursements/company-cash";
import { getCardIssuer } from "../integrations/card-issuer";
import { env } from "../config/env";
vi.mock("../integrations/card-issuer", () => ({getCardIssuer: vi.fn(() => ({name: "mock"}))}));

const record = { id: "claim", organizationId: "org", legalEntityId: "entity", currency: "USD", amount: new Prisma.Decimal("85.50") };
function fixture(accounts: Array<{id: string; name: string}>, count = 1) {
  const db = { bankAccount: { findMany: vi.fn().mockResolvedValue(accounts), updateMany: vi.fn().mockResolvedValue({count}) }, ledgerTransaction: {create: vi.fn().mockResolvedValue({id: "ledger"})}, ledgerEntry: {createMany: vi.fn().mockResolvedValue({count: 2})} };
  return db;
}
describe("reimbursement company cash", () => {
  it("subtracts sandbox payouts by currency without altering provider balances", () => {
    const raw = [{currency: "USD", amount: "1000"}, {currency: "GBP", amount: "50"}];
    expect(adjustedSandboxCash(raw, [{currency: "USD", amount: "85.50"}])).toEqual([{currency: "USD", amount: "914.50"}, {currency: "GBP", amount: "50.00"}]);
    expect(raw[0].amount).toBe("1000");
  });
  it("debits 85.50 from same-entity/currency Operating account and posts balanced ledger", async () => {
    const db = fixture([{id: "savings", name: "Savings"}, {id: "operating", name: "Operating"}]);
    await debitReimbursementCash(db as unknown as Prisma.TransactionClient, record);
    expect(db.bankAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {organizationId: "org", legalEntityId: "entity", currency: "USD"}}));
    expect(db.bankAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({where: {id: "operating", available: {gte: record.amount}}, data: expect.objectContaining({available: {decrement: record.amount}})}));
    expect(db.ledgerEntry.createMany.mock.calls[0][0].data.map((entry: {amount: Prisma.Decimal}) => entry.amount.toFixed(2))).toEqual(["85.50", "85.50"]);
  });
  it("rejects absent company account", async () => {
    const db = fixture([]);
    await expect(debitReimbursementCash(db as unknown as Prisma.TransactionClient, record)).rejects.toMatchObject({code: "NO_COMPANY_BANK"});
    expect(db.bankAccount.updateMany).not.toHaveBeenCalled();
  });
  it("rejects insufficient cash without posting ledger", async () => {
    const db = fixture([{id: "operating", name: "Operating"}], 0);
    await expect(debitReimbursementCash(db as unknown as Prisma.TransactionClient, record)).rejects.toMatchObject({code: "INSUFFICIENT_COMPANY_CASH"});
    expect(db.ledgerTransaction.create).not.toHaveBeenCalled();
  });
  it("settles Stripe test mock payout without requiring a local bank account", async () => {
    const previousKey = env.stripeSecretKey;
    const previousMode = env.nodeEnv;
    env.stripeSecretKey = "sk_test_unit";
    env.nodeEnv = "test";
    vi.mocked(getCardIssuer).mockReturnValue({name: "stripe", getCompanyBalance: async () => ({available: [{currency: "USD", amount: "1000"}]})} as unknown as ReturnType<typeof getCardIssuer>);
    const db = {...fixture([]), $queryRaw: vi.fn().mockResolvedValue([]), ledgerEntry: {findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn().mockResolvedValue({count: 2})}};
    try {
      await debitReimbursementCash(db as unknown as Prisma.TransactionClient, record);
      expect(db.bankAccount.findMany).not.toHaveBeenCalled();
      expect(db.ledgerTransaction.create).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({memo: "reimbursement.sandbox_cash_debit claim"})}));
    } finally {
      env.stripeSecretKey = previousKey;
      env.nodeEnv = previousMode;
      vi.mocked(getCardIssuer).mockReturnValue({name: "mock"} as ReturnType<typeof getCardIssuer>);
    }
  });
});
