import { Router } from "express";
import { entitlementController } from "./entitlement.controller";

export const entitlementRouter = Router();

entitlementRouter.get("/", entitlementController);
