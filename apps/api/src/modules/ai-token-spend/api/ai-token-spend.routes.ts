import { Router } from "express";
import { aiTokenSpendController } from "./ai-token-spend.controller";

export const aiTokenSpendRouter = Router();

aiTokenSpendRouter.get("/", aiTokenSpendController);
