import Stripe from "stripe";
import { env } from "../../config/env";
import type {
  PaymentRailProvider,
  PaymentRailReleaseInput,
  PaymentRailReleaseResult,
  PaymentRailSettleInput,
  PaymentRailSettleResult,
} from "./payment-rail.provider";

const STRIPE_MM_VERSION = "2025-12-15.preview";

/**
 * Test-mode bill-pay rail: debits the company Stripe Financial Account on Release
 * via Issuing force-capture against a dedicated bill-pay card (not stored in app DB,
 * so webhooks do not create employee expenses).
 */
export class StripePaymentRailAdapter implements PaymentRailProvider {
  readonly name = "stripe" as const;
  private readonly stripe: Stripe;
  private billPayCardId: string | null = null;

  constructor(secretKey = env.stripeSecretKey) {
    if (!secretKey.trim()) {
      throw new Error("STRIPE_SECRET_KEY is required for StripePaymentRailAdapter");
    }
    this.stripe = new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" });
  }

  private async resolveFinancialAccountId(): Promise<string> {
    const configured = env.stripeFinancialAccountId.trim();
    if (configured) return configured;
    const listed = await this.stripe.rawRequest(
      "GET",
      "/v2/money_management/financial_accounts",
      undefined,
      { additionalHeaders: { "Stripe-Version": STRIPE_MM_VERSION } },
    ) as { data?: Array<{ id?: string; status?: string }> };
    const open = (listed.data ?? []).find((row) => row.status === "open" && row.id);
    if (open?.id) return open.id;
    throw new Error("STRIPE_FINANCIAL_ACCOUNT_ID is required for Stripe bill-pay debits");
  }

  /** Dedicated Issuing card used only to force-capture (debit FA). Prefer env override. */
  private async ensureBillPayDebitCard(): Promise<string> {
    const configured = (process.env.STRIPE_BILL_PAY_CARD_ID ?? "").trim();
    if (configured.startsWith("ic_")) {
      this.billPayCardId = configured;
      return configured;
    }
    if (this.billPayCardId) return this.billPayCardId;

    const existing = await this.stripe.issuing.cards.list({ limit: 40, status: "active" });
    const tagged = existing.data.find((card) => card.metadata?.purpose === "bill_pay_rail");
    if (tagged) {
      this.billPayCardId = tagged.id;
      return tagged.id;
    }

    const fa = await this.resolveFinancialAccountId();
    const holders = await this.stripe.issuing.cardholders.list({ limit: 40 });
    let holder = holders.data.find((row) => row.metadata?.purpose === "bill_pay_rail" && row.type === "individual");
    if (!holder) {
      holder = await this.stripe.issuing.cardholders.create({
        type: "individual",
        name: "Bill Pay Rail",
        email: "billpay-rail@example.com",
        phone_number: "+14155550199",
        status: "active",
        individual: {
          first_name: "Bill",
          last_name: "Pay",
          dob: { day: 15, month: 6, year: 1990 },
          card_issuing: {
            user_terms_acceptance: {
              date: Math.floor(Date.now() / 1000),
              ip: "127.0.0.1",
            },
          },
        },
        billing: {
          address: {
            line1: "1 Market St",
            city: "San Francisco",
            state: "CA",
            postal_code: "94105",
            country: "US",
          },
        },
        metadata: { purpose: "bill_pay_rail" },
      });
    }

    const card = await this.stripe.issuing.cards.create(
      {
        cardholder: holder.id,
        currency: env.stripeIssuingCurrency || "usd",
        type: "virtual",
        status: "active",
        metadata: { purpose: "bill_pay_rail" },
        financial_account_v2: fa,
      } as Stripe.Issuing.CardCreateParams & { financial_account_v2: string },
    );
    this.billPayCardId = card.id;
    console.log(`[payment-rail.stripe] Created bill-pay debit card ${card.id} — set STRIPE_BILL_PAY_CARD_ID=${card.id}`);
    return card.id;
  }

  private toCents(amount: string, currency: string): number {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid payment amount: ${amount}`);
    // Stripe major currencies use 2 decimal places.
    const factor = ["jpy", "krw"].includes(currency.toLowerCase()) ? 1 : 100;
    return Math.round(n * factor);
  }

  async release(input: PaymentRailReleaseInput): Promise<PaymentRailReleaseResult> {
    try {
      const cardId = await this.ensureBillPayDebitCard();
      const amountCents = this.toCents(input.amount, input.currency);
      const merchant = (input.description?.trim() || `Bill pay ${input.rail}`).slice(0, 200);
      const txn = await this.stripe.testHelpers.issuing.transactions.createForceCapture({
        card: cardId,
        amount: amountCents,
        currency: input.currency.toLowerCase(),
        merchant_data: {
          name: merchant,
          category: "miscellaneous_specialty_retail",
        },
      });
      return {
        providerRef: txn.id,
        status: "ACCEPTED",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe bill-pay debit failed";
      console.error("[payment-rail.stripe] release failed", message);
      return { providerRef: "", status: "REJECTED", failureReason: message };
    }
  }

  async settle(input: PaymentRailSettleInput): Promise<PaymentRailSettleResult> {
    const ref = input.providerRef.trim();
    if (!ref) {
      return { settlementId: "", status: "FAILED", failureReason: "Missing provider ref" };
    }
    if (ref.startsWith("mock_")) {
      return { settlementId: `mock_settle_${ref}`, status: "COMPLETED" };
    }
    try {
      if (ref.startsWith("ipi_")) {
        const txn = await this.stripe.issuing.transactions.retrieve(ref);
        return {
          settlementId: `stripe_settle_${txn.id}`,
          status: "COMPLETED",
        };
      }
      return {
        settlementId: `stripe_settle_${ref}`,
        status: "COMPLETED",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe settlement lookup failed";
      return { settlementId: "", status: "FAILED", failureReason: message };
    }
  }
}
