import express from "express";
import cors from "cors";
import { buildApiRouter } from "./routes";
import { requestId, errorHandler } from "../platform/http";
import { requireAuth } from "../platform/auth";
import { allowedCorsOrigins } from "../config/env";
import { stripeWebhookRouter } from "../modules/cards/api/stripe-webhook.routes";

export function createApp() {
  const app = express();
  const corsOrigins = allowedCorsOrigins();
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || corsOrigins.has(origin.replace(/\/$/, ""))) return callback(null, true);
      return callback(null, false);
    },
  }));

  // Stripe webhooks need the raw body for signature verification — mount before json parser.
  app.use("/api/v1/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRouter);

  app.use(express.json({ limit: "8mb" }));
  app.use(requestId);
  app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });
  app.use("/api/v1", (req, res, next) => {
    if (req.method === "POST" && (
      req.path === "/identity/login" || req.path === "/auth/login" ||
      req.path === "/identity/activate" || req.path === "/auth/activate" ||
      req.path === "/identity/forgot-password" || req.path === "/auth/forgot-password" ||
      req.path === "/identity/reset-password" || req.path === "/auth/reset-password" ||
      req.path.startsWith("/webhooks/")
    )) {
      return next();
    }
    return requireAuth(req, res, next);
  });
  app.use("/api/v1", buildApiRouter());
  app.use(errorHandler);
  return app;
}
