import dotenv from "dotenv";
import path from "node:path";

// Must run before any app imports — ESM hoists static imports above these calls otherwise.
// Explicit process values win, followed by app-local defaults, then workspace defaults.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

async function main() {
  const { assertRuntimeConfiguration } = await import("../config/env");
  const { bootstrap } = await import("./bootstrap");
  const { createApp } = await import("./app");

  assertRuntimeConfiguration();
  await bootstrap();

  const port = Number(process.env.PORT ?? 3001);
  const app = createApp();
  app.listen(port, () => {
    console.log(`API listening on :${port}`);
    console.log(`Travel provider: ${process.env.TRAVEL_PROVIDER ?? "mock"}`);
  });
}

void main();
