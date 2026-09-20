import { Router } from "express";
import { collectionController } from "./collection.controller";

export const collectionRouter = Router();

collectionRouter.get("/", collectionController);
