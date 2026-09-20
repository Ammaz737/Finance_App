import { describe, expect, it } from "vitest";
import { outboxLimits, planOutboxFailure } from "../platform/events/outbox";

describe("outbox retry / dead-letter planning", () => {
  it("retries with exponential backoff before max attempts", () => {
    expect(planOutboxFailure(0)).toEqual({ nextAttempts: 1, dead: false, backoffMs: 2000 });
    expect(planOutboxFailure(1)).toEqual({ nextAttempts: 2, dead: false, backoffMs: 4000 });
    expect(planOutboxFailure(2).backoffMs).toBe(8000);
  });

  it("dead-letters once attempts reach the configured max", () => {
    expect(outboxLimits.MAX_ATTEMPTS).toBe(5);
    expect(planOutboxFailure(4)).toEqual({ nextAttempts: 5, dead: true, backoffMs: 32000 });
  });
});
