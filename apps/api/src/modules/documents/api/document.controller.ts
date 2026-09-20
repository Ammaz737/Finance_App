import type { Request, Response } from "express";

export function documentController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'documents' is scaffolded. Implement application use cases next.",
    },
  });
}
