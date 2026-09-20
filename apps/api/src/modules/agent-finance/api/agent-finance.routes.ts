import { Router } from "express";
import { agentFinanceController } from "./agent-finance.controller";

export const agentFinanceRouter = Router();

agentFinanceRouter.get("/", agentFinanceController);
