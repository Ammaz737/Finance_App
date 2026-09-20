import type {
  TravelConfirmInput,
  TravelConfirmResult,
  TravelHoldInput,
  TravelHoldResult,
  TravelProvider,
  TravelQuote,
  TravelSearchInput,
} from "./travel.provider";

/**
 * Sandbox travel adapter.
 * `hold` creates a mock reservation only (BOOKED_MOCK / MOCK_HOLD).
 * Live confirmation requires an explicit `confirm` call and still stays sandbox-only.
 */
export class MockTravelAdapter implements TravelProvider {
  search(input: TravelSearchInput): TravelQuote[] {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    const base = input.type === "FLIGHT" ? 320 : input.type === "HOTEL" ? 140 * nights : 85 * nights;
    const inPolicyAmount = (input.maxAmount != null ? Math.min(base, input.maxAmount * 0.9) : base).toFixed(2);
    const outPolicyAmount = (base * 1.45).toFixed(2);

    const mk = (amount: string, outOfPolicy: boolean, supplier: string): TravelQuote => ({
      quoteId: `mock_quote_${input.type.toLowerCase()}_${outOfPolicy ? "oop" : "in"}_${Date.now().toString(36)}`,
      type: input.type,
      supplier,
      description: `${input.type} to ${input.destination}`,
      amount,
      currency: input.currency,
      outOfPolicy,
      itinerary: {
        destination: input.destination,
        segments: [{ from: "HOME", to: input.destination, type: input.type }],
        nights,
        mock: true,
      },
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });

    if (input.type === "FLIGHT") {
      return [
        mk(inPolicyAmount, false, "MockAir"),
        mk(outPolicyAmount, true, "PremiumAir"),
      ];
    }
    if (input.type === "HOTEL") {
      return [
        mk(inPolicyAmount, false, "MockStay"),
        mk(outPolicyAmount, true, "LuxuryStay"),
      ];
    }
    return [
      mk(inPolicyAmount, false, "MockCars"),
      mk(outPolicyAmount, true, "PremiumCars"),
    ];
  }

  hold(input: TravelHoldInput): TravelHoldResult {
    return {
      providerRef: `mock_hold_${input.tripId.slice(0, 8)}_${input.quoteId.slice(-8)}`,
      providerStatus: "MOCK_HOLD",
      status: "BOOKED_MOCK",
    };
  }

  confirm(input: TravelConfirmInput): TravelConfirmResult {
    if (!input.providerRef.startsWith("mock_hold_")) {
      return { providerRef: input.providerRef, providerStatus: "FAILED", status: "FAILED" };
    }
    return {
      providerRef: input.providerRef.replace("mock_hold_", "mock_conf_"),
      providerStatus: "CONFIRMED",
      status: "CONFIRMED",
    };
  }
}
