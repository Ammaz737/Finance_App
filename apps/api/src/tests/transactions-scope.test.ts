import { describe, expect, it, vi } from "vitest";
import { scopedWhere } from "../platform/resource-access";
import type { RequestContext } from "../platform/auth/context";

vi.mock("../database/client", () => {
  const cards = [
    { id: "card-elena", organizationId: "tenant-1", holderId: "elena" },
    { id: "card-other", organizationId: "tenant-1", holderId: "other" },
  ];
  const users = [
    { id: "elena", organizationId: "tenant-1", departmentId: "dept-1", managerId: "mgr" },
    { id: "report", organizationId: "tenant-1", departmentId: "dept-1", managerId: "mgr" },
    { id: "mgr", organizationId: "tenant-1", departmentId: "dept-1", managerId: null },
  ];
  return {
    prisma: {
      card: {
        findMany: async ({ where }: { where: { organizationId?: string; holderId?: { in?: string[] } } }) =>
          cards.filter((card) => {
            if (where.organizationId && card.organizationId !== where.organizationId) return false;
            if (where.holderId?.in && !where.holderId.in.includes(card.holderId)) return false;
            return true;
          }),
      },
      user: {
        findFirst: async ({ where }: { where: { id?: string; organizationId?: string } }) =>
          users.find((u) => u.id === where.id && u.organizationId === where.organizationId) ?? null,
        findMany: async ({ where }: { where: { organizationId?: string; departmentId?: string; managerId?: string } }) =>
          users.filter((u) => {
            if (where.organizationId && u.organizationId !== where.organizationId) return false;
            if (where.departmentId && u.departmentId !== where.departmentId) return false;
            if (where.managerId && u.managerId !== where.managerId) return false;
            return true;
          }),
      },
    },
  };
});

describe("card-scoped transactions access", () => {
  it("scopes SELF card.read to the holder’s card ids", async () => {
    const ctx: RequestContext = {
      actorType: "INTERNAL_USER",
      userId: "elena",
      organizationId: "tenant-1",
      entityIds: ["entity-1"],
      roles: ["Employee"],
      permissions: ["card.read", "expense.read"],
      grants: [
        { permission: "card.read", scope: "SELF", entityId: "entity-1" },
        { permission: "expense.read", scope: "SELF", entityId: "entity-1" },
      ],
      entitlements: ["cards", "expenses"],
      sessionId: "s",
      correlationId: "c",
    };
    expect(await scopedWhere(ctx, "transactions")).toEqual({
      organizationId: "tenant-1",
      OR: [{ cardId: { in: ["card-elena"] } }],
    });
  });

  it("does not fall back to tenant-wide when SELF has no cards", async () => {
    const ctx: RequestContext = {
      actorType: "INTERNAL_USER",
      userId: "ghost",
      organizationId: "tenant-1",
      entityIds: ["entity-1"],
      roles: ["Employee"],
      permissions: ["card.read"],
      grants: [{ permission: "card.read", scope: "SELF", entityId: "entity-1" }],
      entitlements: ["cards"],
      sessionId: "s",
      correlationId: "c",
    };
    expect(await scopedWhere(ctx, "transactions")).toEqual({
      organizationId: "tenant-1",
      OR: [{ cardId: { in: [] } }],
    });
  });
});
