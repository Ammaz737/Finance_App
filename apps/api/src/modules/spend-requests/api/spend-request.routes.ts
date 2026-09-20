import { Router } from "express";
import { spendRequestController } from "./spend-request.controller";

export const spendRequestRouter = Router();

spendRequestRouter.get("/", spendRequestController);
