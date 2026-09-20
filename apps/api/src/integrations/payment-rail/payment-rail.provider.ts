/** Normalized PaymentRail provider port. Domain modules depend on this, not a vendor SDK. */
export type PaymentRailReleaseInput = {
  paymentId: string;
  amount: string;
  currency: string;
  rail: string;
};

export type PaymentRailReleaseResult = {
  providerRef: string;
  status: "ACCEPTED" | "REJECTED";
};

export type PaymentRailSettleInput = {
  providerRef: string;
};

export type PaymentRailSettleResult = {
  settlementId: string;
  status: "COMPLETED" | "FAILED";
  failureReason?: string;
};

export interface PaymentRailProvider {
  release(input: PaymentRailReleaseInput): PaymentRailReleaseResult;
  settle(input: PaymentRailSettleInput): PaymentRailSettleResult;
}
