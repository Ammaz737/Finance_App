/** Normalized PaymentRail provider port. Domain modules depend on this, not a vendor SDK. */
export type PaymentRailReleaseInput = {
  paymentId: string;
  amount: string;
  currency: string;
  rail: string;
  /** Optional vendor / memo shown on the Stripe Issuing force-capture merchant. */
  description?: string;
};

export type PaymentRailReleaseResult = {
  providerRef: string;
  status: "ACCEPTED" | "REJECTED";
  failureReason?: string;
};

export type PaymentRailSettleInput = {
  providerRef: string;
  paymentId?: string;
  amount?: string;
  currency?: string;
};

export type PaymentRailSettleResult = {
  settlementId: string;
  status: "COMPLETED" | "FAILED";
  failureReason?: string;
};

export interface PaymentRailProvider {
  readonly name: "mock" | "stripe";
  release(input: PaymentRailReleaseInput): Promise<PaymentRailReleaseResult>;
  settle(input: PaymentRailSettleInput): Promise<PaymentRailSettleResult>;
}
