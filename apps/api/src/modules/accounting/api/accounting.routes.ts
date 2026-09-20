import { Router } from "express";
import { accountingController } from "./accounting.controller";

export const accountingRouter = Router();

accountingRouter.get("/", accountingController);
