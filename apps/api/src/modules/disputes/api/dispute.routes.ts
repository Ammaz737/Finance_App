import { Router } from "express";
import { disputeController } from "./dispute.controller";

export const disputeRouter = Router();

disputeRouter.get("/", disputeController);
