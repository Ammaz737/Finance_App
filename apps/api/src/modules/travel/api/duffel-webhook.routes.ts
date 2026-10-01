import { Router } from "express";
import { processDuffelWebhook } from "../application/duffel-webhook";
import { AppError, ok } from "../../../platform/http";

export const duffelWebhookRouter = Router();

duffelWebhookRouter.post("/", async (req, res, next) => {
  try {
    const signature = req.headers["x-duffel-signature"];
    if (typeof signature !== "string" || !signature.trim()) {
      throw new AppError("UNAUTHORIZED", "Missing X-Duffel-Signature", 400);
    }
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) {
      throw new AppError("INVALID_BODY", "Webhook requires raw body", 400);
    }
    const result = await processDuffelWebhook(raw, signature);
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
});
