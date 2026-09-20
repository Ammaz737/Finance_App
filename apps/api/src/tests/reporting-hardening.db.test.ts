import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../platform/auth";
import { budgets, integrations, notifications, reporting, savedViews } from "../application/actions";
import { searchOrganization } from "../engines/search";
import type { RequestContext } from "../platform/auth/context";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let entityId = "";
let userId = "";
let otherUserId = "";
let budgetId = "";
let integrationId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [entityId],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "m10-session",
    correlationId: `m10-${suffix}`,
    ...partial,
  };
}

describe.runIf(runDb)("M10 reporting and hardening", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `M10 ${suffix}`, slug: `m10-${suffix}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({
      data: { organizationId: org.id, name: "M10 US", country: "US", currency: "USD" },
    });
    entityId = entity.id;
    const [user, other] = await Promise.all([
      prisma.user.create({
        data: { organizationId: org.id, email: `u.${suffix}@m10.test`, passwordHash, firstName: "U", lastName: "One", status: "ACTIVE" },
      }),
      prisma.user.create({
        data: { organizationId: org.id, email: `o.${suffix}@m10.test`, passwordHash, firstName: "O", lastName: "Two", status: "ACTIVE" },
      }),
    ]);
    userId = user.id;
    otherUserId = other.id;
    const budget = await prisma.budget.create({
      data: {
        organizationId: org.id,
        legalEntityId: entity.id,
        name: `Eng ${suffix}`,
        ownerId: user.id,
        amount: "1000.00",
        actualAmount: "200.00",
        committedAmount: "300.00",
        currency: "USD",
        period: "ANNUAL",
      },
    });
    budgetId = budget.id;
    const vendor = await prisma.vendor.create({
      data: { organizationId: org.id, legalEntityId: entity.id, name: `AcmeSearch ${suffix}`, category: "SaaS" },
    });
    void vendor;
    const integration = await prisma.integrationConnection.create({
      data: { organizationId: org.id, family: "ERP", provider: "mock-erp", status: "CONNECTED", health: "UNKNOWN" },
    });
    integrationId = integration.id;
    await prisma.notification.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        type: "SYSTEM",
        title: "Welcome",
        body: "M10 notification",
        href: "/app/home",
      },
    });
    await prisma.notification.create({
      data: {
        organizationId: org.id,
        userId: other.id,
        type: "SYSTEM",
        title: "Other only",
        body: "Should not appear for user",
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    await prisma.savedView.deleteMany({ where: { organizationId: orgId } });
    await prisma.notification.deleteMany({ where: { organizationId: orgId } });
    await prisma.integrationConnection.deleteMany({ where: { organizationId: orgId } });
    await prisma.vendor.deleteMany({ where: { organizationId: orgId } });
    await prisma.budget.deleteMany({ where: { organizationId: orgId } });
    await prisma.auditEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.legalEntity.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it("budget remaining reconciles without double counting; dashboard is currency-scoped", async () => {
    const actor = ctx({ userId, organizationId: orgId });
    const detail = await budgets.getDetail(actor, budgetId);
    expect(detail.budget.remainingAmount).toBe("500.00");
    expect(detail.budget.usedAmount).toBe("500.00");
    expect(Number(detail.budget.actualAmount) + Number(detail.budget.committedAmount)).toBe(500);

    const dash = await reporting.dashboard(actor);
    expect(dash.budgetCapacityByCurrency.some((row) => row.currency === "USD" && row.amount === "500.00")).toBe(true);
    expect(dash.freshness.asOf).toBeTruthy();
    expect(dash.unreadNotifications).toBe(1);
  });

  it("notifications are user-scoped; saved views and integration ping work", async () => {
    const actor = ctx({ userId, organizationId: orgId });
    const other = ctx({ userId: otherUserId, organizationId: orgId });

    const mine = await notifications.listMine(actor);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.title).toBe("Welcome");
    expect((await notifications.listMine(other))).toHaveLength(1);

    const read = await notifications.markRead(actor, mine[0]!.id);
    expect(read.readAt).toBeTruthy();

    const view = await savedViews.create(actor, {
      resource: "bills",
      name: `Pending ${suffix}`,
      filters: { status: "PENDING_APPROVAL" },
    });
    expect(view.userId).toBe(userId);
    const listed = await savedViews.list(actor, "bills");
    expect(listed.some((item) => item.id === view.id)).toBe(true);
    await savedViews.remove(actor, view.id);
    await expect(savedViews.remove(other, view.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const pinged = await integrations.ping(actor, integrationId);
    expect(pinged.health).toBe("HEALTHY");
    expect(pinged.cursor?.startsWith("mock_")).toBe(true);

    const search = await searchOrganization(actor, `AcmeSearch ${suffix}`);
    expect(search.total).toBeGreaterThan(0);
    expect(search.results?.some((hit) => hit.type === "vendor")).toBe(true);
  });
});
