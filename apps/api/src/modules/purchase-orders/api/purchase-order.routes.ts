import { Router } from "express";
import { purchaseOrderController } from "./purchase-order.controller";

export const purchaseOrderRouter = Router();

purchaseOrderRouter.get("/", purchaseOrderController);
