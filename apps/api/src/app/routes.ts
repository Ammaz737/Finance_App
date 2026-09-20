import { routers } from "../modules/registry";
import { Router } from "express";

export function buildApiRouter(): Router {
  const api = Router();
  for (const [name, router] of Object.entries(routers)) {
    api.use(`/${name}`, router);
  }
  api.use("/auth", routers.identity);
  return api;
}
