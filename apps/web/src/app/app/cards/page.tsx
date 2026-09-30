"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { VirtualCardFace } from "@/components/VirtualCardFace";
import { primaryPerHolder, type CardLike } from "@/lib/card-primary";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type CardRow = CardLike & {
  last4?: string;
  network?: string;
  brand?: string;
  provider?: string;
  stripeCardId?: string | null;
  merchantLock?: string | null;
  fundId?: string;
};
type FundRow = {
  id: string;
  name?: string;
  currency?: string;
  limitAmount?: string | number;
  availableAmount?: string | number;
};
type PersonRow = { id: string; firstName?: string; lastName?: string; email?: string };

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export default function CorporateCardsPage() {
  const router = useRouter();
  const session = useSession();
  const [search, setSearch] = useState("");
  const [statusFocus, setStatusFocus] = useState<"ALL" | "ACTIVE" | "FROZEN">("ALL");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const cards = useQuery({
    queryKey: ["corporate-cards-overview"],
    queryFn: () => api.get<CardRow[]>("/cards"),
  });
  const funds = useQuery({
    queryKey: ["corporate-card-funds-overview"],
    queryFn: async () => {
      try {
        return await api.get<FundRow[]>("/funds");
      } catch {
        return [] as FundRow[];
      }
    },
  });
  const people = useQuery({
    queryKey: ["corporate-card-people"],
    queryFn: async () => {
      try {
        return await api.get<PersonRow[]>("/people");
      } catch {
        return [] as PersonRow[];
      }
    },
  });

  const fundById = useMemo(() => new Map((funds.data ?? []).map((fund) => [fund.id, fund])), [funds.data]);
  const personById = useMemo(() => new Map((people.data ?? []).map((person) => [person.id, person])), [people.data]);
  const primaries = useMemo(() => primaryPerHolder(cards.data ?? []), [cards.data]);

  const visible = useMemo(() => {
    return primaries.filter((card) => {
      if (statusFocus !== "ALL" && card.status !== statusFocus) return false;
      if (!deferredSearch) return true;
      const holder = personById.get(card.holderId ?? "");
      const holderName = holder
        ? `${holder.firstName ?? ""} ${holder.lastName ?? ""} ${holder.email ?? ""}`.toLowerCase()
        : "";
      const fund = fundById.get(card.fundId ?? "");
      const haystack = `${holderName} ${card.last4 ?? ""} ${fund?.name ?? ""} ${card.merchantLock ?? ""}`.toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [primaries, statusFocus, deferredSearch, personById, fundById]);

  const active = primaries.filter((row) => row.status === "ACTIVE").length;
  const frozen = primaries.filter((row) => row.status === "FROZEN").length;
  const availableTotal = primaries.reduce((sum, card) => {
    const fund = fundById.get(card.fundId ?? "");
    const amount = Number(fund?.availableAmount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const currency = funds.data?.find((fund) => fund.currency)?.currency ?? "USD";

  const canSeeQueue = session
    ? canSeeItem(findNavItem("/app/spend/requests") ?? { href: "/app/spend/requests", permission: "spend_request.approve" }, session)
    : false;
  const canCreateSpend = session
    ? canSeeItem(findNavItem("/app/me/requests") ?? { href: "/app/me/requests", permission: "spend_request.create" }, session)
    : false;
  const canSeeFunds = session
    ? canSeeItem(findNavItem("/app/spend/funds") ?? { href: "/app/spend/funds", permission: "card.read" }, session)
    : false;
  const issueHref = canSeeQueue ? "/app/spend/requests" : canCreateSpend ? "/app/me/requests" : "/app/home";
  const issueLabel = canSeeQueue ? "Open spend requests" : canCreateSpend ? "My requests" : "Overview";

  return (
    <div className="corporate-cards-page">
      <div className="resource-heading">
        <PageHeader
          title="Corporate cards"
          subtitle="One virtual card per person. New spend approvals top up that card’s fund."
        />
        <Link className="btn btn-primary" href={issueHref}>
          Issue / top up
        </Link>
      </div>

      <div className="corporate-cards-kpis">
        <article className="corporate-kpi primary">
          <span>People with cards</span>
          <strong>{primaries.length}</strong>
          <small>
            {active} active{frozen ? ` · ${frozen} frozen` : ""}
          </small>
        </article>
        <article className="corporate-kpi">
          <span>Available across cards</span>
          <strong>{money(currency, availableTotal)}</strong>
          <small>
            {canSeeFunds ? (
              <Link className="detail-link" href="/app/spend/funds">
                View funds →
              </Link>
            ) : (
              "Wallet balances"
            )}
          </small>
        </article>
        <article className="corporate-kpi">
          <span>Issue path</span>
          <strong>Spend request</strong>
          <small>
            <Link className="detail-link" href={issueHref}>
              {issueLabel} →
            </Link>
          </small>
        </article>
      </div>

      <div className="corporate-cards-toolbar">
        <label className="search-field corporate-cards-search">
          <span className="sr-only">Search cards</span>
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search holder, last4, fund…"
          />
        </label>
        <div className="my-work-filters corporate-cards-chips" role="toolbar" aria-label="Card status filters">
          {(
            [
              ["ALL", "All", primaries.length],
              ["ACTIVE", "Active", active],
              ["FROZEN", "Frozen", frozen],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`chip${statusFocus === key ? " chip-active" : ""}`}
              onClick={() => setStatusFocus(key)}
            >
              {label} <span className="chip-count">{count}</span>
            </button>
          ))}
        </div>
        <span className="record-count">{visible.length} shown</span>
      </div>

      {cards.isPending ? (
        <p className="muted">Loading cards…</p>
      ) : cards.isError ? (
        <div className="error-panel" role="alert">
          Could not load cards.{" "}
          <button className="text-button" type="button" onClick={() => void cards.refetch()}>
            Try again
          </button>
        </div>
      ) : primaries.length === 0 ? (
        <div className="empty-work">
          <strong>No cards issued yet</strong>
          <p>
            Start a spend request with <strong>Virtual card</strong> fulfillment. After approval, the holder gets one
            card (later approvals top it up).
          </p>
          <Link className="btn btn-primary" href={issueHref} style={{ marginTop: 14, display: "inline-block" }}>
            {issueLabel}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p className="muted">No cards match the current filters.</p>
        </div>
      ) : (
        <div className="corporate-cards-grid">
          {visible.map((card) => {
            const fund = fundById.get(card.fundId ?? "");
            const holder = personById.get(card.holderId ?? "");
            const holderName = holder
              ? `${holder.firstName ?? ""} ${holder.lastName ?? ""}`.trim() || holder.email || "—"
              : "—";
            const notes: string[] = [];
            if (card.terminatedCount > 0) notes.push(`${card.terminatedCount} terminated`);
            if (card.extraLiveCount > 0) notes.push(`${card.extraLiveCount} other live`);

            return (
              <button
                key={card.id}
                type="button"
                className="corporate-card-tile"
                onClick={() => router.push(`/app/cards/${card.id}`)}
              >
                <VirtualCardFace
                  compact
                  last4={card.last4}
                  network={card.network}
                  brand={card.brand}
                  provider={card.provider}
                  type={card.type}
                  status={card.status}
                />
                <div className="corporate-card-meta">
                  <div className="corporate-card-meta-top">
                    <strong>{holderName}</strong>
                    <StatusBadge status={card.status ?? "UNKNOWN"} />
                  </div>
                  <div className="corporate-card-meta-balance">
                    {fund ? money(fund.currency ?? "USD", fund.availableAmount ?? 0) : "No fund"}
                  </div>
                  <div className="corporate-card-meta-fund">
                    {fund?.name ?? "Wallet fund"}
                    {card.merchantLock ? ` · Lock: ${card.merchantLock}` : ""}
                    {notes.length ? ` · ${notes.join(" · ")}` : ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
