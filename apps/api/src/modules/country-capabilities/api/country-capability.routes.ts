import { Router } from "express";
import { countryCapabilityController } from "./country-capability.controller";

export const countryCapabilityRouter = Router();

countryCapabilityRouter.get("/", countryCapabilityController);
