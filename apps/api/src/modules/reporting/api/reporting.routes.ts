import { Router } from "express";
import { reportingController } from "./reporting.controller";

export const reportingRouter = Router();

reportingRouter.get("/", reportingController);
