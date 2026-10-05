import { describe, expect, it, vi } from "vitest";
import { assertEntityPermission, scopedWhere } from "../platform/resource-access";
import type { RequestContext } from "../platform/auth/context";

vi.mock("../database/client", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async ({ where }: { where: { managerId?: string } }) =>
        where.managerId === "manager-1" ? [{ id: "report-1" }, { id: "report-2" }] : [],
      ),
      findFirst: vi.fn(async () => null),
    },
    card: { findMany: vi.fn(async () => []) },
  },
}));

const context: RequestContext = {
  actorType: "INTERNAL_USER", userId: "user-1", organizationId: "tenant-1", entityIds: ["entity-1"],
  roles: ["Finance"], permissions: ["bill.create", "payment.create"],
  grants: [
    { permission: "bill.create", scope: "ENTITY", entityId: "entity-1" },
    { permission: "payment.create", scope: "ENTITY", entityId: "entity-1" },
  ],
  entitlements: [], sessionId: "session-1", correlationId: "request-1",
};

describe("entity-scoped financial access", () => {
  it("limits bill reads to the assigned tenant and entity", async () => {
    expect(await scopedWhere(context, "bills")).toEqual({
      organizationId: "tenant-1", OR: [{ legalEntityId: { in: ["entity-1"] } }],
    });
  });

  it("rejects a write to another entity even when the permission key is present", () => {
    expect(() => assertEntityPermission(context, "payment.create", "entity-1")).not.toThrow();
    expect(() => assertEntityPermission(context, "payment.create", "entity-2")).toThrowError(/this entity/);
  });

  it("scopes purchase orders for Manager DIRECT_REPORTS via ownerId", async () => {
    const manager: RequestContext = {
      actorType: "INTERNAL_USER",
      userId: "manager-1",
      organizationId: "tenant-1",
      entityIds: ["entity-1"],
      roles: ["Manager"],
      permissions: ["procurement.review"],
      grants: [{ permission: "procurement.review", scope: "DIRECT_REPORTS", entityId: "entity-1" }],
      entitlements: ["procurement"],
      sessionId: "session-2",
      correlationId: "request-2",
    };
    expect(await scopedWhere(manager, "purchase-orders")).toEqual({
      organizationId: "tenant-1",
      OR: [{ ownerId: { in: ["report-1", "report-2"] } }],
    });
  });
});
