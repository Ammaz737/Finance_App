import { describe, expect, it } from "vitest";
import { validateRuntimeConfiguration } from "../config/env";

describe("card issuer env validation", () => {
  it("requires Stripe secret when provider is stripe", () => {
    const errors = validateRuntimeConfiguration({
      nodeEnv: "development",
      databaseUrl: "postgresql://x",
      jwtSecret: "dev-jwt-secret-change-me",
      corsOrigins: [],
      cardIssuerProvider: "stripe",
      stripeSecretKey: "",
    });
    expect(errors.some((row) => row.includes("STRIPE_SECRET_KEY"))).toBe(true);
  });

  it("rejects sk_test_ in production stripe mode", () => {
    const errors = validateRuntimeConfiguration({
      nodeEnv: "production",
      databaseUrl: "postgresql://finance:finance@localhost:5432/finance",
      jwtSecret: "production-jwt-secret-with-enough-length",
      corsOrigins: ["https://app.example.com"],
      cardIssuerProvider: "stripe",
      stripeSecretKey: "sk_test_123",
      stripeWebhookSecret: "whsec_abc",
    });
    expect(errors.some((row) => row.includes("sk_test_"))).toBe(true);
  });

  it("allows mock without Stripe keys", () => {
    const errors = validateRuntimeConfiguration({
      nodeEnv: "development",
      databaseUrl: "",
      jwtSecret: "dev-jwt-secret-change-me",
      corsOrigins: [],
      cardIssuerProvider: "mock",
      stripeSecretKey: "",
    });
    expect(errors).toEqual([]);
  });
});
