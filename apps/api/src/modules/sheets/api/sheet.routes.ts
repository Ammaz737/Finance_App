import { Router } from "express";
import { sheetController } from "./sheet.controller";

export const sheetRouter = Router();

sheetRouter.get("/", sheetController);
