import { Router } from "express";
import { contractController } from "./contract.controller";

export const contractRouter = Router();

contractRouter.get("/", contractController);
