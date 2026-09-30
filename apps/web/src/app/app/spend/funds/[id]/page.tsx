"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DataTable, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type MoneyRow = {
  id: string;
  amount: string | number;
  currency?: string;
  merchant?: string;
  status?: string;
  decision?: string;
  reason?: string;
  authorizedAt?: string;
  createdAt?: string;
};

type FundDetail = {
  fund: {
    id: string;
    name: string;
    availableAmount: string | number;
    limitAmount: string | number;
    currency: string;
    status: string;
    validFrom: string;
    validTo: string | null;
    spendRequestId: string | null;
    ownerId: string;
  };
  owner: { id: string; firstName: string; lastName: string; email: string } | null;
  card: { id: string; last4: string; status: string; type: string; merchantLock: string | null; holderId?: string; fundId?: string } | null;
  cardLink?: "FUND" | "HOLDER" | null;
  spendRequest: { id: string; name: string; amount: string | number; currency: string; status: string; purpose: string } | null;
  totals: { currency: string; available: string; limit: string; pending: string; cleared: string };
  transactions: MoneyRow[];
  authorizations: MoneyRow[];
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

function remainingPct(available: string | number, limit: string | number) {
  const avail = Number(available);
  const lim = Number(limit);
  if (!Number.isFinite(lim) || lim <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((avail / lim) * 100)));
}

export default function FundDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const detail = useQuery({
    queryKey: ["fund-detail", params.id],
    queryFn: () => api.get<FundDetail>(`/funds/${params.id}`),
  });

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load fund.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading fund…</p>;

  const data = detail.data;
  const ownerName = data.owner ? `${data.owner.firstName} ${data.owner.lastName}`.trim() : "—";
  const isMine = Boolean(session?.userId && session.userId === data.fund.ownerId);
  const canSeeCorporateCards = session
    ? canSeeItem(findNavItem("/app/cards") ?? { href: "/app/cards", permission: "card.issue" }, session)
    : false;
  const canSeeFundsList = session
    ? canSeeItem(findNavItem("/app/spend/funds") ?? { href: "/app/spend/funds", permission: "card.read" }, session)
    : false;
  const canSeeQueue = session
    ? canSeeItem(findNavItem("/app/spend/requests") ?? { href: "/app/spend/requests", permission: "spend_request.approve" }, session)
    : false;
  const canCreateSpend = session
    ? canSeeItem(findNavItem("/app/me/requests") ?? { href: "/app/me/requests", permission: "spend_request.create" }, session)
    : false;
  const canSeeTransactions = session
    ? canSeeItem(
        findNavItem("/app/spend/transactions") ?? {
          href: "/app/spend/transactions",
          permissions: ["expense.read", "card.read"],
        },
        session,
      )
    : false;

  const backHref = canSeeFundsList ? "/app/spend/funds" : isMine ? "/app/me/cards" : "/app/home";
  const backLabel =
    backHref === "/app/spend/funds" ? "Back to funds" : backHref === "/app/me/cards" ? "Back to my card" : "Back to overview";

  const cardHref = data.card
    ? isMine || !canSeeCorporateCards
      ? `/app/me/cards/${data.card.id}`
      : `/app/cards/${data.card.id}`
    : null;

  const spendRequestHref = data.spendRequest
    ? canSeeQueue
      ? `/app/spend/requests/${data.spendRequest.id}?from=queue`
      : canCreateSpend || isMine
        ? `/app/spend/requests/${data.spendRequest.id}?from=mine`
        : null
    : null;

  const pct = remainingPct(data.totals.available, data.totals.limit);

  const txnColumns: Column<MoneyRow>[] = [
    {
      key: "authorizedAt",
      header: "Authorized",
      render: (row) => (row.authorizedAt ? new Date(row.authorizedAt).toLocaleString() : "—"),
    },
    { key: "merchant", header: "Merchant", render: (row) => row.merchant ?? "—" },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(data.totals.currency, row.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={String(row.status ?? "—")} />,
    },
  ];
  const authColumns: Column<MoneyRow>[] = [
    {
      key: "createdAt",
      header: "When",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"),
    },
    { key: "merchant", header: "Merchant", render: (row) => row.merchant ?? "—" },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(data.totals.currency, row.amount),
    },
    {
      key: "decision",
      header: "Decision",
      render: (row) => <StatusBadge status={String(row.decision ?? "—")} />,
    },
    { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
  ];

  return (
    <div className="spend-detail fund-detail-page">
      <div className="resource-heading">
        <PageHeader title={data.fund.name} subtitle={`Owned by ${ownerName}`} />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <span>Available</span>
          <strong>{money(data.totals.currency, data.totals.available)}</strong>
          <small>
            of {money(data.totals.currency, data.totals.limit)} limit
            {pct != null ? ` · ${pct}% left` : ""}
          </small>
        </article>
        <article className="kpi-card">
          <span>Pending holds</span>
          <strong>{money(data.totals.currency, data.totals.pending)}</strong>
          <small>Awaiting capture / void</small>
        </article>
        <article className="kpi-card">
          <span>Cleared</span>
          <strong>{money(data.totals.currency, data.totals.cleared)}</strong>
          <small>
            <StatusBadge status={data.fund.status} />
          </small>
        </article>
      </div>

      <div className="work-panels">
        <section className="work-panel">
          <h2>Authority</h2>
          <dl className="detail-list">
            <div>
              <dt>Owner</dt>
              <dd>
                {ownerName}
                {data.owner?.email ? ` · ${data.owner.email}` : ""}
              </dd>
            </div>
            <div>
              <dt>Validity</dt>
              <dd>
                {new Date(data.fund.validFrom).toLocaleDateString()} →{" "}
                {data.fund.validTo ? new Date(data.fund.validTo).toLocaleDateString() : "Open"}
              </dd>
            </div>
            <div>
              <dt>Spend request</dt>
              <dd>
                {data.spendRequest ? (
                  <>
                    {spendRequestHref ? (
                      <Link className="detail-link" href={spendRequestHref}>
                        {data.spendRequest.name}
                      </Link>
                    ) : (
                      data.spendRequest.name
                    )}{" "}
                    · {money(data.spendRequest.currency, data.spendRequest.amount)} ·{" "}
                    <StatusBadge status={data.spendRequest.status} />
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Purpose</dt>
              <dd>{data.spendRequest?.purpose || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="work-panel">
          <h2>Linked card</h2>
          {data.card ? (
            <>
              <dl className="detail-list">
                <div>
                  <dt>Card</dt>
                  <dd>
                    {cardHref ? (
                      <Link className="detail-link" href={cardHref}>
                        ····{data.card.last4}
                      </Link>
                    ) : (
                      `····${data.card.last4}`
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{data.card.type.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusBadge status={data.card.status} />
                  </dd>
                </div>
                <div>
                  <dt>Merchant lock</dt>
                  <dd>{data.card.merchantLock || "—"}</dd>
                </div>
              </dl>
              {data.cardLink === "HOLDER" && (
                <p className="muted" style={{ marginTop: 12 }}>
                  This request fund topped up the holder’s live card wallet. Spend activity may appear on the live card
                  fund.
                </p>
              )}
            </>
          ) : (
            <p className="muted">No card issued for this fund (fund-only fulfillment).</p>
          )}
        </section>
      </div>

      <div className="section-title">
        <h2>Transactions</h2>
        <span>{data.transactions.length} recent</span>
      </div>
      {data.transactions.length ? (
        <div className="table-wrap">
          <DataTable
            rows={data.transactions}
            columns={txnColumns}
            onRowClick={
              canSeeTransactions
                ? (row) => router.push(`/app/spend/transactions/${row.id}`)
                : undefined
            }
          />
        </div>
      ) : (
        <p className="muted">No transactions on this fund yet.</p>
      )}

      <div className="section-title">
        <h2>Authorizations</h2>
        <span>{data.authorizations.length} recent</span>
      </div>
      {data.authorizations.length ? (
        <div className="table-wrap">
          <DataTable rows={data.authorizations} columns={authColumns} />
        </div>
      ) : (
        <p className="muted">No authorizations on this fund yet.</p>
      )}
    </div>
  );
}
