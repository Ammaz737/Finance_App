"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { ResourcePage } from "@/components/ResourcePage";
import { useSession } from "@/providers/session-provider";

type BudgetRow = {
  id: string;
  name?: string;
  amount?: string | number;
  actualAmount?: string | number;
  committedAmount?: string | number;
  remainingAmount?: string | number;
  usedAmount?: string | number;
  utilizationPct?: number;
  overBudget?: boolean;
  currency?: string;
  period?: string;
  freshness?: string;
};

function money(currency: string, value: string | number | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

const focusLinks = [
  { href: "/app/insights/budgets", label: "All", focus: null as string | null },
  { href: "/app/insights/budgets?focus=over", label: "Over budget", focus: "over" },
  { href: "/app/insights/budgets?focus=high", label: "High use (≥80%)", focus: "high" },
];

function BudgetsContent() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const focus = search.get("focus");
  const activeFocus = focus === "over" || focus === "high" ? focus : null;

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

  const columns: Column<BudgetRow>[] = [
    {
      key: "name",
      header: "Budget",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Budget"}</strong>
          <small>
            {row.period?.replaceAll("_", " ") || "Period"}
            {row.freshness ? ` · as of ${new Date(row.freshness).toLocaleDateString()}` : ""}
          </small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Capacity",
      render: (row) => money(row.currency ?? "USD", row.amount),
    },
    {
      key: "remainingAmount",
      header: "Remaining",
      render: (row) => (
        <span className={row.overBudget ? "budget-remaining is-over" : "budget-remaining"}>
          {money(row.currency ?? "USD", row.remainingAmount)}
        </span>
      ),
    },
    {
      key: "utilizationPct",
      header: "Utilization",
      render: (row) => {
        const pct = Math.max(0, Math.min(100, Number(row.utilizationPct ?? 0)));
        const over = Boolean(row.overBudget);
        return (
          <div className={`util-meter${over ? " is-over" : pct >= 80 ? " is-high" : ""}`}>
            <div className="util-meter-track" aria-hidden>
              <span style={{ width: `${over ? 100 : pct}%` }} />
            </div>
            <div className="util-meter-meta">
              {over ? <StatusBadge status="OVER" /> : <span>{pct}% used</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: "usedAmount",
      header: "Used",
      render: (row) => (
        <span className="muted" title={`Actual ${money(row.currency ?? "USD", row.actualAmount)} · Committed ${money(row.currency ?? "USD", row.committedAmount)}`}>
          {money(row.currency ?? "USD", row.usedAmount)}
        </span>
      ),
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  return (
    <div className="insights-budgets-page linked-dest-page">
      <div className="my-work-filters" role="toolbar" aria-label="Budget focus">
        {focusLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`chip${activeFocus === item.focus ? " chip-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <ResourcePage
        title="Budgets"
        path="budgets"
        columns={columns}
        pageSize={20}
        predicate={(row) => {
          if (activeFocus === "over") return Boolean(row.overBudget);
          if (activeFocus === "high") return Number(row.utilizationPct ?? 0) >= 80;
          return true;
        }}
        onRowNavigate={(row) => router.push(`/app/insights/budgets/${row.id}`)}
      />

      <p className="muted my-expenses-hint">
        Remaining = capacity − actual − committed. Actual and committed never count the same dollars twice.{" "}
        {canSeeDashboard && (
          <Link className="detail-link" href="/app/insights/dashboard">
            Executive dashboard →
          </Link>
        )}{" "}
        {canSeePrograms && (
          <Link className="detail-link" href="/app/spend/programs">
            Spend programs →
          </Link>
        )}
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading budgets…</p>}>
      <BudgetsContent />
    </Suspense>
  );
}
