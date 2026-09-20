import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../platform/auth";
import { accounting } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let entityId = "";
let userId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [entityId],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "m7-session",
    correlationId: `m7-${suffix}`,
    ...partial,
  };
}

describe.runIf(runDb)("M7 accounting queue ERP", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `M7 ${suffix}`, slug: `m7-${suffix}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({
      data: { organizationId: org.id, name: "M7 US", country: "US", currency: "USD" },
    });
    entityId = entity.id;
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `acct.${suffix}@m7.test`,
        passwordHash,
        firstName: "Acct",
        lastName: "User",
        status: "ACTIVE",
      },
    });
    userId = user.id;
    const role = await prisma.role.create({ data: { organizationId: org.id, name: "Owner" } });
    let star = await prisma.permission.findUnique({ where: { key: "*" } });
    if (!star) star = await prisma.permission.create({ data: { key: "*", label: "*" } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: star.id, scope: "ORGANIZATION" } });
    await prisma.userRole.create({ data: { organizationId: org.id, userId: user.id, roleId: role.id } });
    await prisma.integrationConnection.create({
      data: { organizationId: org.id, family: "AccountingProvider", provider: "MOCK_QBO", status: "CONNECTED" },
    });
    await prisma.accountingRule.create({
      data: {
        organizationId: org.id,
        name: "Card software",
        match: { sourceType: "CARD_TRANSACTION", memoContains: "OpenAI" },
        coding: { category: "Software", coding: { glAccount: "6100" } },
        priority: 5,
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    await prisma.syncAttempt.deleteMany({ where: { organizationId: orgId } });
    await prisma.syncJob.deleteMany({ where: { organizationId: orgId } });
    await prisma.accountingEntry.deleteMany({ where: { organizationId: orgId } });
    await prisma.accountingRule.deleteMany({ where: { organizationId: orgId } });
    await prisma.accountingDimension.deleteMany({ where: { organizationId: orgId } });
    await prisma.integrationConnection.deleteMany({ where: { organizationId: orgId } });
    await prisma.auditEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.outboxEvent.deleteMany({ where: { organizationId: orgId } });
    const roles = await prisma.role.findMany({ where: { organizationId: orgId }, select: { id: true } });
    await prisma.userRole.deleteMany({ where: { organizationId: orgId } });
    if (roles.length) await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map((r) => r.id) } } });
    await prisma.role.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.legalEntity.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it("keeps one row per source, applies rules, syncs with idempotent external id", async () => {
    const actor = ctx({ userId, organizationId: orgId });
    const sourceId = `txn-${suffix}`;

    // Simulate source adapter upsert twice — still one queue row.
    const first = await prisma.accountingEntry.upsert({
      where: {
        organizationId_sourceType_sourceId: {
          organizationId: orgId,
          sourceType: "CARD_TRANSACTION",
          sourceId,
        },
      },
      update: { status: "NEEDS_REVIEW" },
      create: {
        organizationId: orgId,
        legalEntityId: entityId,
        sourceType: "CARD_TRANSACTION",
        sourceId,
        status: "NEEDS_REVIEW",
        amount: "42.00",
        currency: "USD",
        memo: "OpenAI API",
      },
    });
    const second = await prisma.accountingEntry.upsert({
      where: {
        organizationId_sourceType_sourceId: {
          organizationId: orgId,
          sourceType: "CARD_TRANSACTION",
          sourceId,
        },
      },
      update: { status: "NEEDS_REVIEW", memo: "OpenAI API" },
      create: {
        organizationId: orgId,
        legalEntityId: entityId,
        sourceType: "CARD_TRANSACTION",
        sourceId,
        status: "NEEDS_REVIEW",
      },
    });
    expect(second.id).toBe(first.id);
    const rows = await prisma.accountingEntry.findMany({
      where: { organizationId: orgId, sourceType: "CARD_TRANSACTION", sourceId },
    });
    expect(rows).toHaveLength(1);

    // Rule-assisted coding path via code + ready + sync
    await accounting.code(actor, first.id, { category: "Software", coding: { glAccount: "6100" } });
    await accounting.markReady(actor, first.id);
    await accounting.undoReady(actor, first.id);
    await accounting.markReady(actor, first.id);

    const synced = await accounting.sync(actor, [first.id]);
    expect(synced.count).toBe(1);
    const confirmed = await accounting.confirmSync(actor, synced.job.id);
    expect(confirmed.job.status).toBe("COMPLETED");
    expect(confirmed.successCount).toBe(1);

    const entry = await prisma.accountingEntry.findUniqueOrThrow({ where: { id: first.id } });
    expect(entry.status).toBe("SYNCED");
    expect(entry.externalId).toBe(`qbo_${first.id}`);

    // Retry path: force error state then re-sync — same external id, still one row.
    await prisma.accountingEntry.update({
      where: { id: first.id },
      data: { status: "SYNC_ERROR", syncError: "forced" },
    });
    await accounting.retry(actor, first.id);
    const again = await accounting.sync(actor, [first.id]);
    const confirmedAgain = await accounting.confirmSync(actor, again.job.id);
    expect(confirmedAgain.successCount).toBe(1);
    const afterRetry = await prisma.accountingEntry.findUniqueOrThrow({ where: { id: first.id } });
    expect(afterRetry.externalId).toBe(`qbo_${first.id}`);
    expect(await prisma.accountingEntry.count({
      where: { organizationId: orgId, sourceType: "CARD_TRANSACTION", sourceId },
    })).toBe(1);

    const dims = await accounting.refreshDimensions(actor);
    expect(dims.some((d) => d.key === "glAccount")).toBe(true);
  });

  it("queues BILL / PAYMENT / REIMBURSEMENT sources distinctly", async () => {
    await prisma.accountingEntry.createMany({
      data: [
        {
          organizationId: orgId, legalEntityId: entityId, sourceType: "BILL", sourceId: `bill-${suffix}`,
          status: "NEEDS_REVIEW", amount: "100", currency: "USD", memo: "Invoice",
        },
        {
          organizationId: orgId, legalEntityId: entityId, sourceType: "PAYMENT", sourceId: `pay-${suffix}`,
          status: "NEEDS_REVIEW", amount: "40", currency: "USD", memo: "ACH",
        },
        {
          organizationId: orgId, legalEntityId: entityId, sourceType: "REIMBURSEMENT", sourceId: `reimb-${suffix}`,
          status: "NEEDS_REVIEW", amount: "67", currency: "USD", memo: "mileage trip",
        },
      ],
    });
    const summary = await accounting.getQueueSummary(ctx({ userId, organizationId: orgId }));
    expect(summary.bySource.BILL).toBeGreaterThanOrEqual(1);
    expect(summary.bySource.PAYMENT).toBeGreaterThanOrEqual(1);
    expect(summary.bySource.REIMBURSEMENT).toBeGreaterThanOrEqual(1);
  });
});
