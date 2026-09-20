import { describe, expect, it } from "vitest";
import { MockTravelAdapter } from "../integrations/travel/mock.travel.adapter";
import { evaluatePolicy } from "../engines/policy";

describe("M9 travel mock adapter + policy", () => {
  const adapter = new MockTravelAdapter();

  it("returns in-policy and out-of-policy quotes; hold is mock only", () => {
    const quotes = adapter.search({
      destination: "NYC",
      startDate: "2026-10-01T00:00:00.000Z",
      endDate: "2026-10-03T00:00:00.000Z",
      type: "FLIGHT",
      currency: "USD",
      maxAmount: 2500,
    });
    expect(quotes).toHaveLength(2);
    expect(quotes.some((q) => q.outOfPolicy)).toBe(true);
    expect(quotes.some((q) => !q.outOfPolicy)).toBe(true);

    const hold = adapter.hold({
      quoteId: quotes[0]!.quoteId,
      tripId: "trip-12345678",
      amount: quotes[0]!.amount,
      currency: "USD",
    });
    expect(hold.status).toBe("BOOKED_MOCK");
    expect(hold.providerStatus).toBe("MOCK_HOLD");
    expect(hold.providerRef.startsWith("mock_hold_")).toBe(true);

    const confirmed = adapter.confirm({ providerRef: hold.providerRef });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.providerStatus).toBe("CONFIRMED");
    expect(confirmed.providerRef.startsWith("mock_conf_")).toBe(true);
  });

  it("requires review for over-threshold and out-of-policy travel", () => {
    const rules = [
      { type: "travel_max_amount", threshold: 2500 },
      { type: "travel_out_of_policy" },
    ];
    expect(evaluatePolicy({ objectType: "travel", amount: 1000, outOfPolicy: false, rules }).result).toBe("PASS");
    expect(evaluatePolicy({ objectType: "travel", amount: 3000, outOfPolicy: false, rules }).result).toBe("REVIEW");
    expect(evaluatePolicy({ objectType: "travel", amount: 500, outOfPolicy: true, rules }).result).toBe("REVIEW");
  });
});
