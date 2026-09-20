import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/client";
import { AppError } from "../http";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function hashRequest(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export async function withIdempotency<T>(
  input: { organizationId: string; operation: string; key: string; requestHash: string },
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!/^[\w.-]{8,120}$/.test(input.key)) throw new AppError("INVALID_IDEMPOTENCY_KEY", "Provide an idempotency key of 8–120 safe characters", 400);
  const key = `${input.operation}:${input.key}`;
  if (key.length > 190) throw new AppError("INVALID_IDEMPOTENCY_KEY", "Idempotency key is too long", 400);
  const where = { organizationId_key: { organizationId: input.organizationId, key } };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.idempotencyKey.findUnique({ where });
        if (existing) {
          if (existing.requestHash !== input.requestHash) throw new AppError("IDEMPOTENCY_CONFLICT", "This key was used for a different request", 409);
          return existing.response as T;
        }
        const result = await run(tx);
        await tx.idempotencyKey.create({ data: {
          organizationId: input.organizationId, key, requestHash: input.requestHash,
          response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        } });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
      const winner = await prisma.idempotencyKey.findUnique({ where });
      if (winner) {
        if (winner.requestHash !== input.requestHash) throw new AppError("IDEMPOTENCY_CONFLICT", "This key was used for a different request", 409);
        return winner.response as T;
      }
    }
  }
  throw new AppError("IDEMPOTENCY_BUSY", "Request is still processing; retry with the same key", 409);
}
