import { Router } from "express";
import { paymentRunController } from "./payment-run.controller";

export const paymentRunRouter = Router();

paymentRunRouter.get("/", paymentRunController);
