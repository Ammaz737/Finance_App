import type { PaymentRailProvider } from "./payment-rail.provider";
import { MockPaymentRailAdapter } from "./mock.payment-rail.adapter";
import { StripePaymentRailAdapter } from "./stripe.payment-rail.adapter";

let cached: PaymentRailProvider | null = null;
let cachedKey = "";

function providerKey(): string {
  const name = (process.env.PAYMENT_RAIL_PROVIDER ?? "").trim().toLowerCase()
    || (process.env.CARD_ISSUER_PROVIDER ?? "mock").trim().toLowerCase();
  const token = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const card = (process.env.STRIPE_BILL_PAY_CARD_ID ?? "").trim();
  return `${name}|${token.slice(0, 12)}|${card.slice(0, 12)}`;
}

export function getPaymentRailProvider(): PaymentRailProvider {
  const key = providerKey();
  if (cached && cachedKey === key) return cached;

  const name = (process.env.PAYMENT_RAIL_PROVIDER ?? "").trim().toLowerCase()
    || (process.env.CARD_ISSUER_PROVIDER ?? "mock").trim().toLowerCase();

  if (name === "stripe") {
    cached = new StripePaymentRailAdapter();
  } else {
    cached = new MockPaymentRailAdapter();
  }
  cachedKey = key;
  return cached;
}

export function resetPaymentRailProviderForTests(): void {
  cached = null;
  cachedKey = "";
}
