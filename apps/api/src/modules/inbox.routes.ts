import { Router } from "express";
import { z } from "zod";
import { getContext } from "../platform/auth/context";
import { ok } from "../platform/http";
import { decideInboxTask, getInboxTaskDetail, listInboxTasks } from "../engines/inbox";

export const inboxRouter = Router();

inboxRouter.get("/", async (req, res, next) => {
  try {
    const ctx = getContext(req);
    return ok(res, await listInboxTasks(ctx));
  } catch (error) { next(error); }
});

inboxRouter.get("/:id", async (req, res, next) => {
  try {
    const ctx = getContext(req);
    return ok(res, await getInboxTaskDetail(ctx, req.params.id));
  } catch (error) { next(error); }
});

inboxRouter.post("/:id/:decision", async (req, res, next) => {
  try {
    const ctx = getContext(req);
    const decision = z.enum(["approve", "reject", "request_info", "release"]).parse(req.params.decision);
    const comment = String(req.body?.comment ?? "");
    const result = await decideInboxTask(ctx, req.params.id, decision, comment);
    const remaining = await listInboxTasks(ctx);
    return ok(res, { result, nextTaskId: remaining[0]?.id ?? null, remaining: remaining.length });
  } catch (error) { next(error); }
});
