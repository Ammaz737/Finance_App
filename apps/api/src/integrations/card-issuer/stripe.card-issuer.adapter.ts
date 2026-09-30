import Stripe from "stripe";
import {
  CardIssuerError,
  type CardIssuerProvider,
  type CreateCardholderInput,
  type CreateCardInput,
  type IssuerAuthorizationResult,
  type IssuerCardResult,
  type IssuerCardStatus,
  type IssuerCompanyBalance,
  type IssuerSpendingControls,
  type IssuerTransactionResult,
  type ReplaceCardInput,
} from "./card-issuer.provider";
import { toStripeSpendingCategories } from "./stripe-spending-categories";

/** Stable sandbox DOB — never use 1900-01-01 (Stripe OFAC test trigger). */
const SANDBOX_DOB = { day: 15, month: 6, year: 1990 } as const;
const SANDBOX_TERMS_IP = "127.0.0.1";

function mapStripeError(error: unknown): never {
  if (error instanceof Stripe.errors.StripeError) {
    const message = error.message || "Stripe Issuing request failed";
    if (error.code === "rate_limit") throw new CardIssuerError("rate_limit", message, true);
    if (error.type === "StripeConnectionError") throw new CardIssuerError("network_timeout", message, true);
    if (error.code === "idempotency_error") throw new CardIssuerError("duplicate_request", message);
    if (message.toLowerCase().includes("insufficient")) throw new CardIssuerError("insufficient_balance", message);
    if (message.toLowerCase().includes("spending")) throw new CardIssuerError("spending_limit_exceeded", message);
    if (message.toLowerCase().includes("currency")) throw new CardIssuerError("invalid_currency", message);
    if (message.toLowerCase().includes("country")) throw new CardIssuerError("unsupported_country", message);
    if (message.toLowerCase().includes("inactive")) throw new CardIssuerError("card_inactive", message);
    if (message.toLowerCase().includes("requirement")) throw new CardIssuerError("cardholder_requirements_missing", message);
    // Keep Stripe's safe public message so operators can fix account/Issuing setup.
    throw new CardIssuerError("provider_error", message);
  }
  throw new CardIssuerError("provider_error", error instanceof Error ? error.message : "Card issuer request failed");
}

function mapCardStatus(status: string | null | undefined): IssuerCardStatus {
  if (status === "active") return "active";
  if (status === "canceled") return "canceled";
  return "inactive";
}

function mapCard(card: Stripe.Issuing.Card): IssuerCardResult {
  return {
    providerCardId: card.id,
    providerCardholderId: typeof card.cardholder === "string" ? card.cardholder : card.cardholder?.id,
    last4: card.last4,
    type: card.type === "physical" ? "physical" : "virtual",
    status: mapCardStatus(card.status),
    brand: String(card.brand ?? "visa").toLowerCase(),
    network: String(card.brand ?? "visa").toUpperCase(),
  };
}

type FaMoneyMap = Record<string, { value?: number; currency?: string } | number>;

function mapFaMoney(map: FaMoneyMap | undefined): Array<{ currency: string; amount: string }> {
  if (!map || typeof map !== "object") return [];
  const rows: Array<{ currency: string; amount: string }> = [];
  for (const [currency, entry] of Object.entries(map)) {
    const minor = typeof entry === "number" ? entry : Number(entry?.value ?? 0);
    if (!Number.isFinite(minor)) continue;
    rows.push({
      currency: (typeof entry === "object" && entry?.currency ? entry.currency : currency).toUpperCase(),
      amount: (minor / 100).toFixed(2),
    });
  }
  return rows;
}

function toStripeControls(controls?: IssuerSpendingControls): Stripe.Issuing.CardUpdateParams.SpendingControls | undefined {
  if (!controls) return undefined;
  let allowed: string[] | undefined;
  let blocked: string[] | undefined;
  try {
    allowed = toStripeSpendingCategories(controls.allowedCategories);
    blocked = toStripeSpendingCategories(controls.blockedCategories);
  } catch (error) {
    throw new CardIssuerError(
      "provider_error",
      error instanceof Error ? error.message : "Invalid spending categories for Stripe Issuing",
    );
  }
  return {
    spending_limits: controls.spendingLimits?.map((limit) => ({
      amount: limit.amount,
      interval: limit.interval,
    })),
    allowed_categories: allowed as Stripe.Issuing.CardUpdateParams.SpendingControls.AllowedCategory[] | undefined,
    blocked_categories: blocked as Stripe.Issuing.CardUpdateParams.SpendingControls.BlockedCategory[] | undefined,
    allowed_merchant_countries: controls.allowedMerchantCountries,
    blocked_merchant_countries: controls.blockedMerchantCountries,
  };
}

export class StripeCardIssuerAdapter implements CardIssuerProvider {
  readonly name = "stripe" as const;
  private readonly stripe: Stripe;
  private readonly configuredFinancialAccountId?: string;
  private resolvedFinancialAccountId?: string;

  constructor(secretKey: string, financialAccountId?: string) {
    this.stripe = new Stripe(secretKey);
    this.configuredFinancialAccountId = financialAccountId?.trim() || undefined;
  }

  private async resolveFinancialAccountId(): Promise<string> {
    if (this.resolvedFinancialAccountId) return this.resolvedFinancialAccountId;

    const configured = this.configuredFinancialAccountId;
    const listed = await this.stripe.rawRequest(
      "GET",
      "/v2/money_management/financial_accounts",
      undefined,
      { additionalHeaders: { "Stripe-Version": "2025-12-15.preview" } },
    ) as { data?: Array<{ id: string; status?: string }> };

    const rows = listed?.data ?? [];
    const configuredRow = configured ? rows.find((row) => row.id === configured) : undefined;
    if (configured) {
      if (configuredRow?.status === "pending") {
        throw new CardIssuerError(
          "cardholder_requirements_missing",
          `Stripe financial account ${configured} is still pending (not open yet). In Stripe Dashboard (Test mode) finish Issuing / Financial Account setup until status is open, then retry Approve.`,
        );
      }
      this.resolvedFinancialAccountId = configured;
      return configured;
    }

    const open = rows.find((row) => row.status === "open");
    if (open?.id) {
      this.resolvedFinancialAccountId = open.id;
      return open.id;
    }
    const pending = rows.find((row) => row.status === "pending");
    if (pending?.id) {
      throw new CardIssuerError(
        "cardholder_requirements_missing",
        `Stripe financial account ${pending.id} is still pending. Open Issuing in the Stripe Dashboard (Test mode) and wait until the financial account status is open, then set STRIPE_FINANCIAL_ACCOUNT_ID=${pending.id}`,
      );
    }
    throw new CardIssuerError(
      "cardholder_requirements_missing",
      "No Stripe financial account found. Complete Issuing setup in the Stripe Dashboard (Test mode), then set STRIPE_FINANCIAL_ACCOUNT_ID=fa_...",
    );
  }

  private async findExistingCardholder(appUserId: string, email: string) {
    const listed = await this.stripe.issuing.cardholders.list({ limit: 100 });
    const match = listed.data.find((row) => row.metadata?.app_user_id === appUserId)
      ?? listed.data.find((row) => (row.email || "").toLowerCase() === email.toLowerCase());
    return match ?? null;
  }

  /** Fill Stripe past_due fields (DOB + Celtic terms) so cards can activate. */
  private async ensureCardholderActivatable(
    cardholderId: string,
    identity: { firstName: string; lastName: string; phone?: string },
  ) {
    const current = await this.stripe.issuing.cardholders.retrieve(cardholderId);
    const pastDue = current.requirements?.past_due ?? [];
    const needsDob = !current.individual?.dob?.year
      || pastDue.some((field) => field.startsWith("individual.dob"));
    const needsTerms = pastDue.some((field) => field.includes("user_terms_acceptance"))
      || !current.individual?.card_issuing?.user_terms_acceptance?.date;
    const needsName = !current.individual?.first_name?.trim()
      || !current.individual?.last_name?.trim()
      || pastDue.some((field) => field === "individual.first_name" || field === "individual.last_name");
    const needsPhone = !current.phone_number;

    if (!needsDob && !needsTerms && !needsName && !needsPhone && !pastDue.length) {
      return current;
    }

    const updated = await this.stripe.issuing.cardholders.update(cardholderId, {
      phone_number: identity.phone || current.phone_number || "+14155550100",
      individual: {
        first_name: identity.firstName || current.individual?.first_name || undefined,
        last_name: identity.lastName || current.individual?.last_name || undefined,
        ...(needsDob ? { dob: { ...SANDBOX_DOB } } : {}),
        ...(needsTerms
          ? {
              card_issuing: {
                user_terms_acceptance: {
                  date: Math.floor(Date.now() / 1000),
                  ip: SANDBOX_TERMS_IP,
                },
              },
            }
          : {}),
      },
    });

    const stillDue = updated.requirements?.past_due ?? [];
    if (stillDue.length || updated.requirements?.disabled_reason === "requirements.past_due") {
      throw new CardIssuerError(
        "cardholder_requirements_missing",
        `Stripe cardholder still has outstanding requirements: ${stillDue.join(", ") || updated.requirements?.disabled_reason || "unknown"}. Update the cardholder in Stripe Dashboard → Issuing → Cardholders, then retry.`,
      );
    }
    return updated;
  }

  async createCardholder(input: CreateCardholderInput) {
    try {
      // Versioned key: v4 adds DOB + Authorized User Terms required to activate cards.
      const cardholder = await this.stripe.issuing.cardholders.create({
        type: "individual",
        name: `${input.firstName} ${input.lastName}`.trim(),
        email: input.email,
        phone_number: input.phone || "+14155550100",
        status: "active",
        individual: {
          first_name: input.firstName,
          last_name: input.lastName,
          dob: { ...SANDBOX_DOB },
          card_issuing: {
            user_terms_acceptance: {
              date: Math.floor(Date.now() / 1000),
              ip: SANDBOX_TERMS_IP,
            },
          },
        },
        billing: {
          address: {
            line1: input.billing.line1,
            line2: input.billing.line2,
            city: input.billing.city,
            state: input.billing.state,
            postal_code: input.billing.postalCode,
            country: input.billing.country,
          },
        },
        metadata: {
          app_user_id: input.appUserId,
          ...(input.metadata ?? {}),
        },
      }, { idempotencyKey: `create-cardholder:v4:${input.appUserId}` });
      await this.ensureCardholderActivatable(cardholder.id, {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      });
      return { providerCardholderId: cardholder.id };
    } catch (error) {
      if (error instanceof CardIssuerError) throw error;
      if (error instanceof Stripe.errors.StripeError) {
        const existing = await this.findExistingCardholder(input.appUserId, input.email).catch(() => null);
        if (existing) {
          await this.ensureCardholderActivatable(existing.id, {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
          });
          return { providerCardholderId: existing.id };
        }
      }
      mapStripeError(error);
    }
  }

  async createCard(input: CreateCardInput): Promise<IssuerCardResult> {
    try {
      const financialAccountV2 = await this.resolveFinancialAccountId();
      // Prefer versioned key even if caller still sends create-card:<id>.
      const idempotencyKey = input.idempotencyKey.startsWith("create-card:v")
        ? input.idempotencyKey
        : input.idempotencyKey.replace(/^create-card:/, "create-card:v4:");

      // Patch incomplete cardholders created before DOB/terms were required.
      const holder = await this.stripe.issuing.cardholders.retrieve(input.providerCardholderId);
      const nameParts = (holder.name || "").trim().split(/\s+/);
      await this.ensureCardholderActivatable(input.providerCardholderId, {
        firstName: holder.individual?.first_name || nameParts[0] || "Card",
        lastName: holder.individual?.last_name || nameParts.slice(1).join(" ") || "Holder",
        phone: holder.phone_number || undefined,
      });

      // Stripe Issuing: create inactive, then activate when requested.
      const card = await this.stripe.issuing.cards.create({
        cardholder: input.providerCardholderId,
        type: input.type,
        currency: input.currency.toLowerCase(),
        status: "inactive",
        spending_controls: toStripeControls(input.spendingControls),
        shipping: input.shipping
          ? {
              name: input.shipping.name,
              phone_number: input.shipping.phone,
              type: input.shipping.type ?? "individual",
              address: {
                line1: input.shipping.address.line1,
                line2: input.shipping.address.line2,
                city: input.shipping.address.city,
                state: input.shipping.address.state,
                postal_code: input.shipping.address.postalCode,
                country: input.shipping.address.country,
              },
            }
          : undefined,
        metadata: {
          app_card_id: input.appCardId,
          app_user_id: input.appUserId,
          business_id: input.businessId,
          ...(input.metadata ?? {}),
        },
        // Required on accounts that use money-management / v2 financial accounts.
        financial_account_v2: financialAccountV2,
      } as Stripe.Issuing.CardCreateParams & { financial_account_v2: string }, { idempotencyKey });

      if (input.status === "active") {
        const activated = await this.stripe.issuing.cards.update(card.id, { status: "active" });
        return mapCard(activated);
      }
      return mapCard(card);
    } catch (error) {
      if (error instanceof CardIssuerError) throw error;
      // Idempotency conflict after param changes: reuse card already created for this app card id.
      if (error instanceof Stripe.errors.StripeError && error.code === "idempotency_error") {
        const listed = await this.stripe.issuing.cards.list({ limit: 100 });
        const existing = listed.data.find((row) => row.metadata?.app_card_id === input.appCardId);
        if (existing) {
          if (input.status === "active" && existing.status !== "active") {
            try {
              const holderId = typeof existing.cardholder === "string" ? existing.cardholder : existing.cardholder?.id;
              if (holderId) {
                const holder = await this.stripe.issuing.cardholders.retrieve(holderId);
                const nameParts = (holder.name || "").trim().split(/\s+/);
                await this.ensureCardholderActivatable(holderId, {
                  firstName: holder.individual?.first_name || nameParts[0] || "Card",
                  lastName: holder.individual?.last_name || nameParts.slice(1).join(" ") || "Holder",
                  phone: holder.phone_number || undefined,
                });
              }
              return mapCard(await this.stripe.issuing.cards.update(existing.id, { status: "active" }));
            } catch (activateError) {
              if (activateError instanceof CardIssuerError) throw activateError;
              mapStripeError(activateError);
            }
          }
          return mapCard(existing);
        }
      }
      mapStripeError(error);
    }
  }

  async getCard(providerCardId: string): Promise<IssuerCardResult> {
    try {
      return mapCard(await this.stripe.issuing.cards.retrieve(providerCardId));
    } catch (error) {
      mapStripeError(error);
    }
  }

  async freezeCard(providerCardId: string): Promise<IssuerCardResult> {
    try {
      return mapCard(await this.stripe.issuing.cards.update(providerCardId, { status: "inactive" }));
    } catch (error) {
      mapStripeError(error);
    }
  }

  async unfreezeCard(providerCardId: string): Promise<IssuerCardResult> {
    try {
      const card = await this.stripe.issuing.cards.retrieve(providerCardId);
      const holderId = typeof card.cardholder === "string" ? card.cardholder : card.cardholder?.id;
      if (holderId) {
        const holder = await this.stripe.issuing.cardholders.retrieve(holderId);
        const nameParts = (holder.name || "").trim().split(/\s+/);
        await this.ensureCardholderActivatable(holderId, {
          firstName: holder.individual?.first_name || nameParts[0] || "Card",
          lastName: holder.individual?.last_name || nameParts.slice(1).join(" ") || "Holder",
          phone: holder.phone_number || undefined,
        });
      }
      return mapCard(await this.stripe.issuing.cards.update(providerCardId, { status: "active" }));
    } catch (error) {
      if (error instanceof CardIssuerError) throw error;
      mapStripeError(error);
    }
  }

  async cancelCard(providerCardId: string): Promise<IssuerCardResult> {
    try {
      return mapCard(await this.stripe.issuing.cards.update(providerCardId, { status: "canceled" }));
    } catch (error) {
      mapStripeError(error);
    }
  }

  async replaceCard(input: ReplaceCardInput): Promise<IssuerCardResult> {
    const existing = await this.getCard(input.providerCardId);
    await this.cancelCard(input.providerCardId);
    if (!existing.providerCardholderId) {
      throw new CardIssuerError("cardholder_requirements_missing", "Missing cardholder on card");
    }
    return this.createCard({
      appCardId: input.appCardId,
      appUserId: input.appUserId,
      businessId: input.businessId,
      providerCardholderId: existing.providerCardholderId,
      type: existing.type,
      currency: "usd",
      status: "inactive",
      idempotencyKey: input.idempotencyKey,
      metadata: { replaced_from: input.providerCardId, reason: input.reason ?? "lost" },
    });
  }

  async getAuthorization(providerAuthorizationId: string): Promise<IssuerAuthorizationResult> {
    try {
      const auth = await this.stripe.issuing.authorizations.retrieve(providerAuthorizationId);
      return {
        providerAuthorizationId: auth.id,
        providerCardId: typeof auth.card === "string" ? auth.card : auth.card.id,
        amount: auth.amount,
        currency: auth.currency,
        status: auth.status,
        merchantName: auth.merchant_data?.name ?? "Unknown",
        merchantCategory: auth.merchant_data?.category ?? "",
        approved: auth.approved ?? undefined,
      };
    } catch (error) {
      mapStripeError(error);
    }
  }

  async getTransaction(providerTransactionId: string): Promise<IssuerTransactionResult> {
    try {
      const txn = await this.stripe.issuing.transactions.retrieve(providerTransactionId);
      return {
        providerTransactionId: txn.id,
        providerAuthorizationId: typeof txn.authorization === "string" ? txn.authorization : txn.authorization?.id,
        providerCardId: typeof txn.card === "string" ? txn.card : txn.card.id,
        amount: Math.abs(txn.amount),
        currency: txn.currency,
        status: "captured",
        merchantName: txn.merchant_data?.name ?? "Unknown",
        type: txn.type,
      };
    } catch (error) {
      mapStripeError(error);
    }
  }

  async getCompanyBalance(): Promise<IssuerCompanyBalance | null> {
    try {
      const financialAccountId = await this.resolveFinancialAccountId();
      const account = await this.stripe.rawRequest(
        "GET",
        `/v2/money_management/financial_accounts/${financialAccountId}`,
        undefined,
        { additionalHeaders: { "Stripe-Version": "2025-12-15.preview" } },
      ) as {
        id?: string;
        status?: string;
        balance?: {
          available?: FaMoneyMap;
          inbound_pending?: FaMoneyMap;
          outbound_pending?: FaMoneyMap;
        };
      };
      if (!account?.id) return null;
      return {
        financialAccountId: account.id,
        status: account.status ?? "unknown",
        available: mapFaMoney(account.balance?.available),
        inboundPending: mapFaMoney(account.balance?.inbound_pending),
        outboundPending: mapFaMoney(account.balance?.outbound_pending),
      };
    } catch (error) {
      mapStripeError(error);
    }
  }

  async updateSpendingControls(providerCardId: string, controls: IssuerSpendingControls): Promise<IssuerCardResult> {
    try {
      return mapCard(await this.stripe.issuing.cards.update(providerCardId, {
        spending_controls: toStripeControls(controls),
      }));
    } catch (error) {
      mapStripeError(error);
    }
  }

  async approveAuthorization(providerAuthorizationId: string): Promise<IssuerAuthorizationResult> {
    try {
      const auth = await this.stripe.issuing.authorizations.approve(providerAuthorizationId);
      return {
        providerAuthorizationId: auth.id,
        providerCardId: typeof auth.card === "string" ? auth.card : auth.card.id,
        amount: auth.amount,
        currency: auth.currency,
        status: auth.status,
        merchantName: auth.merchant_data?.name ?? "Unknown",
        merchantCategory: auth.merchant_data?.category ?? "",
        approved: true,
      };
    } catch (error) {
      mapStripeError(error);
    }
  }

  async declineAuthorization(providerAuthorizationId: string, reason?: string): Promise<IssuerAuthorizationResult> {
    try {
      const auth = await this.stripe.issuing.authorizations.decline(providerAuthorizationId, {
        metadata: reason ? { decline_reason: reason.slice(0, 500) } : undefined,
      });
      return {
        providerAuthorizationId: auth.id,
        providerCardId: typeof auth.card === "string" ? auth.card : auth.card.id,
        amount: auth.amount,
        currency: auth.currency,
        status: auth.status,
        merchantName: auth.merchant_data?.name ?? "Unknown",
        merchantCategory: auth.merchant_data?.category ?? "",
        approved: false,
      };
    } catch (error) {
      mapStripeError(error);
    }
  }

  async createTestAuthorization(input: {
    providerCardId: string;
    amountCents: number;
    currency: string;
    merchant: string;
    merchantCategory: string;
  }): Promise<IssuerAuthorizationResult> {
    const auth = await this.createTestAuthorizationRaw(input);
    return {
      providerAuthorizationId: auth.id,
      providerCardId: typeof auth.card === "string" ? auth.card : auth.card.id,
      amount: auth.amount,
      currency: auth.currency,
      status: auth.status,
      merchantName: auth.merchant_data?.name ?? input.merchant,
      merchantCategory: auth.merchant_data?.category ?? input.merchantCategory,
      approved: auth.approved ?? undefined,
    };
  }

  /** Full Stripe Authorization object for local webhook-equivalent processing. */
  async createTestAuthorizationRaw(input: {
    providerCardId: string;
    amountCents: number;
    currency: string;
    merchant: string;
    merchantCategory: string;
  }): Promise<Stripe.Issuing.Authorization> {
    try {
      return await this.stripe.testHelpers.issuing.authorizations.create({
        card: input.providerCardId,
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        merchant_data: {
          name: input.merchant.slice(0, 200),
          category: input.merchantCategory as Stripe.TestHelpers.Issuing.AuthorizationCreateParams.MerchantData.Category,
        },
      });
    } catch (error) {
      mapStripeError(error);
    }
  }

  async captureTestAuthorization(providerAuthorizationId: string, amountCents?: number) {
    const { auth, transactions } = await this.captureTestAuthorizationRaw(providerAuthorizationId, amountCents);
    return {
      authorization: {
        providerAuthorizationId: auth.id,
        providerCardId: typeof auth.card === "string" ? auth.card : auth.card.id,
        amount: auth.amount,
        currency: auth.currency,
        status: auth.status,
        merchantName: auth.merchant_data?.name ?? "Unknown",
        merchantCategory: auth.merchant_data?.category ?? "",
        approved: auth.approved ?? undefined,
      },
      transactions: transactions.map((txn) => ({
        providerTransactionId: txn.id,
        providerAuthorizationId: typeof txn.authorization === "string" ? txn.authorization : txn.authorization?.id,
        providerCardId: typeof txn.card === "string" ? txn.card : txn.card.id,
        amount: Math.abs(txn.amount),
        currency: txn.currency,
        status: "captured" as const,
        merchantName: txn.merchant_data?.name ?? "Unknown",
        type: txn.type,
      })),
    };
  }

  async captureTestAuthorizationRaw(providerAuthorizationId: string, amountCents?: number): Promise<{
    auth: Stripe.Issuing.Authorization;
    transactions: Stripe.Issuing.Transaction[];
  }> {
    try {
      const auth = await this.stripe.testHelpers.issuing.authorizations.capture(providerAuthorizationId, {
        ...(amountCents != null ? { capture_amount: amountCents } : {}),
      });
      const providerCardId = typeof auth.card === "string" ? auth.card : auth.card.id;
      const listed = await this.stripe.issuing.transactions.list({ card: providerCardId, limit: 20 });
      const transactions = listed.data.filter((txn) => {
        const authId = typeof txn.authorization === "string" ? txn.authorization : txn.authorization?.id;
        return authId === providerAuthorizationId;
      });
      return { auth, transactions };
    } catch (error) {
      mapStripeError(error);
    }
  }

  /**
   * Test-mode force capture — creates a real Issuing transaction (debits the Financial Account)
   * without depending on real-time authorization webhooks.
   */
  async createForceCaptureRaw(input: {
    providerCardId: string;
    amountCents: number;
    currency: string;
    merchant: string;
    merchantCategory: string;
  }): Promise<Stripe.Issuing.Transaction> {
    try {
      return await this.stripe.testHelpers.issuing.transactions.createForceCapture({
        card: input.providerCardId,
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        merchant_data: {
          name: input.merchant.slice(0, 200),
          category: input.merchantCategory as Stripe.TestHelpers.Issuing.TransactionCreateForceCaptureParams.MerchantData.Category,
        },
      });
    } catch (error) {
      mapStripeError(error);
    }
  }

  constructWebhookEvent(payload: Buffer | string, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
