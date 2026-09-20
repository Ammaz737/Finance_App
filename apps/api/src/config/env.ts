import path from "node:path";

const developmentJwtSecret = "dev-jwt-secret-change-me";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET ?? developmentJwtSecret,
  storagePath: process.env.STORAGE_PATH ?? path.join(process.cwd(), "data", "uploads"),
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  seedPassword: process.env.SEED_PASSWORD ?? "password123",
  travelRewards: process.env.FEATURE_TRAVEL_EMPLOYEE_REWARDS === "true",
  sheetsRealtime: process.env.FEATURE_SHEETS_REALTIME_COLLAB === "true",
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export function validateRuntimeConfiguration(config: {
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
}): string[] {
  if (config.nodeEnv !== "production") return [];

  const errors: string[] = [];
  if (!config.databaseUrl.trim()) errors.push("DATABASE_URL is required in production");
  if (config.jwtSecret === developmentJwtSecret || config.jwtSecret.length < 32) {
    errors.push("JWT_SECRET must be a non-default value with at least 32 characters in production");
  }
  if (config.corsOrigins.length === 0) errors.push("CORS_ORIGINS must list at least one trusted origin in production");
  return errors;
}

export function assertRuntimeConfiguration(): void {
  const errors = validateRuntimeConfiguration(env);
  if (errors.length) throw new Error(`Unsafe runtime configuration:\n- ${errors.join("\n- ")}`);
}

export function allowedCorsOrigins(): Set<string> {
  const configured = env.corsOrigins.length
    ? env.corsOrigins
    : [env.appUrl, "http://localhost:3000", "http://localhost:3002"];
  return new Set(configured.map((origin) => origin.replace(/\/$/, "")));
}
