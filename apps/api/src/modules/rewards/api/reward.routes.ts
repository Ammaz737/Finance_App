import { Router } from "express";
import { rewardController } from "./reward.controller";

export const rewardRouter = Router();

rewardRouter.get("/", rewardController);
