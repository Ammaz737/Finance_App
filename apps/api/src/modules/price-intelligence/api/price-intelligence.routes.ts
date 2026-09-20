import { Router } from "express";
import { priceIntelligenceController } from "./price-intelligence.controller";

export const priceIntelligenceRouter = Router();

priceIntelligenceRouter.get("/", priceIntelligenceController);
