import { describe, expect, it, vi } from "vitest";
import { scopedWhere } from "../platform/resource-access";
import type { RequestContext } from "../platform/auth/context";

vi.mock("../database/client", () => {
  const users = [
    { id: "mgr", organizationId: "tenant-1", departmentId: "dept-1", managerId: null },
    { id: "peer-a", organizationId: "tenant-1", departmentId: "dept-1", managerId: "mgr" },
    { id: "peer-b", organizationId: "tenant-1", departmentId: "dept-1", managerId: "mgr" },
    { id: "other", organizationId: "tenant-1", departmentId: "dept-2", managerId: null },
  ];
  return {
    prisma: {
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

describe("DEPARTMENT data scope", () => {
  it("limits owner-field resources to department peers", async () => {
    const ctx: RequestContext = {
      actorType: "INTERNAL_USER",
      userId: "peer-a",
      organizationId: "tenant-1",
      entityIds: [],
      roles: ["Manager"],
      permissions: ["expense.read"],
      grants: [{ permission: "expense.read", scope: "DEPARTMENT", entityId: null }],
      entitlements: [],
      sessionId: "s",
      correlationId: "c",
    };
    expect(await scopedWhere(ctx, "expenses")).toEqual({
      organizationId: "tenant-1",
      OR: [{ userId: { in: ["mgr", "peer-a", "peer-b"] } }],
    });
  });
});
