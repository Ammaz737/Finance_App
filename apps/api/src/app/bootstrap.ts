import { prisma } from "../database/client";
import { env } from "../config/env";
import fs from "node:fs/promises";

export async function bootstrap(): Promise<void> {
  await fs.mkdir(env.storagePath, { recursive: true });
  await prisma.$connect();
}
