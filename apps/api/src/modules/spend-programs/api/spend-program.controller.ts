import type { Request, Response } from "express";

export function spendProgramController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'spend-programs' is scaffolded. Implement application use cases next.",
    },
  });
}
