import { Router } from "express";
import { policyController } from "./policy.controller";

export const policyRouter = Router();

policyRouter.get("/", policyController);
