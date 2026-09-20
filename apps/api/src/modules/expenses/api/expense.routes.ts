import { Router } from "express";
import { expenseController } from "./expense.controller";

export const expenseRouter = Router();

expenseRouter.get("/", expenseController);
