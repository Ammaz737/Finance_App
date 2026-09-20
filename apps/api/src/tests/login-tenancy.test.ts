import { beforeAll, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ hash: "", users: [] as Array<{ id: string; organizationId: string; email: string; passwordHash: string; status: string }> }));

vi.mock("../database/client", () => ({
  prisma: {
    organization: { findUnique: async ({ where }: { where: { slug: string } }) => where.slug === "acme" ? { id: "tenant-acme" } : where.slug === "beta" ? { id: "tenant-beta" } : null },
    user: { findMany: async ({ where, take }: { where: { email: string; organizationId?: string }; take: number }) => fixture.users.filter((user) => user.email === where.email && (!where.organizationId || user.organizationId === where.organizationId)).slice(0, take) },
    session: { create: async ({ data }: { data: { organizationId: string; userId: string } }) => ({ id: "session-1", ...data }) },
  },
}));

import { hashPassword, login } from "../platform/auth";

beforeAll(async () => {
  fixture.hash = await hashPassword("correct-password");
  fixture.users = [
    { id: "user-acme", organizationId: "tenant-acme", email: "shared@example.test", passwordHash: fixture.hash, status: "ACTIVE" },
    { id: "user-beta", organizationId: "tenant-beta", email: "shared@example.test", passwordHash: fixture.hash, status: "ACTIVE" },
  ];
});

describe("workspace identity", () => {
  it("requires a workspace when an email belongs to more than one tenant", async () => {
    await expect(login("shared@example.test", "correct-password")).rejects.toMatchObject({ code: "WORKSPACE_REQUIRED", status: 400 });
  });

  it("signs in only the user in the selected workspace", async () => {
    const result = await login("shared@example.test", "correct-password", "beta");
    expect(result.user.id).toBe("user-beta");
    await expect(login("shared@example.test", "wrong-password", "beta")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
  });
});
