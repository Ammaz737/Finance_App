import { Router } from "express";
import { procurementController } from "./procurement.controller";

export const procurementRouter = Router();

procurementRouter.get("/", procurementController);
