import { Router } from "express";
import { erpSyncController } from "./erp-sync.controller";

export const erpSyncRouter = Router();

erpSyncRouter.get("/", erpSyncController);
