"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { VirtualCardFace } from "@/components/VirtualCardFace";
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
  clearedAt?: string;
};
type CardDetail = {
  card: {
    id: string;
    last4: string;
    type: string;
    status: string;
    network: string;
    brand?: string;
    provider?: string;
    merchantLock: string | null;
    providerRef: string | null;
    stripeCardId?: string | null;
    fundId: string;
    holderId: string;
    legalEntityId: string;
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
  controls: {
    merchantLock: string | null;
    allowedMccs: string | null;
    blockedMccs?: string | null;
    allowedCountries?: string | null;
    blockedCountries?: string | null;
    perTransactionLimit: string | null;
    dailyLimit?: string | null;
    weeklyLimit?: string | null;
    monthlyLimit?: string | null;
    velocityMaxAmount: string | null;
    velocityMaxCount: number | null;
    velocityWindowHours: number;
  };
  issuer?: {
    provider: string;
    sandboxAuthorizeEnabled: boolean;
    sandboxMode?: string;
  };
  totals: { currency: string; available: string; pending: string; cleared: string };
  authorizations: MoneyRow[];
  transactions: MoneyRow[];
  audit: Array<{ id: string; action: string; createdAt: string; objectType: string }>;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [authForm, setAuthForm] = useState({
    amount: "25.00",
    merchant: "Amazon",
    merchantCategory: "software",
    idempotencyKey: "",
  });
  const [controls, setControls] = useState({
    merchantLock: "",
    allowedMccs: "",
    blockedMccs: "",
    allowedCountries: "",
    blockedCountries: "",
    perTransactionLimit: "",
    dailyLimit: "",
    weeklyLimit: "",
    monthlyLimit: "",
    velocityMaxAmount: "",
    velocityMaxCount: "",
    velocityWindowHours: "24",
  });

  const detail = useQuery({
    queryKey: ["card-detail", params.id],
    queryFn: async () => {
      const payload = await api.get<CardDetail>(`/cards/${params.id}`);
      setControls({
        merchantLock: payload.controls.merchantLock ?? "",
        allowedMccs: payload.controls.allowedMccs ?? "",
        blockedMccs: payload.controls.blockedMccs ?? "",
        allowedCountries: payload.controls.allowedCountries ?? "",
        blockedCountries: payload.controls.blockedCountries ?? "",
        perTransactionLimit: payload.controls.perTransactionLimit ?? "",
        dailyLimit: payload.controls.dailyLimit ?? "",
        weeklyLimit: payload.controls.weeklyLimit ?? "",
        monthlyLimit: payload.controls.monthlyLimit ?? "",
        velocityMaxAmount: payload.controls.velocityMaxAmount ?? "",
        velocityMaxCount: payload.controls.velocityMaxCount != null ? String(payload.controls.velocityMaxCount) : "",
        velocityWindowHours: String(payload.controls.velocityWindowHours ?? 24),
      });
      return payload;
    },
  });

  const freeze = useMutation({
    mutationFn: () => api.post(`/cards/${params.id}/freeze`, {}),
    onSuccess: () => {
      setMessage("Card frozen.");
      void queryClient.invalidateQueries({ queryKey: ["card-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "cards"] });
      void queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["corporate-cards-overview"] });
    },
  });

  const unfreeze = useMutation({
    mutationFn: () => api.post(`/cards/${params.id}/unfreeze`, {}),
    onSuccess: () => {
      setMessage("Card unfrozen.");
      void queryClient.invalidateQueries({ queryKey: ["card-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "cards"] });
      void queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["corporate-cards-overview"] });
    },
  });

  const terminate = useMutation({
    mutationFn: () => api.post(`/cards/${params.id}/terminate`, {}),
    onSuccess: () => {
      setMessage("Card terminated.");
      void queryClient.invalidateQueries({ queryKey: ["card-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "cards"] });
      void queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["corporate-cards-overview"] });
    },
  });

  const saveControls = useMutation({
    mutationFn: () =>
      api.post(`/cards/${params.id}/set-controls`, {
        merchantLock: controls.merchantLock || null,
        allowedMccs: controls.allowedMccs || null,
        blockedMccs: controls.blockedMccs || null,
        allowedCountries: controls.allowedCountries || null,
        blockedCountries: controls.blockedCountries || null,
        perTransactionLimit: controls.perTransactionLimit || null,
        dailyLimit: controls.dailyLimit || null,
        weeklyLimit: controls.weeklyLimit || null,
        monthlyLimit: controls.monthlyLimit || null,
        velocityMaxAmount: controls.velocityMaxAmount || null,
        velocityMaxCount: controls.velocityMaxCount ? Number(controls.velocityMaxCount) : null,
        velocityWindowHours: Number(controls.velocityWindowHours || 24),
      }),
    onSuccess: () => {
      setMessage("Card controls updated.");
      void queryClient.invalidateQueries({ queryKey: ["card-detail", params.id] });
    },
  });

  const authorize = useMutation({
    mutationFn: () =>
      api.post("/authorizations", {
        cardId: params.id,
        amount: authForm.amount,
        currency: detail.data?.totals.currency ?? "USD",
        merchant: authForm.merchant,
        merchantCategory: authForm.merchantCategory,
        idempotencyKey: authForm.idempotencyKey || `web-${params.id}-${Date.now()}`,
      }),
    onSuccess: () => {
      setMessage("Sandbox authorization recorded.");
      setAuthForm((prev) => ({ ...prev, idempotencyKey: "" }));
      void queryClient.invalidateQueries({ queryKey: ["card-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "transactions"] });
    },
  });

  const txnAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/transactions/${id}/${action}`, {}),
    onSuccess: (_data, variables) => {
      setMessage(`Transaction ${variables.action} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["card-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "transactions"] });
    },
  });

  const canIssue = Boolean(
    session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("card.issue"),
  );
  const canFreeze = Boolean(
    session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("card.freeze"),
  );
  const data = detail.data;
  const sandboxAuthorizeEnabled = Boolean(data?.issuer?.sandboxAuthorizeEnabled);
  const issuerLabel = data?.card.provider === "stripe"
    ? `Stripe Issuing${data.card.stripeCardId || data.card.providerRef ? ` · ${data.card.stripeCardId ?? data.card.providerRef}` : ""}`
    : sandboxAuthorizeEnabled
      ? "Sandbox / mock issuer"
      : (data?.card.providerRef ?? data?.card.provider ?? "Issuer");

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
      render: (row) => money(data?.totals.currency ?? "USD", row.amount),
    },
    {
      key: "decision",
      header: "Decision",
      render: (row) => <StatusBadge status={String(row.decision ?? "—")} />,
    },
    { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
  ];
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
      render: (row) => money(data?.totals.currency ?? "USD", row.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={String(row.status ?? "—")} />,
    },
    {
      key: "id",
      header: "Actions",
      render: (row) =>
        sandboxAuthorizeEnabled && canIssue ? (
          <div className="inline-actions" onClick={(event) => event.stopPropagation()}>
            {row.status === "PENDING" && (
              <>
                <button
                  type="button"
                  className="text-button"
                  disabled={txnAction.isPending}
                  onClick={() => txnAction.mutate({ id: row.id, action: "capture" })}
                >
                  Capture
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={txnAction.isPending}
                  onClick={() => txnAction.mutate({ id: row.id, action: "void" })}
                >
                  Void
                </button>
              </>
            )}
            {row.status === "CLEARED" && (
              <button
                type="button"
                className="text-button"
                disabled={txnAction.isPending}
                onClick={() => txnAction.mutate({ id: row.id, action: "reverse" })}
              >
                Reverse
              </button>
            )}
          </div>
        ) : (
          "—"
        ),
    },
  ];

  if (detail.isError) {
    return (
      <div className="error-panel">
        Could not load card.{" "}
        <button className="text-button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !data) return <p className="muted">Loading card…</p>;

  const holderName = data.holder ? `${data.holder.firstName} ${data.holder.lastName}`.trim() : "—";
  const isMine = Boolean(session?.userId === data.card.holderId);
  const canSeeCorporateCards = Boolean(
    session &&
      (session.roles.includes("Owner") ||
        session.permissions.includes("*") ||
        session.permissions.includes("card.issue")),
  );
  const canSeeFunds = session
    ? canSeeItem(findNavItem("/app/spend/funds") ?? { href: "/app/spend/funds", permission: "card.read" }, session)
    : false;
  const canSeeQueue = session
    ? canSeeItem(findNavItem("/app/spend/requests") ?? { href: "/app/spend/requests", permission: "spend_request.approve" }, session)
    : false;
  const canCreateSpend = session
    ? canSeeItem(findNavItem("/app/me/requests") ?? { href: "/app/me/requests", permission: "spend_request.create" }, session)
    : false;
  const backHref = pathname.startsWith("/app/me/cards/") || (isMine && !canSeeCorporateCards)
    ? "/app/me/cards"
    : canSeeCorporateCards
      ? "/app/cards"
      : "/app/me/cards";
  const backLabel = backHref === "/app/me/cards" ? "Back to my card" : "Back to cards";
  const spendRequestHref = data.spendRequest
    ? canSeeQueue
      ? `/app/spend/requests/${data.spendRequest.id}?from=queue`
      : canCreateSpend || isMine
        ? `/app/spend/requests/${data.spendRequest.id}?from=mine`
        : null
    : null;

  return (
    <div className="detail-page">
      <div className="resource-heading">
        <PageHeader
          title={`Card ···${data.card.last4}`}
          subtitle={`${data.card.type.replaceAll("_", " ")} · ${data.card.network} · ${holderName}`}
        />
        <div className="detail-actions-top">
          <Link className="btn btn-ghost" href={backHref}>
            {backLabel}
          </Link>
          {canFreeze && data.card.status === "ACTIVE" && (
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
          {canFreeze && data.card.status === "FROZEN" && (
            <button type="button" className="btn" disabled={unfreeze.isPending} onClick={() => unfreeze.mutate()}>
              Unfreeze
            </button>
          )}
          {canFreeze && data.card.status !== "TERMINATED" && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={terminate.isPending}
              onClick={() => {
                if (window.confirm("Terminate this card permanently?")) terminate.mutate();
              }}
            >
              Terminate
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {(freeze.isError ||
        unfreeze.isError ||
        terminate.isError ||
        saveControls.isError ||
        authorize.isError ||
        txnAction.isError) && (
        <p className="error" role="alert">
          {
            (freeze.error ?? unfreeze.error ?? terminate.error ?? saveControls.error ?? authorize.error ?? txnAction.error)
              ?.message
          }
        </p>
      )}

      <div className="card-detail-hero">
        <VirtualCardFace
          last4={data.card.last4}
          holderName={holderName}
          network={data.card.network}
          brand={data.card.brand}
          provider={data.card.provider}
          type={data.card.type}
          status={data.card.status}
          availableLabel={money(data.totals.currency, data.totals.available)}
          merchantLock={data.controls.merchantLock}
        />
        <div className="card-detail-side">
          <div className="overview-stat-grid company">
            <article className="overview-stat">
              <span>Status</span>
              <strong>
                <StatusBadge status={data.card.status} />
              </strong>
              <small>{issuerLabel}</small>
            </article>
            <article className="overview-stat">
              <span>Available</span>
              <strong>{money(data.totals.currency, data.totals.available)}</strong>
              <small>Fund {data.fund?.name ?? "—"}</small>
            </article>
            <article className="overview-stat">
              <span>Pending / cleared</span>
              <strong>
                {money(data.totals.currency, data.totals.pending)} · {money(data.totals.currency, data.totals.cleared)}
              </strong>
              <small>Holds vs captured</small>
            </article>
          </div>
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
                <dt>Spend request</dt>
                <dd>
                  {data.spendRequest ? (
                    spendRequestHref ? (
                      <Link className="detail-link" href={spendRequestHref}>
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
                <dt>Created</dt>
                <dd>{new Date(data.card.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Controls</h2>
          {canIssue ? (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveControls.mutate();
              }}
            >
              <label>
                Merchant lock
                <input
                  className="input"
                  value={controls.merchantLock}
                  onChange={(e) => setControls({ ...controls, merchantLock: e.target.value })}
                />
              </label>
              <label>
                Allowed categories (comma-separated)
                <input
                  className="input"
                  value={controls.allowedMccs}
                  onChange={(e) => setControls({ ...controls, allowedMccs: e.target.value })}
                  placeholder="software,office"
                />
                <span className="muted" style={{ display: "block", marginTop: 4, fontSize: "0.85rem" }}>
                  Aliases work in Stripe mode: software, saas, office, grocery, meals, airlines, hotels.
                  Or use Stripe enums such as computer_software_stores.
                </span>
              </label>
              <label>
                Blocked categories
                <input
                  className="input"
                  value={controls.blockedMccs}
                  onChange={(e) => setControls({ ...controls, blockedMccs: e.target.value })}
                  placeholder="grocery,betting_casino_gambling"
                />
              </label>
              <label>
                Allowed countries
                <input
                  className="input"
                  value={controls.allowedCountries}
                  onChange={(e) => setControls({ ...controls, allowedCountries: e.target.value })}
                  placeholder="US,CA"
                />
              </label>
              <label>
                Blocked countries
                <input
                  className="input"
                  value={controls.blockedCountries}
                  onChange={(e) => setControls({ ...controls, blockedCountries: e.target.value })}
                />
              </label>
              <label>
                Per-transaction limit
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={controls.perTransactionLimit}
                  onChange={(e) => setControls({ ...controls, perTransactionLimit: e.target.value })}
                />
              </label>
              <label>
                Daily / weekly / monthly limits
                <div className="inline-actions">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="Daily"
                    value={controls.dailyLimit}
                    onChange={(e) => setControls({ ...controls, dailyLimit: e.target.value })}
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="Weekly"
                    value={controls.weeklyLimit}
                    onChange={(e) => setControls({ ...controls, weeklyLimit: e.target.value })}
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="Monthly"
                    value={controls.monthlyLimit}
                    onChange={(e) => setControls({ ...controls, monthlyLimit: e.target.value })}
                  />
                </div>
              </label>
              <label>
                Velocity max amount
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={controls.velocityMaxAmount}
                  onChange={(e) => setControls({ ...controls, velocityMaxAmount: e.target.value })}
                />
              </label>
              <label>
                Velocity max count
                <input
                  className="input"
                  type="number"
                  value={controls.velocityMaxCount}
                  onChange={(e) => setControls({ ...controls, velocityMaxCount: e.target.value })}
                />
              </label>
              <label>
                Velocity window (hours)
                <input
                  className="input"
                  type="number"
                  value={controls.velocityWindowHours}
                  onChange={(e) => setControls({ ...controls, velocityWindowHours: e.target.value })}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={saveControls.isPending}>
                {saveControls.isPending ? "Saving…" : "Save controls"}
              </button>
            </form>
          ) : (
            <dl className="detail-list">
              <div>
                <dt>Merchant lock</dt>
                <dd>{data.controls.merchantLock || "—"}</dd>
              </div>
              <div>
                <dt>Allowed MCCs</dt>
                <dd>{data.controls.allowedMccs || "—"}</dd>
              </div>
              <div>
                <dt>Per-txn limit</dt>
                <dd>{data.controls.perTransactionLimit || "—"}</dd>
              </div>
              <div>
                <dt>Velocity</dt>
                <dd>
                  {data.controls.velocityMaxCount ?? "—"} tx / {data.controls.velocityMaxAmount ?? "—"} in{" "}
                  {data.controls.velocityWindowHours}h
                </dd>
              </div>
            </dl>
          )}
        </section>

        {sandboxAuthorizeEnabled && canIssue && data.card.status === "ACTIVE" ? (
          <section className="panel">
            <h2>{data.issuer?.sandboxMode === "stripe_test_helpers" ? "Stripe test spend" : "Sandbox authorize"}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {data.issuer?.sandboxMode === "stripe_test_helpers"
                ? "Creates a real Stripe Issuing force-capture (Financial Account is debited) and records it under Authorizations / Transactions."
                : "Records a mock authorization hold. Capture it from the transactions table."}
            </p>
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                authorize.mutate();
              }}
            >
              <label>
                Amount
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  required
                  value={authForm.amount}
                  onChange={(e) => setAuthForm({ ...authForm, amount: e.target.value })}
                />
              </label>
              <label>
                Merchant
                <input
                  className="input"
                  required
                  value={authForm.merchant}
                  onChange={(e) => setAuthForm({ ...authForm, merchant: e.target.value })}
                />
              </label>
              <label>
                Merchant category
                <input
                  className="input"
                  required
                  value={authForm.merchantCategory}
                  onChange={(e) => setAuthForm({ ...authForm, merchantCategory: e.target.value })}
                  placeholder="software or computer_software_stores"
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={authorize.isPending}>
                {authorize.isPending
                  ? "Authorizing…"
                  : data.issuer?.sandboxMode === "stripe_test_helpers"
                    ? "Authorize & capture"
                    : "Authorize"}
              </button>
            </form>
          </section>
        ) : (
          <section className="panel">
            <h2>Spend limits</h2>
            <dl className="detail-list">
              <div>
                <dt>Fund limit</dt>
                <dd>{data.fund ? money(data.fund.currency, data.fund.limitAmount) : "—"}</dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>{money(data.totals.currency, data.totals.available)}</dd>
              </div>
              <div>
                <dt>Merchant lock</dt>
                <dd>{data.controls.merchantLock || "Open"}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>

      <section className="panel">
        <div className="section-title" style={{ marginTop: 0 }}>
          <h2>Authorizations</h2>
          <span>{data.authorizations.length} recent</span>
        </div>
        <div className="table-wrap">
          <DataTable rows={data.authorizations} columns={authColumns} />
        </div>
      </section>

      <section className="panel">
        <div className="section-title" style={{ marginTop: 0 }}>
          <h2>Transactions</h2>
          <span>{data.transactions.length} recent</span>
        </div>
        <div className="table-wrap">
          <DataTable
            rows={data.transactions}
            columns={txnColumns}
            onRowClick={(row) => router.push(`/app/spend/transactions/${row.id}`)}
          />
        </div>
      </section>

      {data.audit.length > 0 && (
        <section className="panel">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h2>Activity</h2>
            <span>{data.audit.length}</span>
          </div>
          <div className="timeline">
            {data.audit.map((item) => (
              <div key={item.id} className="timeline-item">
                <strong>{item.action}</strong> · {item.objectType}
                <div className="muted">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
