import { Router } from "express";
import { organizationController } from "./organization.controller";

export const organizationRouter = Router();

organizationRouter.get("/", organizationController);
