import { Router } from "express";
import { authorizationController } from "./authorization.controller";

export const authorizationRouter = Router();

authorizationRouter.get("/", authorizationController);
