import type { Request, Response } from "express";

export function identityController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'identity' is scaffolded. Implement application use cases next.",
    },
  });
}
