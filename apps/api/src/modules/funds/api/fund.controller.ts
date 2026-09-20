import type { Request, Response } from "express";

export function fundController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'funds' is scaffolded. Implement application use cases next.",
    },
  });
}
