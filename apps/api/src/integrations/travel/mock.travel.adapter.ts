import type {
  TravelCancelInput,
  TravelCancelResult,
  TravelConfirmInput,
  TravelConfirmResult,
  TravelHoldInput,
  TravelHoldResult,
  TravelProvider,
  TravelQuote,
  TravelRefundInput,
  TravelRefundResult,
  TravelRepriceInput,
  TravelRepriceResult,
  TravelSearchInput,
} from "./travel.provider";

/**
 * Sandbox travel adapter — SANDBOX / MOCK TRAVEL.
 * hold → MOCK_HOLD only; confirm required for CONFIRMED.
 */
export class MockTravelAdapter implements TravelProvider {
  search(input: TravelSearchInput): TravelQuote[] {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    const base = input.type === "FLIGHT" ? 320 : input.type === "HOTEL" ? 140 * nights : 85 * nights;
    const inPolicyAmount = (input.maxAmount != null ? Math.min(base, input.maxAmount * 0.9) : base).toFixed(2);
    const outPolicyAmount = (base * 1.45).toFixed(2);
    const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const destKey = input.destination.toLowerCase().replace(/\s+/g, "_").slice(0, 24);

    const mk = (amount: string, outOfPolicy: boolean, supplier: string, cabinOrClass: string): TravelQuote => {
      const tag = outOfPolicy ? "oop" : "in";
      const quoteId = `mock_quote_${input.type.toLowerCase()}_${tag}_${destKey}`;
      return {
        quoteId,
        provider: "mock-travel",
        providerOfferId: quoteId,
        type: input.type,
        supplier,
        description: `${input.type} to ${input.destination}${input.origin ? ` from ${input.origin}` : ""}`,
        amount,
        currency: input.currency,
        refundable: !outOfPolicy,
        cancellationTerms: outOfPolicy ? "Non-refundable" : "Free cancellation within 24h",
        offerExpiry: expiry,
        outOfPolicy,
        policyResult: outOfPolicy ? "REVIEW" : "PASS",
        itinerary: {
          destination: input.destination,
          origin: input.origin ?? "HOME",
          segments: [{ from: input.origin ?? "HOME", to: input.destination, type: input.type, cabinOrClass }],
          nights,
          mock: true,
        },
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        metadata: { cabinOrClass, sandbox: true },
      };
    };

    if (input.type === "FLIGHT") {
      return [
        mk(inPolicyAmount, false, "MockAir", input.cabin ?? "ECONOMY"),
        mk(outPolicyAmount, true, "PremiumAir", "BUSINESS"),
      ];
    }
    if (input.type === "HOTEL") {
      return [
        mk(inPolicyAmount, false, "MockStay", "STANDARD"),
        mk(outPolicyAmount, true, "LuxuryStay", "SUITE"),
      ];
    }
    return [
      mk(inPolicyAmount, false, "MockCars", "COMPACT"),
      mk(outPolicyAmount, true, "PremiumCars", "SUV"),
    ];
  }

  reprice(input: TravelRepriceInput): TravelRepriceResult {
    const quoted = Number(input.quotedAmount);
    const next = input.forceHigh
      ? (quoted * 1.8).toFixed(2)
      : (quoted + Math.min(10, quoted * 0.02)).toFixed(2);
    return {
      quoteId: input.quoteId,
      amount: next,
      currency: input.currency,
      changed: next !== Number(input.quotedAmount).toFixed(2),
      offerExpiry: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    };
  }

  hold(input: TravelHoldInput): TravelHoldResult {
    return {
      providerRef: `mock_hold_${input.tripId.slice(0, 8)}_${input.quoteId.slice(-12)}`,
      providerStatus: "MOCK_HOLD",
      status: "BOOKED_MOCK",
      confirmationNumber: `HOLD-${input.tripId.slice(0, 6).toUpperCase()}`,
    };
  }

  confirm(input: TravelConfirmInput): TravelConfirmResult {
    if (!input.providerRef.startsWith("mock_hold_")) {
      return { providerRef: input.providerRef, providerStatus: "FAILED", status: "FAILED" };
    }
    const conf = input.providerRef.replace("mock_hold_", "mock_conf_");
    return {
      providerRef: conf,
      providerStatus: "CONFIRMED",
      status: "CONFIRMED",
      confirmationNumber: `CNF-${conf.slice(-8).toUpperCase()}`,
    };
  }

  cancel(input: TravelCancelInput): TravelCancelResult {
    if (!input.providerRef.startsWith("mock_conf_") && !input.providerRef.startsWith("mock_hold_")) {
      return { providerRef: input.providerRef, status: "FAILED" };
    }
    return {
      providerRef: input.providerRef,
      status: input.refundable === false ? "CANCELLED" : "REFUND_PENDING",
    };
  }

  refund(input: TravelRefundInput): TravelRefundResult {
    if (!input.providerRef.startsWith("mock_conf_") && !input.providerRef.startsWith("mock_hold_")) {
      return { providerRef: input.providerRef, status: "FAILED" };
    }
    return { providerRef: input.providerRef, status: "REFUNDED" };
  }
}
