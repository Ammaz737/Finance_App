import { Router } from "express";
import { processStripeIssuingWebhook } from "../application/stripe-issuing-webhook";
import { AppError, ok } from "../../../platform/http";

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/", async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") throw new AppError("UNAUTHORIZED", "Missing Stripe-Signature", 400);
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) throw new AppError("INVALID_BODY", "Webhook requires raw body", 400);
    const result = await processStripeIssuingWebhook(raw, signature);
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
});
