import type { Request, Response } from "express";

export function collectionController(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module 'collections' is scaffolded. Implement application use cases next.",
    },
  });
}
