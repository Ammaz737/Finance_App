import { Router } from "express";
import { budgetController } from "./budget.controller";

export const budgetRouter = Router();

budgetRouter.get("/", budgetController);
