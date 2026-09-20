import { Router } from "express";
import { integrationController } from "./integration.controller";

export const integrationRouter = Router();

integrationRouter.get("/", integrationController);
