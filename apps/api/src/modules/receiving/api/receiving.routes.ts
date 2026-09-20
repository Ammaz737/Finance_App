import { Router } from "express";
import { receivingController } from "./receiving.controller";

export const receivingRouter = Router();

receivingRouter.get("/", receivingController);
