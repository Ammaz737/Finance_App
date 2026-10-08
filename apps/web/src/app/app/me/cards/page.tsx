"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { VirtualCardFace } from "@/components/VirtualCardFace";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { pickPrimaryCard } from "@/lib/card-primary";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type CardRow = {
  id: string;
  fundId?: string;
  last4?: string;
  type?: string;
  status?: string;
  network?: string;
  brand?: string;
  provider?: string;
  stripeCardId?: string | null;
  merchantLock?: string | null;
  holderId?: string;
  createdAt?: string;
};

type MoneyRow = {
  id: string;
  amount: string | number;
  merchant?: string;
  status?: string;
  decision?: string;
  reason?: string;
  authorizedAt?: string;
  createdAt?: string;
};

type CardDetail = {
  card: {
    id: string;
    last4: string;
    type: string;
    status: string;
    network: string;
    provider?: string;
    brand?: string;
    merchantLock: string | null;
    fundId: string;
    holderId: string;
    createdAt: string;
  };
  fund: {
    id: string;
    name: string;
    availableAmount: string | number;
    limitAmount: string | number;
    currency: string;
    status: string;
  } | null;
  holder: { id: string; firstName: string; lastName: string; email: string } | null;
  spendRequest: { id: string; name: string; amount: string | number; currency: string; status: string } | null;
  topUps?: Array<{
    id: string;
    name: string;
    amount: string | number;
    currency: string;
    status: string;
    fulfilledAt: string;
  }>;
  travelTrips?: Array<{
    id: string;
    name: string;
    destination?: string;
    status: string;
    currency?: string;
    estimatedAmount?: string | number | null;
  }>;
  funds?: Array<{
    id: string;
    name: string;
    availableAmount: string | number;
    limitAmount: string | number;
    currency: string;
    status: string;
    isCurrent?: boolean;
    spendRequestId?: string | null;
    travelTrip?: { id: string; name: string; status: string } | null;
  }>;
  activity?: Array<{
    id: string;
    at: string;
    type: string;
    title: string;
    detail: string;
    fundName: string | null;
    amount: string | null;
    currency: string | null;
    status: string | null;
    href: string | null;
  }>;
  controls: {
    merchantLock: string | null;
    allowedMccs: string | null;
    perTransactionLimit: string | null;
    velocityMaxAmount: string | null;
    velocityMaxCount: number | null;
    velocityWindowHours: number;
  };
  totals: { currency: string; available: string; pending: string; cleared: string };
  authorizations: MoneyRow[];
  transactions: MoneyRow[];
};

type TravelWalletRow = {
  id: string;
  last4: string;
  fundId?: string;
  status?: string;
  tripName?: string;
  destination?: string;
  tripStatus?: string;
  available?: string | number;
  currency?: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function MyCardsPage() {
  const session = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const cards = useQuery({ queryKey: ["my-cards"], queryFn: () => api.get<CardRow[]>("/cards") });
  const trips = useQuery({
    queryKey: ["my-travel-funds"],
    queryFn: () =>
      api.get<Array<{
        id: string;
        name?: string;
        destination?: string;
        status?: string;
        fundId?: string | null;
        cardId?: string | null;
        travelerId?: string;
        currency?: string;
        estimatedAmount?: string | number | null;
      }>>("/travel?take=50"),
  });
  const mine = (cards.data ?? []).filter((row) => row.holderId === session?.userId);
  const myTrips = (trips.data ?? []).filter((trip) => !trip.travelerId || trip.travelerId === session?.userId);
  const travelFundIds = [
    ...new Set(myTrips.map((trip) => trip.fundId).filter((id): id is string => Boolean(id))),
  ];
  // Prefer the spend consolidator card; travel uses dedicated temp wallets and must not hide fulfilled spend.
  const primary = pickPrimaryCard(mine, { excludeFundIds: travelFundIds });
  const travelWallets: TravelWalletRow[] = mine
    .filter((row) => row.fundId && travelFundIds.includes(row.fundId))
    .map((row) => {
      const trip = myTrips.find((item) => item.fundId === row.fundId || item.cardId === row.id);
      return {
        id: row.id,
        last4: row.last4 ?? "••••",
        fundId: row.fundId,
        status: row.status,
        tripName: trip?.name,
        destination: trip?.destination,
        tripStatus: trip?.status,
        available: trip?.estimatedAmount ?? undefined,
        currency: trip?.currency ?? "USD",
      };
    });

  const detail = useQuery({
    queryKey: ["my-card-detail", primary?.id],
    queryFn: () => api.get<CardDetail>(`/cards/${primary!.id}`),
    enabled: Boolean(primary?.id),
  });

  const canFreeze = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("card.freeze"),
  );

  const freeze = useMutation({
    mutationFn: () => api.post(`/cards/${primary!.id}/freeze`, {}),
    onSuccess: () => {
      setMessage("Card frozen.");
      void queryClient.invalidateQueries({ queryKey: ["my-card-detail", primary?.id] });
      void queryClient.invalidateQueries({ queryKey: ["my-cards"] });
    },
  });

  const unfreeze = useMutation({
    mutationFn: () => api.post(`/cards/${primary!.id}/unfreeze`, {}),
    onSuccess: () => {
      setMessage("Card unfrozen.");
      void queryClient.invalidateQueries({ queryKey: ["my-card-detail", primary?.id] });
      void queryClient.invalidateQueries({ queryKey: ["my-cards"] });
    },
  });

  const data = detail.data;
  const holderName = data?.holder
    ? `${data.holder.firstName} ${data.holder.lastName}`.trim()
    : session
      ? `${session.user.firstName} ${session.user.lastName}`.trim()
      : "—";
  const currency = data?.totals.currency ?? "USD";
  const canSeeFunds = session
    ? canSeeItem(findNavItem("/app/spend/funds") ?? { href: "/app/spend/funds", permission: "card.read" }, session)
    : false;
  const canSeeQueue = session
    ? canSeeItem(findNavItem("/app/spend/requests") ?? { href: "/app/spend/requests", permission: "spend_request.approve" }, session)
    : false;
  const canCreateSpend = session
    ? canSeeItem(findNavItem("/app/me/requests") ?? { href: "/app/me/requests", permission: "spend_request.create" }, session)
    : false;

  const txnColumns: Column<MoneyRow>[] = [
    {
      key: "authorizedAt",
      header: "When",
      render: (row) =>
        row.authorizedAt || row.createdAt
          ? new Date(row.authorizedAt ?? row.createdAt!).toLocaleString()
          : "—",
    },
    { key: "merchant", header: "Merchant", render: (row) => row.merchant ?? "—" },
    { key: "amount", header: "Amount", render: (row) => money(currency, row.amount) },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={String(row.status ?? row.decision ?? "—")} />,
    },
  ];

  const authColumns: Column<MoneyRow>[] = [
    {
      key: "createdAt",
      header: "When",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"),
    },
    { key: "merchant", header: "Merchant", render: (row) => row.merchant ?? "—" },
    { key: "amount", header: "Amount", render: (row) => money(currency, row.amount) },
    {
      key: "decision",
      header: "Decision",
      render: (row) => <StatusBadge status={String(row.decision ?? "—")} />,
    },
    { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
  ];

  const topUpColumns: Column<NonNullable<CardDetail["topUps"]>[number]>[] = [
    {
      key: "fulfilledAt",
      header: "When",
      render: (row) => new Date(row.fulfilledAt).toLocaleString(),
    },
    { key: "name", header: "Spend request", render: (row) => row.name },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency, row.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const travelWalletColumns: Column<TravelWalletRow>[] = [
    {
      key: "last4",
      header: "Card",
      render: (row) => `•••• ${row.last4}`,
    },
    {
      key: "tripName",
      header: "Trip",
      render: (row) => row.tripName || "Travel wallet",
    },
    {
      key: "destination",
      header: "Destination",
      render: (row) => row.destination || "—",
    },
    {
      key: "tripStatus",
      header: "Trip status",
      render: (row) => (row.tripStatus ? <StatusBadge status={row.tripStatus} /> : "—"),
    },
    {
      key: "status",
      header: "Card status",
      render: (row) => <StatusBadge status={String(row.status ?? "—")} />,
    },
  ];

  const activityColumns: Column<NonNullable<CardDetail["activity"]>[number]>[] = [
    {
      key: "at",
      header: "When",
      render: (row) => new Date(row.at).toLocaleString(),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => <StatusBadge status={row.type} />,
    },
    {
      key: "title",
      header: "Activity",
      render: (row) => (
        <>
          <strong>{row.title}</strong>
          {row.detail ? <div className="muted">{row.detail}</div> : null}
        </>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) =>
        row.amount != null && row.currency ? money(row.currency, row.amount) : "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
    },
  ];

  return (
    <div className="my-cards-page">
      <div className="resource-heading">
        <PageHeader
          title="My card"
          subtitle="Approved spend tops up this wallet (company cash is not moved until card capture). Travel trips use a separate temp wallet."
        />
        {data && canFreeze && (
          <div className="detail-actions-top">
            {data.card.status === "ACTIVE" && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={freeze.isPending}
                onClick={() => {
                  if (window.confirm("Freeze this card?")) freeze.mutate();
                }}
              >
                Freeze
              </button>
            )}
            {data.card.status === "FROZEN" && (
              <button type="button" className="btn" disabled={unfreeze.isPending} onClick={() => unfreeze.mutate()}>
                Unfreeze
              </button>
            )}
          </div>
        )}
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {(freeze.isError || unfreeze.isError) && (
        <p className="error" role="alert">
          {(freeze.error ?? unfreeze.error)?.message}
        </p>
      )}

      {cards.isPending ? (
        <p className="muted">Loading card…</p>
      ) : cards.isError ? (
        <div className="error-panel">
          Could not load card.{" "}
          <button className="text-button" onClick={() => void cards.refetch()}>
            Try again
          </button>
        </div>
      ) : !primary ? (
        <div className="empty-work">
          <strong>No card allocated yet</strong>
          <p>When a spend request is fulfilled as a virtual card for you, it will show up here with full activity.</p>
          <Link className="btn btn-primary" href="/app/me/requests" style={{ marginTop: 14, display: "inline-block" }}>
            My requests
          </Link>
        </div>
      ) : detail.isPending || !data ? (
        <p className="muted">Loading card details…</p>
      ) : detail.isError ? (
        <div className="error-panel">
          Could not load card details.{" "}
          <button className="text-button" onClick={() => void detail.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <div className="my-card-workspace">
          <div className="my-card-info">
            <div className="overview-stat-grid company">
              <article className="overview-stat">
                <span>Status</span>
                <strong>
                  <StatusBadge status={data.card.status} />
                </strong>
                <small>
                  {data.card.type.replaceAll("_", " ")} ·{" "}
                  {(data.card.provider === "stripe"
                    ? "STRIPE"
                    : data.card.network || data.card.brand || "MOCK"
                  ).toUpperCase()}
                </small>
              </article>
              <article className="overview-stat">
                <span>Available</span>
                <strong>{money(currency, data.totals.available)}</strong>
                <small>
                  Limit {data.fund ? money(data.fund.currency, data.fund.limitAmount) : "—"}
                </small>
              </article>
              <article className="overview-stat">
                <span>Pending / cleared</span>
                <strong>
                  {money(currency, data.totals.pending)} · {money(currency, data.totals.cleared)}
                </strong>
                <small>Holds vs captured</small>
              </article>
            </div>

            <div className="detail-grid">
              <section className="panel">
                <h2>Linked records</h2>
                <dl className="detail-list">
                  <div>
                    <dt>Holder</dt>
                    <dd>
                      {holderName}
                      {data.holder?.email ? ` · ${data.holder.email}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Fund</dt>
                    <dd>
                      {data.fund ? (
                        canSeeFunds ? (
                          <Link className="detail-link" href={`/app/spend/funds/${data.fund.id}`}>
                            {data.fund.name}
                          </Link>
                        ) : (
                          data.fund.name
                        )
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Latest spend request</dt>
                    <dd>
                      {data.spendRequest ? (
                        canSeeQueue || canCreateSpend ? (
                          <Link
                            className="detail-link"
                            href={`/app/spend/requests/${data.spendRequest.id}?from=mine`}
                          >
                            {data.spendRequest.name}
                          </Link>
                        ) : (
                          data.spendRequest.name
                        )
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Issued</dt>
                    <dd>{new Date(data.card.createdAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </section>

              <section className="panel">
                <h2>Controls</h2>
                <dl className="detail-list">
                  <div>
                    <dt>Merchant lock</dt>
                    <dd>{data.controls.merchantLock || "Open"}</dd>
                  </div>
                  <div>
                    <dt>Allowed MCCs</dt>
                    <dd>{data.controls.allowedMccs || "Any"}</dd>
                  </div>
                  <div>
                    <dt>Per-txn limit</dt>
                    <dd>
                      {data.controls.perTransactionLimit
                        ? money(currency, data.controls.perTransactionLimit)
                        : "None"}
                    </dd>
                  </div>
                  <div>
                    <dt>Velocity</dt>
                    <dd>
                      {data.controls.velocityMaxCount ?? "—"} tx /{" "}
                      {data.controls.velocityMaxAmount
                        ? money(currency, data.controls.velocityMaxAmount)
                        : "—"}{" "}
                      in {data.controls.velocityWindowHours}h
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            <section className="panel">
              <div className="section-title" style={{ marginTop: 0 }}>
                <h2>Spend top-ups</h2>
                <span>{(data.topUps ?? []).length}</span>
              </div>
              {(data.topUps?.length ?? 0) === 0 ? (
                <p className="muted">No fulfilled spend requests have topped up this card yet.</p>
              ) : (
                <div className="table-wrap">
                  <DataTable
                    rows={data.topUps ?? []}
                    columns={topUpColumns}
                    onRowClick={(row) => router.push(`/app/spend/requests/${row.id}?from=mine`)}
                  />
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-title" style={{ marginTop: 0 }}>
                <h2>Travel wallets</h2>
                <span>{travelWallets.length}</span>
              </div>
              {travelWallets.length === 0 ? (
                <p className="muted">No travel cards yet. Confirmed trips create a separate travel wallet.</p>
              ) : (
                <div className="table-wrap">
                  <DataTable
                    rows={travelWallets}
                    columns={travelWalletColumns}
                    onRowClick={(row) => router.push(`/app/me/cards/${row.id}`)}
                  />
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-title" style={{ marginTop: 0 }}>
                <h2>Card activity</h2>
                <span>{(data.activity ?? []).length}</span>
              </div>
              {(data.activity?.length ?? 0) === 0 ? (
                <p className="muted">No activity recorded on this card yet.</p>
              ) : (
                <div className="table-wrap">
                  <DataTable
                    rows={(data.activity ?? []).slice(0, 40)}
                    columns={activityColumns}
                    onRowClick={(row) => {
                      if (row.href) router.push(row.href);
                    }}
                  />
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-title" style={{ marginTop: 0 }}>
                <h2>Transactions</h2>
                <span>{data.transactions.length}</span>
              </div>
              {data.transactions.length === 0 ? (
                <p className="muted">No transactions yet on this card.</p>
              ) : (
                <div className="table-wrap">
                  <DataTable
                    rows={data.transactions}
                    columns={txnColumns}
                    onRowClick={(row) => router.push(`/app/spend/transactions/${row.id}`)}
                  />
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-title" style={{ marginTop: 0 }}>
                <h2>Authorizations</h2>
                <span>{data.authorizations.length}</span>
              </div>
              {data.authorizations.length === 0 ? (
                <p className="muted">
                  No authorization attempts yet. Ask Finance to run{" "}
                  <strong>Authorize &amp; capture</strong> on the full card workspace, then refresh.
                </p>
              ) : (
                <div className="table-wrap">
                  <DataTable rows={data.authorizations} columns={authColumns} />
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <Link className="detail-link" href={`/app/me/cards/${data.card.id}`}>
                  Full card workspace →
                </Link>
              </div>
            </section>
          </div>

          <aside className="my-card-face-col">
            <VirtualCardFace
              last4={data.card.last4}
              holderName={holderName}
              network={data.card.network}
              brand={data.card.brand}
              provider={data.card.provider}
              type={data.card.type}
              status={data.card.status}
              availableLabel={money(currency, data.totals.available)}
              merchantLock={data.controls.merchantLock}
            />
            <p className="my-card-face-note">
              New approved spend tops up this card. Full freeze / controls live in the card workspace.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
