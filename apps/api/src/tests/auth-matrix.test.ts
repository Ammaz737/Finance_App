import { describe, expect, it } from "vitest";
import { assertResourcePermission, resourceRule } from "../platform/resource-access";
import type { RequestContext } from "../platform/auth/context";
import { ROUTE_AUTHORIZATION_MATRIX, ROLE_PERMISSIONS } from "./auth-matrix";

function ctxFor(role: keyof typeof ROLE_PERMISSIONS): RequestContext {
  const permissions = ROLE_PERMISSIONS[role];
  return {
    actorType: "INTERNAL_USER",
    userId: `user-${role}`,
    organizationId: "org-1",
    entityIds: ["entity-1"],
    roles: [role],
    permissions,
    grants: permissions.map((permission) => ({
      permission,
      scope: permission === "*" ? "ORGANIZATION" : "ORGANIZATION",
      entityId: null,
    })),
    entitlements: [],
    sessionId: "s1",
    correlationId: "c1",
  };
}

function permissionFor(resource: string, action: string): string | undefined {
  const rule = resourceRule(resource);
  if (action === "read") return rule.read?.[0];
  if (action === "create") return rule.create;
  return rule.actions?.[action];
}

describe("API authorization matrix", () => {
  for (const row of ROUTE_AUTHORIZATION_MATRIX) {
    it(`${row.resource}.${row.action} — Owner/Finance/Manager/Employee`, () => {
      const permission = permissionFor(row.resource, row.action);
      const roles = [
        ["Owner", row.owner],
        ["Finance Admin", row.financeAdmin],
        ["Manager", row.manager],
        ["Employee", row.employee],
      ] as const;

      for (const [role, allowed] of roles) {
        const ctx = ctxFor(role);
        if (allowed) {
          expect(() => assertResourcePermission(ctx, permission)).not.toThrow();
        } else if (permission) {
          expect(() => assertResourcePermission(ctx, permission)).toThrow(/Missing permission/);
        }
      }
    });
  }

  it("keeps unlisted resources Owner-only by default", () => {
    expect(resourceRule("sheets")).toEqual({});
    expect(() => assertResourcePermission(ctxFor("Employee"), "anything")).toThrow();
    expect(() => assertResourcePermission(ctxFor("Owner"), undefined)).not.toThrow();
  });
});
