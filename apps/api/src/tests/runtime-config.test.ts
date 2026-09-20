import { describe, expect, it } from "vitest";
import { validateRuntimeConfiguration } from "../config/env";

describe("production runtime configuration", () => {
  it("rejects development defaults and an open origin list", () => {
    expect(validateRuntimeConfiguration({
      nodeEnv: "production",
      databaseUrl: "",
      jwtSecret: "dev-jwt-secret-change-me",
      corsOrigins: [],
    })).toEqual([
      "DATABASE_URL is required in production",
      "JWT_SECRET must be a non-default value with at least 32 characters in production",
      "CORS_ORIGINS must list at least one trusted origin in production",
    ]);
  });

  it("accepts an explicit production database, secret, and origin", () => {
    expect(validateRuntimeConfiguration({
      nodeEnv: "production",
      databaseUrl: "postgresql://finance@db/finance",
      jwtSecret: "a-production-secret-longer-than-32-characters",
      corsOrigins: ["https://finance.example.com"],
    })).toEqual([]);
  });
});
