import type {
  PaymentRailProvider,
  PaymentRailReleaseInput,
  PaymentRailReleaseResult,
  PaymentRailSettleInput,
  PaymentRailSettleResult,
} from "./payment-rail.provider";

/** Sandbox rail — never claims live settlement. */
export class MockPaymentRailAdapter implements PaymentRailProvider {
  release(input: PaymentRailReleaseInput): PaymentRailReleaseResult {
    return {
      providerRef: `mock_rail_${input.paymentId.replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`,
      status: "ACCEPTED",
    };
  }

  settle(input: PaymentRailSettleInput): PaymentRailSettleResult {
    return {
      settlementId: `mock_settle_${input.providerRef}`,
      status: "COMPLETED",
    };
  }
}
