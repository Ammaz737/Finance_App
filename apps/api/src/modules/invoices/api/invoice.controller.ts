import type { Request, Response } from "express";

export function invoiceController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'invoices' is scaffolded. Implement application use cases next.",
    },
  });
}
