import { Prisma } from "@prisma/client";
import { prisma } from "../../database/client";

type Db = Prisma.TransactionClient | typeof prisma;

export async function postLedger(
  organizationId: string,
  memo: string,
  entries: Array<{ account: string; direction: "DEBIT" | "CREDIT"; amount: string; currency: string }>,
  db: Db = prisma,
) {
  const ledgerTx = await db.ledgerTransaction.create({
    data: { organizationId, memo },
  });
  await db.ledgerEntry.createMany({
    data: entries.map((entry) => ({
      organizationId,
      ledgerTxId: ledgerTx.id,
      account: entry.account,
      direction: entry.direction,
      amount: new Prisma.Decimal(entry.amount),
      currency: entry.currency,
    })),
  });
  return ledgerTx;
}
