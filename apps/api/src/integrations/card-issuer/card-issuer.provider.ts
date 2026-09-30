/** Provider-agnostic card issuer port. Business logic must not import Stripe types. */

export type IssuerProviderName = "mock" | "stripe";

export type IssuerCardType = "virtual" | "physical";

export type IssuerCardStatus = "inactive" | "active" | "canceled" | "frozen";

export type IssuerCardResult = {
  providerCardId: string;
  providerCardholderId?: string;
  last4: string;
  type: IssuerCardType;
  status: IssuerCardStatus;
  brand: string;
  network: string;
};

export type IssuerBillingAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type IssuerShipping = {
  name: string;
  phone?: string;
  address: IssuerBillingAddress;
  type?: "individual" | "bulk";
};

export type IssuerSpendingControls = {
  spendingLimits?: Array<{
    amount: number;
    interval: "per_authorization" | "daily" | "weekly" | "monthly" | "yearly" | "all_time";
  }>;
  allowedCategories?: string[];
  blockedCategories?: string[];
  allowedMerchantCountries?: string[];
  blockedMerchantCountries?: string[];
};

export type CreateCardholderInput = {
  appUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  billing: IssuerBillingAddress;
  metadata?: Record<string, string>;
};

export type CreateCardInput = {
  appCardId: string;
  appUserId: string;
  businessId: string;
  providerCardholderId: string;
  type: IssuerCardType;
  currency: string;
  status?: "inactive" | "active";
  spendingControls?: IssuerSpendingControls;
  shipping?: IssuerShipping;
  idempotencyKey: string;
  metadata?: Record<string, string>;
};

export type ReplaceCardInput = {
  providerCardId: string;
  appCardId: string;
  appUserId: string;
  businessId: string;
  idempotencyKey: string;
  reason?: "lost" | "stolen" | "expired" | "damaged";
};

export type IssuerAuthorizationResult = {
  providerAuthorizationId: string;
  providerCardId: string;
  amount: number;
  currency: string;
  status: string;
  merchantName: string;
  merchantCategory: string;
  approved?: boolean;
};

export type IssuerTransactionResult = {
  providerTransactionId: string;
  providerAuthorizationId?: string;
  providerCardId: string;
  amount: number;
  currency: string;
  status: string;
  merchantName: string;
  type: string;
};

/** Company / Issuing financial-account cash (major currency units, e.g. "10000.00"). */
export type IssuerCompanyBalance = {
  financialAccountId: string;
  status: string;
  available: Array<{ currency: string; amount: string }>;
  inboundPending?: Array<{ currency: string; amount: string }>;
  outboundPending?: Array<{ currency: string; amount: string }>;
};

export type IssuerErrorCode =
  | "cardholder_requirements_missing"
  | "card_inactive"
  | "insufficient_balance"
  | "spending_limit_exceeded"
  | "invalid_currency"
  | "unsupported_country"
  | "rate_limit"
  | "network_timeout"
  | "duplicate_request"
  | "provider_error";

export class CardIssuerError extends Error {
  constructor(
    public readonly code: IssuerErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "CardIssuerError";
  }
}

export interface CardIssuerProvider {
  readonly name: IssuerProviderName;

  createCardholder(input: CreateCardholderInput): Promise<{ providerCardholderId: string }>;
  createCard(input: CreateCardInput): Promise<IssuerCardResult>;
  getCard(providerCardId: string): Promise<IssuerCardResult>;
  freezeCard(providerCardId: string): Promise<IssuerCardResult>;
  unfreezeCard(providerCardId: string): Promise<IssuerCardResult>;
  cancelCard(providerCardId: string): Promise<IssuerCardResult>;
  replaceCard(input: ReplaceCardInput): Promise<IssuerCardResult>;
  getAuthorization(providerAuthorizationId: string): Promise<IssuerAuthorizationResult>;
  getTransaction(providerTransactionId: string): Promise<IssuerTransactionResult>;
  /** Issuing / money-management FA cash. Optional — mock may omit. */
  getCompanyBalance?(): Promise<IssuerCompanyBalance | null>;
  updateSpendingControls?(providerCardId: string, controls: IssuerSpendingControls): Promise<IssuerCardResult>;
  approveAuthorization?(providerAuthorizationId: string): Promise<IssuerAuthorizationResult>;
  declineAuthorization?(providerAuthorizationId: string, reason?: string): Promise<IssuerAuthorizationResult>;
  /** Test-mode only: create a Stripe Issuing authorization (sandbox demo). */
  createTestAuthorization?(input: {
    providerCardId: string;
    amountCents: number;
    currency: string;
    merchant: string;
    merchantCategory: string;
  }): Promise<IssuerAuthorizationResult>;
  /** Test-mode only: capture a Stripe Issuing authorization (sandbox demo). */
  captureTestAuthorization?(providerAuthorizationId: string, amountCents?: number): Promise<{
    authorization: IssuerAuthorizationResult;
    transactions: IssuerTransactionResult[];
  }>;
}
