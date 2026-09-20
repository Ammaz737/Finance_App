import { Router } from "express";
import { reimbursementController } from "./reimbursement.controller";

export const reimbursementRouter = Router();

reimbursementRouter.get("/", reimbursementController);
