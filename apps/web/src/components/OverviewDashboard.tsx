"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type MoneyTotal = { currency: string; amount: string };
type MyOverview = { cards: number; openExpenses: number; pendingRequests: number; availableFunds: MoneyTotal[] };
type FinanceOverview = {
  clearedSpendByCurrency: MoneyTotal[];
  openPayablesByCurrency: MoneyTotal[];
  budgetCapacityByCurrency?: MoneyTotal[];
  budgetUsedByCurrency?: MoneyTotal[];
  openPoCommitmentsByCurrency?: MoneyTotal[];
  activePeople: number;
  pendingBills: number;
  accountingReview: number;
  pendingRequests: number;
  travelPending?: number;
  unreadNotifications?: number;
  integrations?: { total: number; healthy: number; degraded: number };
  freshness?: { asOf: string; budgetFreshness: string };
  asOf: string;
};

function moneyList(totals: MoneyTotal[] | undefined) {
  if (!totals?.length) return "—";
  return totals.map((item) => `${item.currency} ${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(" · ");
}

export function OverviewDashboard({ executive = false }: { executive?: boolean }) {
  const session = useSession();
  const canReport = Boolean(session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("report.read"));
  const mine = useQuery({ queryKey: ["my-overview"], queryFn: () => api.get<MyOverview>("/identity/overview") });
  const finance = useQuery({ queryKey: ["finance-overview"], queryFn: () => api.get<FinanceOverview>("/reporting"), enabled: canReport });
  const name = session?.user.firstName ?? "there";

  return <div className="overview-page">
    <PageHeader title={executive ? "Executive dashboard" : `Welcome back, ${name}`} subtitle={executive ? "Current finance position with currency-scoped totals and freshness" : "Your financial work, all in one place"} />
    {mine.isError && <p className="error-panel" role="alert">Your workspace summary could not load.</p>}
    <div className="section-title"><h2>My work</h2><span>Current status</span></div>
    <div className="kpi-grid">
      <Link href="/app/me/cards" className="kpi-card"><span>Available funds</span><strong>{mine.isPending ? "…" : moneyList(mine.data?.availableFunds)}</strong><small>{mine.data?.cards ?? 0} active cards</small></Link>
      <Link href="/app/me/expenses" className="kpi-card"><span>Expenses to complete</span><strong>{mine.data?.openExpenses ?? "—"}</strong><small>Receipts and review</small></Link>
      <Link href="/app/me/requests" className="kpi-card"><span>My pending requests</span><strong>{mine.data?.pendingRequests ?? "—"}</strong><small>Awaiting a decision</small></Link>
      <Link href="/app/notifications" className="kpi-card"><span>Notifications</span><strong>{finance.data?.unreadNotifications ?? "—"}</strong><small>Unread for you</small></Link>
    </div>
    {canReport && <>
      <div className="section-title"><h2>Company overview</h2><span>{finance.data?.asOf ? `As of ${new Date(finance.data.asOf).toLocaleString()}` : "Loading…"}</span></div>
      {finance.isError ? <p className="error-panel" role="alert">Company totals could not load.</p> : <div className="kpi-grid">
        <Link href="/app/spend/transactions" className="kpi-card"><span>Cleared card spend</span><strong>{moneyList(finance.data?.clearedSpendByCurrency)}</strong><small>By transaction currency</small></Link>
        <Link href="/app/bill-pay/bills" className="kpi-card"><span>Open payables</span><strong>{moneyList(finance.data?.openPayablesByCurrency)}</strong><small>{finance.data?.pendingBills ?? 0} bills pending approval</small></Link>
        <Link href="/app/insights/budgets" className="kpi-card"><span>Budget remaining</span><strong>{moneyList(finance.data?.budgetCapacityByCurrency)}</strong><small>Used {moneyList(finance.data?.budgetUsedByCurrency)}</small></Link>
        <Link href="/app/procurement/purchase-orders" className="kpi-card"><span>Open PO commitments</span><strong>{moneyList(finance.data?.openPoCommitmentsByCurrency)}</strong><small>Unbilled PO balance</small></Link>
        <Link href="/app/accounting/overview" className="kpi-card"><span>Accounting review</span><strong>{finance.data?.accountingReview ?? "—"}</strong><small>Entries needing attention</small></Link>
        <Link href="/app/company/integrations" className="kpi-card"><span>Integrations</span><strong>{finance.data?.integrations ? `${finance.data.integrations.healthy}/${finance.data.integrations.total}` : "—"}</strong><small>{finance.data?.integrations?.degraded ?? 0} degraded</small></Link>
      </div>}
      <div className="work-panels">
        <section className="work-panel" aria-labelledby="action-required">
          <h2 id="action-required">Action required</h2>
          <Link href="/app/spend/requests"><span>Spend requests</span><strong>{finance.data?.pendingRequests ?? "—"}</strong></Link>
          <Link href="/app/bill-pay/bills"><span>Bills for approval</span><strong>{finance.data?.pendingBills ?? "—"}</strong></Link>
          <Link href="/app/travel/requests"><span>Travel pending</span><strong>{finance.data?.travelPending ?? "—"}</strong></Link>
          <Link href="/app/accounting/overview"><span>Accounting review</span><strong>{finance.data?.accountingReview ?? "—"}</strong></Link>
        </section>
        <section className="work-panel" aria-labelledby="freshness">
          <h2 id="freshness">Freshness</h2>
          <p className="muted">Dashboard as of {finance.data?.asOf ? new Date(finance.data.asOf).toLocaleString() : "—"}</p>
          <p className="muted">Budget read model {finance.data?.freshness?.budgetFreshness ? new Date(finance.data.freshness.budgetFreshness).toLocaleString() : "—"}</p>
          <p className="muted">Currency totals are server-calculated; actual and committed budget dollars are not double-counted.</p>
          <Link href="/app/company/integrations">Integration health →</Link>
          <Link href="/app/insights/budgets">Budgets →</Link>
          <Link href="/app/company/audit">Audit log →</Link>
        </section>
      </div>
    </>}
  </div>;
}
