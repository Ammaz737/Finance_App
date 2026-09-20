import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    // Serializable money/approval txns conflict when DB suites share Postgres in parallel.
    fileParallelism: false,
  },
});
