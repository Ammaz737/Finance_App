import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env";
import { AppError } from "../../../platform/http";

const SIGNATURE_TOLERANCE_SECONDS = 300;

export type DuffelWebhookEvent = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
  api_version?: string;
  live_mode?: boolean;
  created_at?: string;
  idempotency_key?: string;
  [key: string]: unknown;
};

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } {
  const pairs = header.split(",").map((part) => part.trim().split("="));
  let timestamp = "";
  const signatures: string[] = [];
  for (const [key, value] of pairs) {
    if (!key || value == null) continue;
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) {
    throw new AppError("UNAUTHORIZED", "Malformed X-Duffel-Signature header", 400);
  }
  return { timestamp, signatures };
}

/** Verify Duffel webhook HMAC: hex(sha256(secret, `${t}.${rawBody}`)). */
export function verifyDuffelWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): void {
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  const age = Math.abs(nowSeconds - Number(timestamp));
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) {
    throw new AppError("UNAUTHORIZED", "Duffel webhook timestamp out of tolerance", 400);
  }

  const expected = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");

  const matched = signatures.some((sig) => {
    const got = Buffer.from(sig, "utf8");
    return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
  });
  if (!matched) {
    throw new AppError("UNAUTHORIZED", "Invalid Duffel webhook signature", 400);
  }
}

export async function processDuffelWebhook(
  rawBody: Buffer,
  signatureHeader: string,
): Promise<{ received: true; type: string; eventId: string | null }> {
  const secret = env.duffelWebhookSecret.trim();
  if (!secret) {
    throw new AppError("MISCONFIGURED", "DUFFEL_WEBHOOK_SECRET is not configured", 500);
  }

  verifyDuffelWebhookSignature(rawBody, signatureHeader, secret);

  let event: DuffelWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as DuffelWebhookEvent;
  } catch {
    throw new AppError("INVALID_BODY", "Duffel webhook body is not valid JSON", 400);
  }

  const type = String(event.type ?? "unknown");
  const eventId = event.id != null
    ? String(event.id)
    : event.idempotency_key != null
      ? String(event.idempotency_key)
      : null;

  console.log(`[duffel.webhook] type=${type} id=${eventId ?? "n/a"} live=${event.live_mode === true}`);

  return { received: true, type, eventId };
}
