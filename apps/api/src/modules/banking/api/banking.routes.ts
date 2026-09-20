import { Router } from "express";
import { bankingController } from "./banking.controller";

export const bankingRouter = Router();

bankingRouter.get("/", bankingController);
