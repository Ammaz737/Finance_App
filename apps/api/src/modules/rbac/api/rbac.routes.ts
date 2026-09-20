import { Router } from "express";
import { rbacController } from "./rbac.controller";

export const rbacRouter = Router();

rbacRouter.get("/", rbacController);
