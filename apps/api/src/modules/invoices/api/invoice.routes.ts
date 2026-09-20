import { Router } from "express";
import { invoiceController } from "./invoice.controller";

export const invoiceRouter = Router();

invoiceRouter.get("/", invoiceController);
