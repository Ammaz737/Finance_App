"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";

type CardRow = { id: string; status?: string; type?: string; fundId?: string; currency?: string };
type FundRow = { id: string; currency?: string; limitAmount?: string | number; availableAmount?: string | number };

export default function CorporateCardsPage() {
  const router = useRouter();
  const cards = useQuery({ queryKey: ["corporate-cards-overview"], queryFn: () => api.get<CardRow[]>("/cards") });
  const funds = useQuery({ queryKey: ["corporate-card-funds-overview"], queryFn: () => api.get<FundRow[]>("/funds") });
  const active = (cards.data ?? []).filter((row) => row.status === "ACTIVE").length;
  const totals = (funds.data ?? []).reduce<Record<string, { limit: number; spent: number }>>((result, fund) => {
    const currency = fund.currency ?? "USD";
    const limit = Number(fund.limitAmount ?? 0);
    const available = Number(fund.availableAmount ?? 0);
    result[currency] ??= { limit: 0, spent: 0 };
    result[currency].limit += Number.isFinite(limit) ? limit : 0;
    result[currency].spent += Number.isFinite(limit - available) ? limit - available : 0;
    return result;
  }, {});

  return <div className="stack-lg">
    <div className="resource-heading">
      <PageHeader title="Corporate cards" subtitle="Isolated virtual and physical card spend, limits, and controls." />
      <Link className="btn btn-primary" href="/app/spend/requests">Issue card</Link>
    </div>
    <div className="kpi-grid">
      <article className="kpi-card"><span>Total active cards</span><strong>{active}</strong><small>{cards.data?.length ?? 0} cards in workspace</small></article>
      {Object.entries(totals).map(([currency, value]) => <article className="kpi-card" key={currency}><span>{currency} card limits</span><strong>{currency} {value.limit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong><small>Spent {currency} {value.spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</small></article>)}
    </div>
    <section className="panel"><h2>Issue a virtual card</h2><p className="muted">Start a spend request with <strong>Virtual card</strong> fulfillment. After approval, the existing card fulfillment flow issues the isolated card.</p><Link className="btn btn-ghost" href="/app/spend/requests">Open spend request form</Link></section>
    <ResourcePage title="Cards" path="cards" actions={[{ label: "Freeze", name: "freeze" }]} onRowNavigate={(row) => router.push(`/app/cards/${row.id}`)} />
  </div>;
}
