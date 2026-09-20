import { describe, expect, it } from "vitest";
import { assertEntityPermission, scopedWhere } from "../platform/resource-access";
import type { RequestContext } from "../platform/auth/context";

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
});
