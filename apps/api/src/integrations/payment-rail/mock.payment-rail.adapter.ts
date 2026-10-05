import type {
  PaymentRailProvider,
  PaymentRailReleaseInput,
  PaymentRailReleaseResult,
  PaymentRailSettleInput,
  PaymentRailSettleResult,
} from "./payment-rail.provider";

/** Sandbox rail — never claims live settlement. */
export class MockPaymentRailAdapter implements PaymentRailProvider {
  readonly name = "mock" as const;

  async release(input: PaymentRailReleaseInput): Promise<PaymentRailReleaseResult> {
    return {
      providerRef: `mock_rail_${input.paymentId.replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`,
      status: "ACCEPTED",
    };
  }

  async settle(input: PaymentRailSettleInput): Promise<PaymentRailSettleResult> {
    return {
      settlementId: `mock_settle_${input.providerRef}`,
      status: "COMPLETED",
    };
  }
}
