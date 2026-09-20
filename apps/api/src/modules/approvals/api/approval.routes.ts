import { Router } from "express";
import { approvalController } from "./approval.controller";

export const approvalRouter = Router();

approvalRouter.get("/", approvalController);
