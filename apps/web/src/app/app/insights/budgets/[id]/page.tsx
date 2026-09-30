"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

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
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function BudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const detail = useQuery({
    queryKey: ["budget-detail", params.id],
    queryFn: () => api.get<Detail>(`/budgets/${params.id}`),
  });

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load budget.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading budget…</p>;

  const { budget, programs, currencyNote } = detail.data;
  const pct = Math.max(0, Math.min(100, Number(budget.utilizationPct ?? 0)));
  const canSeePrograms = session
    ? canSeeItem(
        findNavItem("/app/spend/programs") ?? { href: "/app/spend/programs", permission: "spend_program.manage" },
        session,
      )
    : false;
  const canSeeDashboard = session
    ? canSeeItem(
        findNavItem("/app/insights/dashboard") ?? { href: "/app/insights/dashboard", permission: "report.read" },
        session,
      )
    : false;

  return (
    <div className="spend-detail budget-detail-page linked-dest-page">
      <div className="resource-heading">
        <PageHeader
          title={budget.name}
          subtitle={`${budget.period.replaceAll("_", " ")} · Capacity ${money(budget.currency, budget.amount)}`}
        />
        <div className="detail-actions-top">
          {budget.overBudget ? <StatusBadge status="OVER" /> : null}
          <Link className="btn btn-ghost" href="/app/insights/budgets">
            Back to budgets
          </Link>
        </div>
      </div>

      <div className={`util-meter large${budget.overBudget ? " is-over" : pct >= 80 ? " is-high" : ""}`} aria-label={`Utilization ${pct} percent`}>
        <div className="util-meter-track" aria-hidden>
          <span style={{ width: `${budget.overBudget ? 100 : pct}%` }} />
        </div>
        <div className="util-meter-meta">
          <strong>{budget.overBudget ? "Over capacity" : `${pct}% used`}</strong>
          <span>
            Used {money(budget.currency, budget.usedAmount)} · Remaining {money(budget.currency, budget.remainingAmount)}
          </span>
        </div>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <span>Remaining</span>
          <strong className={budget.overBudget ? "budget-remaining is-over" : undefined}>
            {money(budget.currency, budget.remainingAmount)}
          </strong>
          <small>{budget.overBudget ? "Over budget" : "Still available"}</small>
        </article>
        <article className="kpi-card">
          <span>Actual</span>
          <strong>{money(budget.currency, budget.actualAmount)}</strong>
          <small>Captured spend</small>
        </article>
        <article className="kpi-card">
          <span>Committed</span>
          <strong>{money(budget.currency, budget.committedAmount)}</strong>
          <small>Reserved, not yet actual</small>
        </article>
        <article className="kpi-card">
          <span>Capacity</span>
          <strong>{money(budget.currency, budget.amount)}</strong>
          <small>{budget.period.replaceAll("_", " ")}</small>
        </article>
      </div>

      <p className="muted" role="note">
        {currencyNote} Freshness {new Date(budget.freshness).toLocaleString()}.
      </p>

      <div className="work-panels">
        <section className="work-panel">
          <h2>Linked programs</h2>
          <ul className="plain-list">
            {programs.map((program) => (
              <li key={program.id}>
                {canSeePrograms ? (
                  <Link className="detail-link" href={`/app/spend/programs/${program.id}`}>
                    {program.name}
                  </Link>
                ) : (
                  program.name
                )}{" "}
                · {money(program.currency, program.maxAmount)} · <StatusBadge status={program.status} />
              </li>
            ))}
            {!programs.length && <li className="muted">No spend programs linked.</li>}
          </ul>
          {canSeePrograms && (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              <Link className="detail-link" href="/app/spend/programs">
                Manage spend programs →
              </Link>
            </p>
          )}
        </section>
        <section className="work-panel muted-panel">
          <h2>Related</h2>
          <Link href="/app/insights/budgets"><span>All budgets</span><strong>List</strong></Link>
          {canSeeDashboard && (
            <Link href="/app/insights/dashboard"><span>Executive dashboard</span><strong>Position</strong></Link>
          )}
          {canSeePrograms && (
            <Link href="/app/spend/programs"><span>Spend programs</span><strong>Controls</strong></Link>
          )}
        </section>
      </div>
    </div>
  );
}
