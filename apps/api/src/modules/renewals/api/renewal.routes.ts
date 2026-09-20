import { Router } from "express";
import { renewalController } from "./renewal.controller";

export const renewalRouter = Router();

renewalRouter.get("/", renewalController);
