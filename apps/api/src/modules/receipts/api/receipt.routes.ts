import { Router } from "express";
import { receiptController } from "./receipt.controller";

export const receiptRouter = Router();

receiptRouter.get("/", receiptController);
