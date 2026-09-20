import { Router } from "express";
import { sourcingController } from "./sourcing.controller";

export const sourcingRouter = Router();

sourcingRouter.get("/", sourcingController);
