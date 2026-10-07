import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const orgIds: string[] = [];

describe("QuickBooks tenant constraints", () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => {
    if (orgIds.length) {
      await prisma.quickBooksEntityMap.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.quickBooksConnection.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.providerOAuthState.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.integrationConnection.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.$disconnect();
  });

  it("rejects cross-tenant provider mappings and OAuth user references", async () => {
    const [orgA, orgB] = await Promise.all([
      prisma.organization.create({ data: { name: `QBO A ${suffix}`, slug: `qbo-a-${suffix}` } }),
      prisma.organization.create({ data: { name: `QBO B ${suffix}`, slug: `qbo-b-${suffix}` } }),
    ]);
    orgIds.push(orgA.id, orgB.id);
    const [userA, integrationA] = await Promise.all([
      prisma.user.create({
        data: { organizationId: orgA.id, email: `qbo-a-${suffix}@example.test`, passwordHash: "test", firstName: "QBO", lastName: "A", status: "ACTIVE" },
      }),
      prisma.integrationConnection.create({
        data: { organizationId: orgA.id, family: "AccountingProvider", provider: "QUICKBOOKS_ONLINE", status: "CONNECTED" },
      }),
    ]);
    const connectionA = await prisma.quickBooksConnection.create({
      data: {
        organizationId: orgA.id,
        integrationConnectionId: integrationA.id,
        realmId: `realm-${suffix}`,
        accessTokenEncrypted: "encrypted-access",
        refreshTokenEncrypted: "encrypted-refresh",
        accessTokenExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(prisma.quickBooksEntityMap.create({
      data: {
        organizationId: orgB.id,
        quickBooksConnectionId: connectionA.id,
        entityType: "ACCOUNT",
        externalId: "1",
      },
    })).rejects.toThrow();

    await expect(prisma.providerOAuthState.create({
      data: {
        organizationId: orgB.id,
        userId: userA.id,
        provider: "QUICKBOOKS_ONLINE",
        stateHash: `state-${suffix}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })).rejects.toThrow();
  });
});
