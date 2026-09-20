import type { Request, Response } from "express";

export function rbacController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'rbac' is scaffolded. Implement application use cases next.",
    },
  });
}
