import { Router } from "express";
import { fundController } from "./fund.controller";

export const fundRouter = Router();

fundRouter.get("/", fundController);
