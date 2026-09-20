"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";

type Detail = {
  budget: {
    id: string; name: string; currency: string; period: string;
    amount: string; actualAmount: string; committedAmount: string;
    usedAmount: string; remainingAmount: string; utilizationPct: number;
    overBudget: boolean; freshness: string; legalEntityId: string;
  };
  programs: Array<{ id: string; name: string; maxAmount: string | number; currency: string; status: string }>;
  currencyNote: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : String(value)}`;
}

export default function BudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useQuery({
    queryKey: ["budget-detail", params.id],
    queryFn: () => api.get<Detail>(`/budgets/${params.id}`),
  });

  if (detail.isError) {
    return <div className="error-panel" role="alert">Could not load budget. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading budget…</p>;

  const { budget, programs, currencyNote } = detail.data;

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={budget.name} subtitle={`${budget.period} · ${money(budget.currency, budget.amount)}`} />
      <Link className="btn btn-ghost" href="/app/insights/budgets">Back</Link>
    </div>
    <div className="kpi-grid">
      <article className="kpi-card"><span>Remaining</span><strong>{money(budget.currency, budget.remainingAmount)}</strong><small>{budget.overBudget ? <StatusBadge status="OVER" /> : `${budget.utilizationPct}% used`}</small></article>
      <article className="kpi-card"><span>Actual</span><strong>{money(budget.currency, budget.actualAmount)}</strong><small>Captured spend</small></article>
      <article className="kpi-card"><span>Committed</span><strong>{money(budget.currency, budget.committedAmount)}</strong><small>Reserved, not yet actual</small></article>
    </div>
    <p className="muted" role="note">{currencyNote} Freshness {new Date(budget.freshness).toLocaleString()}.</p>
    <section className="work-panel">
      <h2>Linked programs</h2>
      <ul className="plain-list">
        {programs.map((program) => (
          <li key={program.id}>{program.name} · {money(program.currency, program.maxAmount)} · <StatusBadge status={program.status} /></li>
        ))}
        {!programs.length && <li className="muted">No spend programs linked.</li>}
      </ul>
    </section>
  </div>;
}
