import type { Request, Response } from "express";

export function spendRequestController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'spend-requests' is scaffolded. Implement application use cases next.",
    },
  });
}
