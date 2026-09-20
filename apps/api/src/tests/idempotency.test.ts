import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ records: new Map<string, { requestHash: string; response: unknown }>() }));

vi.mock("../database/client", () => ({
  prisma: {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      idempotencyKey: {
        findUnique: async ({ where }: { where: { organizationId_key: { organizationId: string; key: string } } }) =>
          state.records.get(`${where.organizationId_key.organizationId}:${where.organizationId_key.key}`) ?? null,
        create: async ({ data }: { data: { organizationId: string; key: string; requestHash: string; response: unknown } }) => {
          state.records.set(`${data.organizationId}:${data.key}`, data);
          return data;
        },
      },
    }),
  },
}));

import { hashRequest, withIdempotency } from "../platform/idempotency";

beforeEach(() => state.records.clear());

describe("command idempotency", () => {
  it("hashes equivalent request objects consistently", () => {
    expect(hashRequest({ billId: "a", amount: "2.00" })).toBe(hashRequest({ amount: "2.00", billId: "a" }));
  });

  it("returns the saved result for a retry and rejects changed payload", async () => {
    const run = vi.fn(async () => ({ id: "payment-1" }));
    const input = { organizationId: "tenant-1", operation: "payment.schedule", key: "request-123", requestHash: hashRequest({ amount: "2.00" }) };
    expect(await withIdempotency(input, run)).toEqual({ id: "payment-1" });
    expect(await withIdempotency(input, run)).toEqual({ id: "payment-1" });
    expect(run).toHaveBeenCalledTimes(1);
    await expect(withIdempotency({ ...input, requestHash: hashRequest({ amount: "3.00" }) }, run)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("scopes keys by tenant and operation", async () => {
    const input = { organizationId: "tenant-1", operation: "payment.schedule", key: "request-123", requestHash: hashRequest({ amount: "2.00" }) };
    const run = vi.fn(async () => ({ id: `payment-${run.mock.calls.length}` }));
    await withIdempotency(input, run);
    await withIdempotency({ ...input, organizationId: "tenant-2" }, run);
    await withIdempotency({ ...input, operation: "another.command" }, run);
    expect(run).toHaveBeenCalledTimes(3);
  });
});
