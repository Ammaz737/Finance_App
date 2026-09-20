import { Router } from "express";
import { billController } from "./bill.controller";

export const billRouter = Router();

billRouter.get("/", billController);
