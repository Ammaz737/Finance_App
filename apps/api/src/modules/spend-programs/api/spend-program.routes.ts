import { Router } from "express";
import { spendProgramController } from "./spend-program.controller";

export const spendProgramRouter = Router();

spendProgramRouter.get("/", spendProgramController);
