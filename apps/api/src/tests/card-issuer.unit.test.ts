import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateCardAuthorizationRules, merchantMatchesLock, mergeMerchantLocks } from "../modules/cards/domain/authorization-rules";
import { MockCardIssuerAdapter } from "../integrations/card-issuer/mock.card-issuer.adapter";
import { resetCardIssuerForTests } from "../integrations/card-issuer/factory";

describe("evaluateCardAuthorizationRules", () => {
  const base = {
    cardStatus: "ACTIVE",
    holderStatus: "ACTIVE",
    fundStatus: "ACTIVE",
    fundAvailable: 500,
    fundValidFrom: new Date("2020-01-01"),
    fundValidTo: null as Date | null,
    amount: 50,
    currency: "USD",
    fundCurrency: "USD",
    merchant: "Amazon",
    merchantCategory: "software",
  };

  it("approves when all checks pass", () => {
    expect(evaluateCardAuthorizationRules(base).decision).toBe("APPROVED");
  });

  it("declines frozen, inactive, and over-limit cards", () => {
    expect(evaluateCardAuthorizationRules({ ...base, cardStatus: "FROZEN" }).reason).toBe("CARD_FROZEN");
    expect(evaluateCardAuthorizationRules({ ...base, cardStatus: "INACTIVE" }).reason).toBe("CARD_INACTIVE");
    expect(evaluateCardAuthorizationRules({ ...base, perTransactionLimit: 10 }).reason).toBe("PER_TXN_LIMIT");
    expect(evaluateCardAuthorizationRules({ ...base, fundAvailable: 10 }).reason).toBe("INSUFFICIENT_FUND");
    expect(evaluateCardAuthorizationRules({ ...base, blockedMccs: "software" }).reason).toBe("MCC_BLOCKED");
    expect(evaluateCardAuthorizationRules({
      ...base,
      monthlyLimit: 100,
      monthlySpendAmount: 80,
      amount: 30,
    }).reason).toBe("MONTHLY_LIMIT");
  });
  it("matches demo aliases against Stripe merchant categories", () => {
    expect(evaluateCardAuthorizationRules({
      ...base,
      merchantCategory: "computer_software_stores",
      allowedMccs: "software,office",
    }).decision).toBe("APPROVED");
    expect(evaluateCardAuthorizationRules({
      ...base,
      merchantCategory: "grocery_stores_supermarkets",
      allowedMccs: "software",
    }).reason).toBe("MCC_BLOCKED");
  });

  it("enforces merchant descriptors without unsafe reverse partial matches", () => {
    expect(merchantMatchesLock("OPENAI *CHATGPT", "OpenAI")).toBe(true);
    expect(merchantMatchesLock("OpenAI, LLC", "openai")).toBe(true);
    expect(merchantMatchesLock("AI", "OpenAI")).toBe(false);
    expect(merchantMatchesLock("Walmart", "Amazon, Microsoft")).toBe(false);
  });

  it("keeps all approved vendor locks when a holder card is reused", () => {
    expect(mergeMerchantLocks("Amazon", "Microsoft")).toBe("Amazon, Microsoft");
    expect(mergeMerchantLocks("Amazon", "amazon")).toBe("Amazon");
    expect(mergeMerchantLocks("Amazon", null)).toBe("Amazon");
    expect(mergeMerchantLocks(null, null)).toBeNull();
  });
});

describe("toStripeSpendingCategories", () => {
  it("maps aliases and rejects unknown freeform values", async () => {
    const { toStripeSpendingCategories } = await import("../integrations/card-issuer/stripe-spending-categories");
    expect(toStripeSpendingCategories(["software", "office"])).toEqual(
      expect.arrayContaining(["computer_software_stores", "stationary_office_supplies_printing_and_writing_paper"]),
    );
    expect(toStripeSpendingCategories(["computer_software_stores"])).toEqual(["computer_software_stores"]);
    expect(() => toStripeSpendingCategories(["not-a-real-mcc"])).toThrow(/Invalid spending category/);
  });
});

describe("MockCardIssuerAdapter parity", () => {
  beforeEach(() => {
    resetCardIssuerForTests();
  });

  it("creates cardholder + card and freezes/unfreezes/cancels with shared shape", async () => {
    const issuer = new MockCardIssuerAdapter();
    const holder = await issuer.createCardholder({
      appUserId: "user-1",
      email: "a@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      billing: { line1: "1 Main", city: "SF", state: "CA", postalCode: "94105", country: "US" },
    });
    const card = await issuer.createCard({
      appCardId: "11111111-1111-1111-1111-111111111111",
      appUserId: "user-1",
      businessId: "entity-1",
      providerCardholderId: holder.providerCardholderId,
      type: "virtual",
      currency: "usd",
      status: "active",
      idempotencyKey: "create-card:11111111-1111-1111-1111-111111111111",
    });
    expect(card).toMatchObject({
      providerCardId: expect.stringMatching(/^ic_mock_/),
      last4: expect.stringMatching(/^\d{4}$/),
      type: "virtual",
      status: "active",
      brand: "visa",
    });

    const frozen = await issuer.freezeCard(card.providerCardId);
    expect(frozen.status).toBe("inactive");
    const active = await issuer.unfreezeCard(card.providerCardId);
    expect(active.status).toBe("active");

    const simulated = issuer.simulateAuthorization({
      providerCardId: card.providerCardId,
      amount: 2500,
      currency: "usd",
      merchantName: "Amazon",
      merchantCategory: "software",
      approve: true,
    });
    expect(simulated.authorization.approved).toBe(true);
    expect(simulated.transaction?.status).toBe("captured");

    const canceled = await issuer.cancelCard(card.providerCardId);
    expect(canceled.status).toBe("canceled");
  });
});

describe("getCardIssuer factory", () => {
  beforeEach(() => {
    resetCardIssuerForTests();
    vi.resetModules();
  });

  it("defaults to mock provider", async () => {
    vi.doMock("../config/env", () => ({
      env: {
        cardIssuerProvider: "mock",
        stripeSecretKey: "",
        stripeWebhookSecret: "",
        stripeIssuingCurrency: "usd",
      },
    }));
    const { getCardIssuer, isStripeCardIssuer } = await import("../integrations/card-issuer/factory");
    expect(getCardIssuer().name).toBe("mock");
    expect(isStripeCardIssuer()).toBe(false);
  });
});
