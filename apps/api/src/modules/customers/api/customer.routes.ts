import { Router } from "express";
import { customerController } from "./customer.controller";

export const customerRouter = Router();

customerRouter.get("/", customerController);
