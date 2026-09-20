import { Router } from "express";
import { entityController } from "./entity.controller";

export const entityRouter = Router();

entityRouter.get("/", entityController);
