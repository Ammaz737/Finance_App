import { Router } from "express";
import { repaymentController } from "./repayment.controller";

export const repaymentRouter = Router();

repaymentRouter.get("/", repaymentController);
