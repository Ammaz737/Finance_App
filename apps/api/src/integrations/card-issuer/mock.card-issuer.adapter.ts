import {
  CardIssuerError,
  type CardIssuerProvider,
  type CreateCardholderInput,
  type CreateCardInput,
  type IssuerAuthorizationResult,
  type IssuerCardResult,
  type IssuerSpendingControls,
  type IssuerTransactionResult,
  type ReplaceCardInput,
} from "./card-issuer.provider";

type MockStore = {
  cardholders: Map<string, { id: string; email: string; appUserId: string }>;
  cards: Map<string, IssuerCardResult & { controls?: IssuerSpendingControls; appCardId: string }>;
  authorizations: Map<string, IssuerAuthorizationResult>;
  transactions: Map<string, IssuerTransactionResult>;
};

const globalStore: MockStore = {
  cardholders: new Map(),
  cards: new Map(),
  authorizations: new Map(),
  transactions: new Map(),
};

function last4FromId(id: string) {
  const digits = id.replace(/\D/g, "");
  return (digits.slice(-4) || "4242").padStart(4, "0").slice(-4);
}

/** Mock card issuer with the same port shape as Stripe. Fake IDs; same states/events. */
export class MockCardIssuerAdapter implements CardIssuerProvider {
  readonly name = "mock" as const;

  async createCardholder(input: CreateCardholderInput) {
    const existing = [...globalStore.cardholders.values()].find((row) => row.appUserId === input.appUserId);
    if (existing) return { providerCardholderId: existing.id };
    const id = `ich_mock_${input.appUserId.slice(0, 8)}`;
    globalStore.cardholders.set(id, { id, email: input.email, appUserId: input.appUserId });
    return { providerCardholderId: id };
  }

  async createCard(input: CreateCardInput): Promise<IssuerCardResult> {
    if (!globalStore.cardholders.has(input.providerCardholderId)) {
      throw new CardIssuerError("cardholder_requirements_missing", "Cardholder not found");
    }
    const providerCardId = `ic_mock_${input.appCardId.replace(/-/g, "").slice(0, 16)}`;
    const status = input.status === "active" ? "active" : "inactive";
    const result: IssuerCardResult = {
      providerCardId,
      providerCardholderId: input.providerCardholderId,
      last4: last4FromId(providerCardId),
      type: input.type,
      status,
      brand: "visa",
      network: "MOCK",
    };
    globalStore.cards.set(providerCardId, { ...result, controls: input.spendingControls, appCardId: input.appCardId });
    return result;
  }

  async getCard(providerCardId: string): Promise<IssuerCardResult> {
    const card = globalStore.cards.get(providerCardId);
    if (!card) throw new CardIssuerError("provider_error", "Card not found");
    const { controls: _c, appCardId: _a, ...result } = card;
    return result;
  }

  async freezeCard(providerCardId: string): Promise<IssuerCardResult> {
    const card = await this.requireCard(providerCardId);
    if (card.status === "canceled") throw new CardIssuerError("card_inactive", "Canceled card cannot be frozen");
    card.status = "inactive";
    return this.publicCard(card);
  }

  async unfreezeCard(providerCardId: string): Promise<IssuerCardResult> {
    const card = await this.requireCard(providerCardId);
    if (card.status === "canceled") throw new CardIssuerError("card_inactive", "Canceled card cannot be activated");
    card.status = "active";
    return this.publicCard(card);
  }

  async cancelCard(providerCardId: string): Promise<IssuerCardResult> {
    const card = await this.requireCard(providerCardId);
    card.status = "canceled";
    return this.publicCard(card);
  }

  async replaceCard(input: ReplaceCardInput): Promise<IssuerCardResult> {
    const old = await this.requireCard(input.providerCardId);
    old.status = "canceled";
    return this.createCard({
      appCardId: input.appCardId,
      appUserId: input.appUserId,
      businessId: input.businessId,
      providerCardholderId: old.providerCardholderId ?? `ich_mock_${input.appUserId.slice(0, 8)}`,
      type: old.type,
      currency: "usd",
      status: "inactive",
      idempotencyKey: input.idempotencyKey,
    });
  }

  async getAuthorization(providerAuthorizationId: string): Promise<IssuerAuthorizationResult> {
    const row = globalStore.authorizations.get(providerAuthorizationId);
    if (!row) throw new CardIssuerError("provider_error", "Authorization not found");
    return row;
  }

  async getTransaction(providerTransactionId: string): Promise<IssuerTransactionResult> {
    const row = globalStore.transactions.get(providerTransactionId);
    if (!row) throw new CardIssuerError("provider_error", "Transaction not found");
    return row;
  }

  async updateSpendingControls(providerCardId: string, controls: IssuerSpendingControls): Promise<IssuerCardResult> {
    const card = await this.requireCard(providerCardId);
    card.controls = controls;
    return this.publicCard(card);
  }

  async approveAuthorization(providerAuthorizationId: string): Promise<IssuerAuthorizationResult> {
    const row = await this.getAuthorization(providerAuthorizationId);
    row.status = "closed";
    row.approved = true;
    return row;
  }

  async declineAuthorization(providerAuthorizationId: string, _reason?: string): Promise<IssuerAuthorizationResult> {
    const row = await this.getAuthorization(providerAuthorizationId);
    row.status = "closed";
    row.approved = false;
    return row;
  }

  /** Test helper: simulate authorization.request → approved/declined + optional capture txn. */
  simulateAuthorization(input: {
    providerCardId: string;
    amount: number;
    currency: string;
    merchantName: string;
    merchantCategory: string;
    approve: boolean;
  }): { authorization: IssuerAuthorizationResult; transaction?: IssuerTransactionResult } {
    const card = globalStore.cards.get(input.providerCardId);
    if (!card || card.status !== "active") {
      throw new CardIssuerError("card_inactive", "Card is not active");
    }
    const providerAuthorizationId = `iauth_mock_${Date.now()}`;
    const authorization: IssuerAuthorizationResult = {
      providerAuthorizationId,
      providerCardId: input.providerCardId,
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      status: "pending",
      merchantName: input.merchantName,
      merchantCategory: input.merchantCategory,
      approved: input.approve,
    };
    globalStore.authorizations.set(providerAuthorizationId, authorization);
    authorization.status = "closed";
    if (!input.approve) return { authorization };
    const providerTransactionId = `ipi_mock_${Date.now()}`;
    const transaction: IssuerTransactionResult = {
      providerTransactionId,
      providerAuthorizationId,
      providerCardId: input.providerCardId,
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      status: "captured",
      merchantName: input.merchantName,
      type: "capture",
    };
    globalStore.transactions.set(providerTransactionId, transaction);
    return { authorization, transaction };
  }

  private async requireCard(providerCardId: string) {
    const card = globalStore.cards.get(providerCardId);
    if (!card) throw new CardIssuerError("provider_error", "Card not found");
    return card;
  }

  private publicCard(card: IssuerCardResult & { controls?: IssuerSpendingControls; appCardId: string }): IssuerCardResult {
    return {
      providerCardId: card.providerCardId,
      providerCardholderId: card.providerCardholderId,
      last4: card.last4,
      type: card.type,
      status: card.status,
      brand: card.brand,
      network: card.network,
    };
  }
}
