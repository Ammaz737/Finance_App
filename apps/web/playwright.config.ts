import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Full journeys visit several routes; a cold Next dev compile can take over a minute.
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/golden-report.json" }]],
  use: {
    // Match `pnpm dev:web` (scripts/dev-runner.mjs uses -p 3002). Override with E2E_BASE_URL if needed.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3002",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
