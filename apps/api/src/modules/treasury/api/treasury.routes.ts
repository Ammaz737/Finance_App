import { Router } from "express";
import { treasuryController } from "./treasury.controller";

export const treasuryRouter = Router();

treasuryRouter.get("/", treasuryController);
