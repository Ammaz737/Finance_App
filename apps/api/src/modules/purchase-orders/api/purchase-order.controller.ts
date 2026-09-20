import type { Request, Response } from "express";

export function purchaseOrderController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'purchase-orders' is scaffolded. Implement application use cases next.",
    },
  });
}
