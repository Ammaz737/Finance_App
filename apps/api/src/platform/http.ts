import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

export function ok(res: Response, data: unknown, meta: Record<string, unknown> = {}, status = 200) {
  return res.status(status).json({
    data,
    meta: { requestId: res.locals.requestId, ...meta },
  });
}

export function fail(res: Response, code: string, message: string, status = 400, details?: unknown) {
  return res.status(status).json({
    error: {
      code,
      message,
      details: details ?? {},
      requestId: res.locals.requestId,
    },
  });
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return fail(res, err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return fail(res, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid request", 400, err.issues);
  }
  console.error(err);
  return fail(res, "INTERNAL_ERROR", "Unexpected error", 500);
}
