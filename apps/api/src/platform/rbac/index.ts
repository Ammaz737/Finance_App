import type { RequestContext } from "../auth/context";
import { AppError } from "../http";

export function can(ctx: RequestContext, permission: string) {
  return ctx.roles.includes("Owner") || ctx.permissions.includes("*") || ctx.permissions.includes(permission);
}

export function assertCan(ctx: RequestContext, permission: string) {
  if (!can(ctx, permission)) {
    throw new AppError("FORBIDDEN", `Missing permission ${permission}`, 403);
  }
}

export function assertOrg(ctx: RequestContext, organizationId: string) {
  if (ctx.organizationId !== organizationId) {
    throw new AppError("FORBIDDEN", "Cross-tenant access denied", 403);
  }
}
