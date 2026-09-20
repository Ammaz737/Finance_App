import { Router } from "express";
import { taxOperationController } from "./tax-operation.controller";

export const taxOperationRouter = Router();

taxOperationRouter.get("/", taxOperationController);
