import type { Request, Response } from "express";

export function paymentController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'payments' is scaffolded. Implement application use cases next.",
    },
  });
}
