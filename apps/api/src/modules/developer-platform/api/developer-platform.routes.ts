import { Router } from "express";
import { developerPlatformController } from "./developer-platform.controller";

export const developerPlatformRouter = Router();

developerPlatformRouter.get("/", developerPlatformController);
