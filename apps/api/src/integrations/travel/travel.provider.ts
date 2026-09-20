/** Normalized Travel provider port. Domain depends on this, not a vendor SDK. */
export type TravelSearchInput = {
  destination: string;
  startDate: string;
  endDate: string;
  type: "FLIGHT" | "HOTEL" | "CAR";
  currency: string;
  maxAmount?: number;
};

export type TravelQuote = {
  quoteId: string;
  type: "FLIGHT" | "HOTEL" | "CAR";
  supplier: string;
  description: string;
  amount: string;
  currency: string;
  outOfPolicy: boolean;
  itinerary: Record<string, unknown>;
  startsAt: string;
  endsAt: string;
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
};

export type TravelConfirmInput = {
  providerRef: string;
};

export type TravelConfirmResult = {
  providerRef: string;
  providerStatus: "CONFIRMED" | "FAILED";
  status: "CONFIRMED" | "FAILED";
};

export interface TravelProvider {
  search(input: TravelSearchInput): TravelQuote[];
  hold(input: TravelHoldInput): TravelHoldResult;
  confirm(input: TravelConfirmInput): TravelConfirmResult;
}
