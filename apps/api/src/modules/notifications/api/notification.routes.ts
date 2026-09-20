import { Router } from "express";
import { notificationController } from "./notification.controller";

export const notificationRouter = Router();

notificationRouter.get("/", notificationController);
