import { Router } from "express";
import { peopleController } from "./people.controller";

export const peopleRouter = Router();

peopleRouter.get("/", peopleController);
