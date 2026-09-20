import { Router } from "express";
import { aiController } from "./ai.controller";

export const aiRouter = Router();

aiRouter.get("/", aiController);
