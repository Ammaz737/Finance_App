import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyDuffelWebhookSignature } from "../modules/travel/application/duffel-webhook";

describe("verifyDuffelWebhookSignature", () => {
  it("accepts a valid Duffel signature", () => {
    const secret = "V48MUPRtGfKvVZIvqZdlEA==";
    const body = Buffer.from(JSON.stringify({ type: "ping", id: "evt_test" }), "utf8");
    const timestamp = "1700000000";
    const v1 = createHmac("sha256", secret)
      .update(timestamp)
      .update(".")
      .update(body)
      .digest("hex");
    expect(() =>
      verifyDuffelWebhookSignature(body, `t=${timestamp},v1=${v1}`, secret, Number(timestamp)),
    ).not.toThrow();
  });

  it("rejects a bad signature", () => {
    const secret = "V48MUPRtGfKvVZIvqZdlEA==";
    const body = Buffer.from("{}", "utf8");
    expect(() =>
      verifyDuffelWebhookSignature(body, "t=1700000000,v1=deadbeef", secret, 1700000000),
    ).toThrow(/Invalid Duffel webhook signature/);
  });
});
