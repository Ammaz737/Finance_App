import { Router } from "express";
import { getContext, type RequestContext } from "./auth/context";
import { fail, ok } from "./http";
import { assertEntityPermission, assertResourcePermission, resourceRule, scopedWhere } from "./resource-access";

type Delegate = {
  findMany: (args: object) => Promise<unknown>;
  findFirst: (args: object) => Promise<unknown>;
  create: (args: object) => Promise<unknown>;
};

function redact(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(redact);
  if (data && typeof data === "object" && data.constructor === Object) {
    return Object.fromEntries(Object.entries(data as Record<string, unknown>)
      .filter(([key]) => !["passwordHash", "clientSecretHash", "token", "secret", "taxId"].includes(key))
      .map(([key, value]) => [key, redact(value)]));
  }
  return data;
}

export function createResourceRouter(options: {
  getDelegate: () => Delegate;
  searchField?: string;
  select?: Record<string, boolean>;
  create?: (ctx: RequestContext, body: Record<string, unknown>) => Promise<unknown>;
  get?: (ctx: RequestContext, id: string, query: Record<string, unknown>) => Promise<unknown>;
  actions?: Record<string, (ctx: RequestContext, id: string, body: Record<string, unknown>) => Promise<unknown>>;
}) {
  const router = Router();

  function resourceName(req: { baseUrl: string }) {
    return req.baseUrl.split("/").filter(Boolean).at(-1) ?? "";
  }

  router.get("/", async (req, res, next) => {
    try {
      const ctx = getContext(req);
      const resource = resourceName(req);
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const where: Record<string, unknown> = await scopedWhere(ctx, resource);
      if (q && options.searchField) {
        where[options.searchField] = { contains: q, mode: "insensitive" };
      }
      const items = await options.getDelegate().findMany({
        where,
        ...(options.select ? { select: options.select } : {}),
        take: 100,
        orderBy: { id: "desc" },
      });
      return ok(res, redact(items));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const ctx = getContext(req);
      if (options.get) {
        return ok(res, redact(await options.get(ctx, req.params.id, req.query as Record<string, unknown>)));
      }
      const where = await scopedWhere(ctx, resourceName(req));
      const item = await options.getDelegate().findFirst({
        where: { ...where, id: req.params.id },
        ...(options.select ? { select: options.select } : {}),
      });
      if (!item) {
        return fail(res, "NOT_FOUND", "Record not found", 404);
      }
      return ok(res, redact(item));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const ctx = getContext(req);
      const rule = resourceRule(resourceName(req));
      assertResourcePermission(ctx, rule.create);
      if (rule.create && rule.entityField === "legalEntityId" && typeof req.body?.legalEntityId === "string") {
        assertEntityPermission(ctx, rule.create, req.body.legalEntityId);
      }
      if (options.create) {
        return ok(res, redact(await options.create(ctx, req.body ?? {})), {}, 201);
      }
      return fail(res, "NOT_IMPLEMENTED", "This resource cannot be created yet", 501);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/:action", async (req, res, next) => {
    try {
      const ctx = getContext(req);
      const resource = resourceName(req);
      const action = options.actions?.[req.params.action];
      if (!action) {
        return fail(res, "UNKNOWN_ACTION", `Action ${req.params.action} is not supported`, 404);
      }
      const permission = resourceRule(resource).actions?.[req.params.action];
      assertResourcePermission(ctx, permission);
      const where = await scopedWhere(ctx, resource, permission ? [permission] : []);
      const item = await options.getDelegate().findFirst({ where: { ...where, id: req.params.id }, ...(options.select ? { select: options.select } : {}) });
      if (!item) return fail(res, "NOT_FOUND", "Record not found", 404);
      return ok(res, redact(await action(ctx, req.params.id, req.body ?? {})));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
