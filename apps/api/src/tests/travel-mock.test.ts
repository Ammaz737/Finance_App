import { describe, expect, it } from "vitest";
import { MockTravelAdapter } from "../integrations/travel/mock.travel.adapter";
import { evaluatePolicy } from "../engines/policy";
import { evaluateRepriceTolerance, canBookTrip, canSearchTrip } from "../modules/travel/domain/state-machine";

describe("GF5 travel mock adapter + policy + reprice", () => {
  const adapter = new MockTravelAdapter();

  it("returns normalized flight/hotel/car quotes; hold is mock only", () => {
    for (const type of ["FLIGHT", "HOTEL", "CAR"] as const) {
      const quotes = adapter.search({
        destination: "NYC",
        origin: "SFO",
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2026-10-03T00:00:00.000Z",
        type,
        currency: "USD",
        maxAmount: 2500,
      });
      expect(quotes).toHaveLength(2);
      expect(quotes.every((q) => q.provider === "mock-travel")).toBe(true);
      expect(quotes.every((q) => q.providerOfferId && q.offerExpiry)).toBe(true);
      expect(quotes.some((q) => q.outOfPolicy)).toBe(true);
      expect(quotes.some((q) => !q.outOfPolicy)).toBe(true);
    }

    const hold = adapter.hold({
      quoteId: "mock_quote_flight_in_nyc",
      tripId: "trip-12345678",
      amount: "300.00",
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

  it("reprices within small delta and supports forceHigh for E3", () => {
    const mild = adapter.reprice({ quoteId: "q1", quotedAmount: "500.00", currency: "USD" });
    expect(Number(mild.amount)).toBeLessThanOrEqual(510);
    const check = evaluateRepriceTolerance({
      quotedAmount: 500,
      currentAmount: Number(mild.amount),
      tolerance: 25,
    });
    expect(check.withinTolerance).toBe(true);

    const high = adapter.reprice({ quoteId: "q1", quotedAmount: "500.00", currency: "USD", forceHigh: true });
    expect(Number(high.amount)).toBeGreaterThan(800);
    expect(evaluateRepriceTolerance({
      quotedAmount: 500,
      currentAmount: Number(high.amount),
      tolerance: 25,
    }).withinTolerance).toBe(false);
  });

  it("cancels to REFUND_PENDING when refundable, then refunds", () => {
    const cancel = adapter.cancel({ providerRef: "mock_conf_abc", refundable: true });
    expect(cancel.status).toBe("REFUND_PENDING");
    const nonRefund = adapter.cancel({ providerRef: "mock_conf_abc", refundable: false });
    expect(nonRefund.status).toBe("CANCELLED");
    const refund = adapter.refund({ providerRef: "mock_conf_abc" });
    expect(refund.status).toBe("REFUNDED");
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

  it("state helpers allow search/book on READY_TO_BOOK", () => {
    expect(canSearchTrip("DRAFT")).toBe(true);
    expect(canSearchTrip("READY_TO_BOOK")).toBe(true);
    expect(canBookTrip("READY_TO_BOOK")).toBe(true);
    expect(canBookTrip("APPROVED")).toBe(true);
    expect(canBookTrip("PENDING_APPROVAL")).toBe(false);
  });
});
