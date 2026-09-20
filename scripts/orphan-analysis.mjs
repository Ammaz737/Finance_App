/**
 * Read-only orphan / uniqueness analysis for M1 foundation migration planning.
 * Does not mutate data. Run: node scripts/orphan-analysis.mjs (from apps/api with DATABASE_URL).
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();

async function missingParent(label, childCount, parentCount) {
  return { label, childRows: childCount, issue: childCount > 0 && parentCount === 0 ? "possible_orphan_set" : "ok" };
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    unsafeUniques: [
      { model: "AccountingEntry", unique: "[sourceType, sourceId]", risk: "global; should include organizationId" },
      { model: "CardAuthorization", unique: "idempotencyKey", risk: "global; should be [organizationId, idempotencyKey]" },
      { model: "Fund.spendRequestId", unique: "none", risk: "duplicate fulfillment possible; add unique where not null" },
    ],
    foreignKeysInMigration: 0,
    prismaRelations: 0,
    counts: {},
    orphans: {},
  };

  report.counts = {
    organizations: await prisma.organization.count(),
    users: await prisma.user.count(),
    funds: await prisma.fund.count(),
    cards: await prisma.card.count(),
    spendRequests: await prisma.spendRequest.count(),
    bills: await prisma.bill.count(),
    payments: await prisma.payment.count(),
    accountingEntries: await prisma.accountingEntry.count(),
    approvalInstances: await prisma.approvalInstance.count(),
  };

  const funds = await prisma.fund.findMany({ select: { id: true, organizationId: true, spendRequestId: true, ownerId: true, legalEntityId: true } });
  const cards = await prisma.card.findMany({ select: { id: true, organizationId: true, fundId: true, holderId: true, legalEntityId: true } });
  const orgs = new Set((await prisma.organization.findMany({ select: { id: true } })).map((o) => o.id));
  const users = new Set((await prisma.user.findMany({ select: { id: true } })).map((u) => u.id));
  const entities = new Set((await prisma.legalEntity.findMany({ select: { id: true } })).map((e) => e.id));
  const fundIds = new Set(funds.map((f) => f.id));
  const requests = new Set((await prisma.spendRequest.findMany({ select: { id: true } })).map((r) => r.id));

  report.orphans.fundsMissingOrg = funds.filter((f) => !orgs.has(f.organizationId)).map((f) => f.id);
  report.orphans.fundsMissingOwner = funds.filter((f) => !users.has(f.ownerId)).map((f) => f.id);
  report.orphans.fundsMissingEntity = funds.filter((f) => !entities.has(f.legalEntityId)).map((f) => f.id);
  report.orphans.fundsMissingSpendRequest = funds.filter((f) => f.spendRequestId && !requests.has(f.spendRequestId)).map((f) => f.id);
  report.orphans.cardsMissingFund = cards.filter((c) => !fundIds.has(c.fundId)).map((c) => c.id);
  report.orphans.cardsMissingHolder = cards.filter((c) => !users.has(c.holderId)).map((c) => c.id);
  report.orphans.cardsMissingEntity = cards.filter((c) => !entities.has(c.legalEntityId)).map((c) => c.id);

  const spendRequestFundDupes = {};
  for (const fund of funds) {
    if (!fund.spendRequestId) continue;
    spendRequestFundDupes[fund.spendRequestId] = (spendRequestFundDupes[fund.spendRequestId] ?? 0) + 1;
  }
  report.orphans.duplicateSpendRequestFunds = Object.entries(spendRequestFundDupes)
    .filter(([, count]) => count > 1)
    .map(([spendRequestId, count]) => ({ spendRequestId, count }));

  const accounting = await prisma.accountingEntry.findMany({ select: { sourceType: true, sourceId: true, organizationId: true } });
  const sourceKeys = {};
  for (const row of accounting) {
    const key = `${row.sourceType}:${row.sourceId}`;
    sourceKeys[key] = sourceKeys[key] ?? [];
    sourceKeys[key].push(row.organizationId);
  }
  report.orphans.accountingSourceKeyCollisionsAcrossOrgs = Object.entries(sourceKeys)
    .filter(([, orgsForKey]) => new Set(orgsForKey).size > 1)
    .map(([key, orgsForKey]) => ({ key, organizations: [...new Set(orgsForKey)] }));

  const outPath = resolve(process.cwd(), "../../docs/M1_ORPHAN_ANALYSIS.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
  await missingParent("noop", 0, 0);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
