import { Router } from "express";
import { licenseIntelligenceController } from "./license-intelligence.controller";

export const licenseIntelligenceRouter = Router();

licenseIntelligenceRouter.get("/", licenseIntelligenceController);
