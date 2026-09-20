import { Router } from "express";
import { travelController } from "./travel.controller";

export const travelRouter = Router();

travelRouter.get("/", travelController);
