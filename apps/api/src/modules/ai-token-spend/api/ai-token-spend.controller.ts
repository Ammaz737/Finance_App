import type { Request, Response } from "express";

export function aiTokenSpendController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'ai-token-spend' is scaffolded. Implement application use cases next.",
    },
  });
}
