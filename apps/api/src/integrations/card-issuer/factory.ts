import { env } from "../../config/env";
import type { CardIssuerProvider } from "./card-issuer.provider";
import { MockCardIssuerAdapter } from "./mock.card-issuer.adapter";
import { StripeCardIssuerAdapter } from "./stripe.card-issuer.adapter";

let cached: CardIssuerProvider | null = null;

export function getCardIssuer(): CardIssuerProvider {
  if (cached) return cached;
  if (env.cardIssuerProvider === "stripe") {
    if (!env.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is required when CARD_ISSUER_PROVIDER=stripe");
    }
    cached = new StripeCardIssuerAdapter(env.stripeSecretKey, env.stripeFinancialAccountId || undefined);
    return cached;
  }
  cached = new MockCardIssuerAdapter();
  return cached;
}

/** Test-only: reset singleton between cases. */
export function resetCardIssuerForTests(): void {
  cached = null;
}

export function isStripeCardIssuer(): boolean {
  return getCardIssuer().name === "stripe";
}
