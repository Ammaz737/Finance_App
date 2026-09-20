import { Router } from "express";
import { cardController } from "./card.controller";

export const cardRouter = Router();

cardRouter.get("/", cardController);
