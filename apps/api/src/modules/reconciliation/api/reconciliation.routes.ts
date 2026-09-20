import { Router } from "express";
import { reconciliationController } from "./reconciliation.controller";

export const reconciliationRouter = Router();

reconciliationRouter.get("/", reconciliationController);
