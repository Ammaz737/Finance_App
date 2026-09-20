import { Router } from "express";
import { vendorController } from "./vendor.controller";

export const vendorRouter = Router();

vendorRouter.get("/", vendorController);
