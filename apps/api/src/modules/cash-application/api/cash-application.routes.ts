import { Router } from "express";
import { cashApplicationController } from "./cash-application.controller";

export const cashApplicationRouter = Router();

cashApplicationRouter.get("/", cashApplicationController);
