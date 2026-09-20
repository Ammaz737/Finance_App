import type { Request, Response } from "express";

export function organizationController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'organizations' is scaffolded. Implement application use cases next.",
    },
  });
}
