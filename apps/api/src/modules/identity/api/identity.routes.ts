import { Router } from "express";
import { identityController } from "./identity.controller";

export const identityRouter = Router();

identityRouter.get("/", identityController);
