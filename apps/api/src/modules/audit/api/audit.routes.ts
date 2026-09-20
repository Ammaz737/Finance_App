import { Router } from "express";
import { auditController } from "./audit.controller";

export const auditRouter = Router();

auditRouter.get("/", auditController);
