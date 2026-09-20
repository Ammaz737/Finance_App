import type { Request, Response } from "express";

export function expenseController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'expenses' is scaffolded. Implement application use cases next.",
    },
  });
}
