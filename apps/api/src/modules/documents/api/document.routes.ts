import { Router } from "express";
import { documentController } from "./document.controller";

export const documentRouter = Router();

documentRouter.get("/", documentController);
