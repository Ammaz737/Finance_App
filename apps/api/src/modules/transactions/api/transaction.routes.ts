import { Router } from "express";
import { transactionController } from "./transaction.controller";

export const transactionRouter = Router();

transactionRouter.get("/", transactionController);
