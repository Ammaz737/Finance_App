import type { Request, Response } from "express";

export function renewalController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'renewals' is scaffolded. Implement application use cases next.",
    },
  });
}
