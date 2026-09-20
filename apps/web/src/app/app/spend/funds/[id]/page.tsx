"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DataTable, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { api } from "@/lib/api";

type MoneyRow = { id: string; amount: string | number; currency?: string; merchant?: string; status?: string; decision?: string; reason?: string; authorizedAt?: string; createdAt?: string };
type FundDetail = {
  fund: {
    id: string; name: string; availableAmount: string | number; limitAmount: string | number; currency: string;
    status: string; validFrom: string; validTo: string | null; spendRequestId: string | null; ownerId: string;
  };
  owner: { id: string; firstName: string; lastName: string; email: string } | null;
  card: { id: string; last4: string; status: string; type: string; merchantLock: string | null } | null;
  spendRequest: { id: string; name: string; amount: string | number; currency: string; status: string; purpose: string } | null;
  totals: { currency: string; available: string; limit: string; pending: string; cleared: string };
  transactions: MoneyRow[];
  authorizations: MoneyRow[];
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function FundDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useQuery({
    queryKey: ["fund-detail", params.id],
    queryFn: () => api.get<FundDetail>(`/funds/${params.id}`),
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load fund. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading fund…</p>;

  const data = detail.data;
  const ownerName = data.owner ? `${data.owner.firstName} ${data.owner.lastName}`.trim() : "—";
  const txnColumns: Column<MoneyRow>[] = [
    { key: "authorizedAt", header: "Authorized", render: (row) => row.authorizedAt ? new Date(row.authorizedAt).toLocaleString() : "—" },
    { key: "merchant", header: "Merchant", render: (row) => row.merchant ?? "—" },
    { key: "amount", header: "Amount", render: (row) => money(data.totals.currency, row.amount) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status ?? "—")} /> },
  ];
  const authColumns: Column<MoneyRow>[] = [
    { key: "createdAt", header: "When", render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : "—" },
    { key: "merchant", header: "Merchant", render: (row) => row.merchant ?? "—" },
    { key: "amount", header: "Amount", render: (row) => money(data.totals.currency, row.amount) },
    { key: "decision", header: "Decision", render: (row) => <StatusBadge status={String(row.decision ?? "—")} /> },
    { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
  ];

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={data.fund.name} subtitle={`Owned by ${ownerName}`} />
      <Link className="btn btn-ghost" href="/app/spend/funds">Back to funds</Link>
    </div>

    <div className="kpi-grid">
      <article className="kpi-card"><span>Available</span><strong>{money(data.totals.currency, data.totals.available)}</strong><small>of {money(data.totals.currency, data.totals.limit)} limit</small></article>
      <article className="kpi-card"><span>Pending holds</span><strong>{money(data.totals.currency, data.totals.pending)}</strong><small>Awaiting capture / void</small></article>
      <article className="kpi-card"><span>Cleared</span><strong>{money(data.totals.currency, data.totals.cleared)}</strong><small><StatusBadge status={data.fund.status} /></small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Authority</h2>
        <dl className="detail-list">
          <div><dt>Owner</dt><dd>{ownerName}{data.owner?.email ? ` · ${data.owner.email}` : ""}</dd></div>
          <div><dt>Validity</dt><dd>{new Date(data.fund.validFrom).toLocaleDateString()} → {data.fund.validTo ? new Date(data.fund.validTo).toLocaleDateString() : "Open"}</dd></div>
          <div><dt>Spend request</dt><dd>{data.spendRequest ? `${data.spendRequest.name} · ${money(data.spendRequest.currency, data.spendRequest.amount)} · ${data.spendRequest.status}` : "—"}</dd></div>
          <div><dt>Purpose</dt><dd>{data.spendRequest?.purpose || "—"}</dd></div>
        </dl>
      </section>
      <section className="work-panel">
        <h2>Linked card</h2>
        {data.card ? <dl className="detail-list">
          <div><dt>Card</dt><dd><Link className="detail-link" href={`/app/spend/cards/${data.card.id}`}>···{data.card.last4}</Link></dd></div>
          <div><dt>Type</dt><dd>{data.card.type}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge status={data.card.status} /></dd></div>
          <div><dt>Merchant lock</dt><dd>{data.card.merchantLock || "—"}</dd></div>
        </dl> : <p className="muted">No card issued for this fund (fund-only fulfillment).</p>}
      </section>
    </div>

    <div className="section-title"><h2>Transactions</h2><span>{data.transactions.length} recent</span></div>
    <div className="table-wrap"><DataTable rows={data.transactions} columns={txnColumns} /></div>

    <div className="section-title"><h2>Authorizations</h2><span>{data.authorizations.length} recent</span></div>
    <div className="table-wrap"><DataTable rows={data.authorizations} columns={authColumns} /></div>
  </div>;
}
