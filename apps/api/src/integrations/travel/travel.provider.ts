/** Normalized Travel provider port. Domain depends on this, not a vendor SDK. */
export type TravelSearchInput = {
  destination: string;
  origin?: string;
  startDate: string;
  endDate: string;
  type: "FLIGHT" | "HOTEL" | "CAR";
  currency: string;
  maxAmount?: number;
  cabin?: string;
};

export type TravelQuote = {
  quoteId: string;
  provider: string;
  providerOfferId: string;
  type: "FLIGHT" | "HOTEL" | "CAR";
  supplier: string;
  description: string;
  amount: string;
  currency: string;
  refundable: boolean;
  cancellationTerms: string;
  offerExpiry: string;
  outOfPolicy: boolean;
  policyResult: "PASS" | "WARN" | "REVIEW" | "BLOCK";
  itinerary: Record<string, unknown>;
  startsAt: string;
  endsAt: string;
  metadata?: Record<string, unknown>;
};

export type TravelHoldInput = {
  quoteId: string;
  tripId: string;
  amount: string;
  currency: string;
};

export type TravelHoldResult = {
  providerRef: string;
  /** Mock adapters only ever return MOCK_HOLD — never claim live confirmation. */
  providerStatus: "MOCK_HOLD";
  status: "BOOKED_MOCK";
  confirmationNumber?: string;
};

export type TravelConfirmInput = {
  providerRef: string;
};

export type TravelConfirmResult = {
  providerRef: string;
  providerStatus: "CONFIRMED" | "FAILED";
  status: "CONFIRMED" | "FAILED";
  confirmationNumber?: string;
};

export type TravelRepriceInput = {
  quoteId: string;
  quotedAmount: string;
  currency: string;
  /** When true, mock returns a large price increase for E3 tests. */
  forceHigh?: boolean;
};

export type TravelRepriceResult = {
  quoteId: string;
  amount: string;
  currency: string;
  changed: boolean;
  offerExpiry: string;
};

export type TravelCancelInput = {
  providerRef: string;
  refundable?: boolean;
};

export type TravelCancelResult = {
  providerRef: string;
  status: "CANCELLED" | "REFUND_PENDING" | "FAILED";
};

export type TravelRefundInput = {
  providerRef: string;
};

export type TravelRefundResult = {
  providerRef: string;
  status: "REFUNDED" | "FAILED";
  refundAmount?: string;
};

export interface TravelProvider {
  search(input: TravelSearchInput): TravelQuote[];
  reprice(input: TravelRepriceInput): TravelRepriceResult;
  hold(input: TravelHoldInput): TravelHoldResult;
  confirm(input: TravelConfirmInput): TravelConfirmResult;
  cancel(input: TravelCancelInput): TravelCancelResult;
  refund(input: TravelRefundInput): TravelRefundResult;
}
