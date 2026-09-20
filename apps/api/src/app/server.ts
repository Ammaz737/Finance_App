import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { createApp } from "./app";
import { bootstrap } from "./bootstrap";
import { assertRuntimeConfiguration } from "../config/env";

const port = Number(process.env.PORT ?? 3001);

async function main() {
  assertRuntimeConfiguration();
  await bootstrap();
  const app = createApp();
  app.listen(port, () => {
    console.log(`API listening on :${port}`);
  });
}

void main();
