import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../database/client";
import { env } from "../../config/env";
import { AppError, fail } from "../http";
import type { RequestContext } from "./context";

const TOKEN_TTL = "12h";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: object) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

export async function createSession(organizationId: string, userId: string) {
  const token = signToken({ sub: userId, org: organizationId, jti: crypto.randomUUID() });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { organizationId, userId, tokenHash, expiresAt },
  });
  return { token, session };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      return fail(res, "UNAUTHENTICATED", "Authentication required", 401);
    }
    const claims = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.expiresAt < new Date()) {
      return fail(res, "UNAUTHENTICATED", "Session expired", 401);
    }
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.status !== "ACTIVE" || user.organizationId !== session.organizationId || claims.sub !== user.id || claims.org !== user.organizationId) {
      return fail(res, "UNAUTHENTICATED", "User is not active", 401);
    }
    const userRoles = await prisma.userRole.findMany({ where: { userId: user.id, organizationId: user.organizationId } });
    const roles = await prisma.role.findMany({
      where: { id: { in: userRoles.map((r) => r.roleId) }, organizationId: user.organizationId },
    });
    const validRoleIds = new Set(roles.map((role) => role.id));
    const validAssignments = userRoles.filter((assignment) => validRoleIds.has(assignment.roleId));
    const assignedEntityIds = validAssignments.map((assignment) => assignment.entityId).filter((id): id is string => Boolean(id));
    const entities = await prisma.legalEntity.findMany({ where: { organizationId: user.organizationId, id: { in: assignedEntityIds } }, select: { id: true } });
    const validEntityIds = new Set(entities.map((entity) => entity.id));
    const scopedAssignments = validAssignments.filter((assignment) => !assignment.entityId || validEntityIds.has(assignment.entityId));
    const scopedRoleIds = new Set(scopedAssignments.map((assignment) => assignment.roleId));
    const scopedRoles = roles.filter((role) => scopedRoleIds.has(role.id));
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: { in: scopedRoles.map((r) => r.id) } },
    });
    const permissionRows = await prisma.permission.findMany({
      where: { id: { in: rolePermissions.map((r) => r.permissionId) } },
    });
    // Owner is an organization role in this schema even when its seed assignment names a home entity.
    const ownerOrganization = scopedAssignments.some((assignment) => scopedRoles.some((role) => role.id === assignment.roleId && role.name === "Owner"));
    const organizationWildcard = ownerOrganization || scopedAssignments.some((assignment) => !assignment.entityId && rolePermissions.some((grant) => grant.roleId === assignment.roleId && grant.scope === "ORGANIZATION" && permissionRows.some((permission) => permission.id === grant.permissionId && permission.key === "*")));
    const entitlements = await prisma.entitlement.findMany({
      where: { organizationId: user.organizationId, enabled: true },
    });
    const context: RequestContext = {
      actorType: "INTERNAL_USER",
      userId: user.id,
      organizationId: user.organizationId,
      entityIds: scopedAssignments.map((r) => r.entityId).filter((id): id is string => Boolean(id)),
      roles: scopedRoles.map((r) => r.name).filter((name) => name !== "Owner" || ownerOrganization),
      permissions: permissionRows.map((p) => p.key).filter((key) => key !== "*" || organizationWildcard),
      grants: scopedAssignments.flatMap((assignment) =>
        rolePermissions
          .filter((grant) => grant.roleId === assignment.roleId)
          .map((grant) => ({
            permission: permissionRows.find((permission) => permission.id === grant.permissionId)?.key ?? "",
            scope: assignment.entityId && grant.scope === "ORGANIZATION" ? "ENTITY" : grant.scope,
            entityId: assignment.entityId,
          }))
          .filter((grant) => grant.permission),
      ),
      entitlements: entitlements.map((e) => e.featureKey),
      sessionId: session.id,
      correlationId: res.locals.requestId,
    };
    (req as Request & { context: RequestContext }).context = context;
    next();
  } catch {
    return fail(res, "UNAUTHENTICATED", "Invalid token", 401);
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = (req as Request & { context?: RequestContext }).context;
    if (!ctx) {
      return fail(res, "UNAUTHENTICATED", "Authentication required", 401);
    }
    if (ctx.roles.includes("Owner") || ctx.permissions.includes("*") || ctx.permissions.includes(permission)) {
      return next();
    }
    return fail(res, "FORBIDDEN", `Missing permission ${permission}`, 403);
  };
}

export async function login(email: string, password: string, workspace?: string) {
  const organization = workspace ? await prisma.organization.findUnique({ where: { slug: workspace.toLowerCase() }, select: { id: true } }) : null;
  if (workspace && !organization) throw new AppError("INVALID_CREDENTIALS", "Invalid email, workspace, or password", 401);
  const candidates = await prisma.user.findMany({
    where: { email: email.toLowerCase(), ...(organization ? { organizationId: organization.id } : {}) },
    take: 2,
  });
  if (!workspace && candidates.length > 1) throw new AppError("WORKSPACE_REQUIRED", "Enter your workspace to sign in", 400);
  const user = candidates[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid email, workspace, or password", 401);
  }
  if (user.status !== "ACTIVE") {
    throw new AppError("USER_NOT_ACTIVE", "User is not active", 403);
  }
  const { token, session } = await createSession(user.organizationId, user.id);
  return { token, sessionId: session.id, user };
}
