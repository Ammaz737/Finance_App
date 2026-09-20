import { Router } from "express";
import { routerController } from "./router.controller";

export const routerRouter = Router();

routerRouter.get("/", routerController);
