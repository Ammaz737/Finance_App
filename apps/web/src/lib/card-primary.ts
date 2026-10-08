/** Pick the live virtual card for a holder; count prior terminated siblings. */

export type CardLike = {
  id: string;
  status?: string;
  type?: string;
  holderId?: string;
  createdAt?: string;
  last4?: string;
  fundId?: string;
  provider?: string | null;
  stripeCardId?: string | null;
};

export type PrimaryCard<T extends CardLike> = T & {
  terminatedCount: number;
  extraLiveCount: number;
};

function isLive(status?: string) {
  return status === "ACTIVE" || status === "FROZEN";
}

function isVirtual(type?: string) {
  if (!type) return true;
  const normalized = type.toUpperCase();
  return normalized === "VIRTUAL" || normalized === "VIRTUAL_CARD";
}

function isStripeLinked(card: CardLike) {
  return card.provider === "stripe" || Boolean(card.stripeCardId);
}

function sortNewestFirst(a: CardLike, b: CardLike) {
  // Prefer real issuer cards over leftover seed/mock rows.
  const aStripe = isStripeLinked(a) ? 1 : 0;
  const bStripe = isStripeLinked(b) ? 1 : 0;
  if (aStripe !== bStripe) return bStripe - aStripe;
  if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
  if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
  return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
}

/** One primary live card per holder for corporate overview. */
export function primaryPerHolder<T extends CardLike>(cards: T[]): Array<PrimaryCard<T>> {
  const byHolder = new Map<string, T[]>();
  for (const card of cards) {
    const key = card.holderId ?? card.id;
    const list = byHolder.get(key) ?? [];
    list.push(card);
    byHolder.set(key, list);
  }

  const primaries: Array<PrimaryCard<T>> = [];
  for (const [, list] of byHolder) {
    const virtual = list.filter((row) => isVirtual(row.type));
    const poolSource = virtual.length ? virtual : list;
    const live = poolSource.filter((row) => isLive(row.status));
    const pool = live.length ? live : poolSource;
    const primary = [...pool].sort(sortNewestFirst)[0];
    if (!primary) continue;
    primaries.push({
      ...primary,
      terminatedCount: list.filter((row) => row.status === "TERMINATED").length,
      extraLiveCount: list.filter((row) => row.id !== primary.id && isLive(row.status)).length,
    });
  }
  return primaries.sort((a, b) => String(a.holderId ?? "").localeCompare(String(b.holderId ?? "")));
}

export type PickPrimaryOptions = {
  /** Prefer spend / consolidator wallets over travel temp funds (matches API findHolderLiveCard). */
  excludeFundIds?: string[];
};

/** Single primary for the signed-in holder. */
export function pickPrimaryCard<T extends CardLike>(cards: T[], options?: PickPrimaryOptions): T | null {
  const virtual = cards.filter((row) => isVirtual(row.type));
  const poolSource = virtual.length ? virtual : cards;
  const live = poolSource.filter((row) => isLive(row.status));
  let pool = live.length ? live : poolSource;
  const excluded = new Set((options?.excludeFundIds ?? []).filter(Boolean));
  if (excluded.size) {
    const withoutTravel = pool.filter((row) => !row.fundId || !excluded.has(row.fundId));
    if (withoutTravel.length) pool = withoutTravel;
  }
  return [...pool].sort(sortNewestFirst)[0] ?? null;
}
