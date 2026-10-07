import { Router } from "express";
import { env } from "../../../config/env";
import {
  completeQuickBooksOAuth,
  normalizeQuickBooksWebhooks,
  recordQuickBooksWebhook,
  verifyQuickBooksWebhook,
} from "../../../integrations/accounting/quickbooks.service";

export const quickBooksOAuthCallbackRouter = Router();

quickBooksOAuthCallbackRouter.get("/", async (req, res) => {
  const fallback = "/app/accounting/integrations";
  try {
    const providerError = typeof req.query.error === "string" ? req.query.error : "";
    if (providerError) {
      const detail = typeof req.query.error_description === "string" ? req.query.error_description : providerError;
      return res.redirect(`${env.appUrl}${fallback}?quickbooks=error&message=${encodeURIComponent(detail.slice(0, 180))}`);
    }
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const realmId = typeof req.query.realmId === "string" ? req.query.realmId : "";
    if (!state || !code || !realmId) throw new Error("QuickBooks callback is incomplete");
    const result = await completeQuickBooksOAuth({ state, code, realmId });
    return res.redirect(`${env.appUrl}${result.returnPath}?quickbooks=connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "QuickBooks connection failed";
    return res.redirect(`${env.appUrl}${fallback}?quickbooks=error&message=${encodeURIComponent(message.slice(0, 180))}`);
  }
});

export const quickBooksWebhookRouter = Router();

quickBooksWebhookRouter.post("/", async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    const signature = String(req.headers["intuit-signature"] ?? "");
    if (!rawBody.length || !signature || !verifyQuickBooksWebhook(rawBody, signature)) {
      return res.status(401).json({ error: { code: "INVALID_SIGNATURE", message: "Invalid QuickBooks webhook signature" } });
    }
    const body = JSON.parse(rawBody.toString("utf8")) as unknown;
    await recordQuickBooksWebhook(normalizeQuickBooksWebhooks(body, rawBody));
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("QuickBooks webhook failed", error);
    return res.status(400).json({ error: { code: "INVALID_WEBHOOK", message: "QuickBooks webhook could not be processed" } });
  }
});
