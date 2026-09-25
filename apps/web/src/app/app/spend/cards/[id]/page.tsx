"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type MoneyRow = { id: string; amount: string | number; currency?: string; merchant?: string; status?: string; decision?: string; reason?: string; authorizedAt?: string; createdAt?: string; clearedAt?: string };
type CardDetail = {
  card: {
    id: string; last4: string; type: string; status: string; network: string; merchantLock: string | null;
    providerRef: string | null; fundId: string; holderId: string; legalEntityId: string; createdAt: string;
  };
  fund: { id: string; name: string; availableAmount: string | number; limitAmount: string | number; currency: string; status: string } | null;
  holder: { id: string; firstName: string; lastName: string; email: string } | null;
  spendRequest: { id: string; name: string; amount: string | number; currency: string; status: string } | null;
  controls: {
    merchantLock: string | null; allowedMccs: string | null; perTransactionLimit: string | null;
    velocityMaxAmount: string | null; velocityMaxCount: number | null; velocityWindowHours: number;
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
  const sandbox = process.env.NODE_ENV !== "production";
  const [message, setMessage] = useState("");
  const [authForm, setAuthForm] = useState({ amount: "25.00", merchant: "Amazon", merchantCategory: "software", idempotencyKey: "" });
  const [controls, setControls] = useState({ merchantLock: "", allowedMccs: "", perTransactionLimit: "", velocityMaxAmount: "", velocityMaxCount: "", velocityWindowHours: "24" });

  const detail = useQuery({
    queryKey: ["card-detail", params.id],
    queryFn: async () => {
      const payload = await api.get<CardDetail>(`/cards/${params.id}`);
      setControls({
        merchantLock: payload.controls.merchantLock ?? "",
        allowedMccs: payload.controls.allowedMccs ?? "",
        perTransactionLimit: payload.controls.perTransactionLimit ?? "",
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
    },
  });

  const unfreeze = useMutation({
    mutationFn: () => api.post(`/cards/${params.id}/unfreeze`, {}),
    onSuccess: () => {
      setMessage("Card unfrozen.");
      void queryClient.invalidateQueries({ queryKey: ["card-detail", params.id] });
    },
  });

  const terminate = useMutation({
    mutationFn: () => api.post(`/cards/${params.id}/terminate`, {}),
    onSuccess: () => {
      setMessage("Card terminated.");
      void queryClient.invalidateQueries({ queryKey: ["card-detail", params.id] });
    },
  });

  const saveControls = useMutation({
    mutationFn: () => api.post(`/cards/${params.id}/set-controls`, {
      merchantLock: controls.merchantLock || null,
      allowedMccs: controls.allowedMccs || null,
      perTransactionLimit: controls.perTransactionLimit || null,
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
    mutationFn: () => api.post("/authorizations", {
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

  const canIssue = Boolean(session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("card.issue"));
  const canFreeze = Boolean(session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("card.freeze"));
  const data = detail.data;

  const authColumns: Column<MoneyRow>[] = [
    { key: "createdAt", header: "When", render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : "—" },
    { key: "merchant", header: "Merchant", render: (row) => row.merchant ?? "—" },
    { key: "amount", header: "Amount", render: (row) => money(data?.totals.currency ?? "USD", row.amount) },
    { key: "decision", header: "Decision", render: (row) => <StatusBadge status={String(row.decision ?? "—")} /> },
    { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
  ];
  const txnColumns: Column<MoneyRow>[] = [
    { key: "authorizedAt", header: "Authorized", render: (row) => row.authorizedAt ? new Date(row.authorizedAt).toLocaleString() : "—" },
    { key: "merchant", header: "Merchant", render: (row) => row.merchant ?? "—" },
    { key: "amount", header: "Amount", render: (row) => money(data?.totals.currency ?? "USD", row.amount) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status ?? "—")} /> },
    { key: "id", header: "Actions", render: (row) => sandbox && canIssue ? <div className="inline-actions" onClick={(event) => event.stopPropagation()}>
      {row.status === "PENDING" && <>
        <button type="button" className="text-button" disabled={txnAction.isPending} onClick={() => txnAction.mutate({ id: row.id, action: "capture" })}>Capture</button>
        <button type="button" className="text-button" disabled={txnAction.isPending} onClick={() => txnAction.mutate({ id: row.id, action: "void" })}>Void</button>
      </>}
      {row.status === "CLEARED" && <button type="button" className="text-button" disabled={txnAction.isPending} onClick={() => txnAction.mutate({ id: row.id, action: "reverse" })}>Reverse</button>}
    </div> : "—" },
  ];

  if (detail.isError) {
    return <div className="error-panel">Could not load card. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !data) return <p className="muted">Loading card…</p>;

  const holderName = data.holder ? `${data.holder.firstName} ${data.holder.lastName}`.trim() : "—";
  const backHref = pathname.startsWith("/app/me/cards/") ? "/app/me/cards" : "/app/cards";

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={`Card ···${data.card.last4}`} subtitle={`${data.card.type} · ${data.card.network} · ${holderName}`} />
      <div className="detail-actions-top">
        <Link className="btn btn-ghost" href={backHref}>Back to cards</Link>
        {canFreeze && data.card.status === "ACTIVE" && <button type="button" className="btn btn-danger" disabled={freeze.isPending} onClick={() => { if (window.confirm("Freeze this card?")) freeze.mutate(); }}>Freeze</button>}
        {canFreeze && data.card.status === "FROZEN" && <button type="button" className="btn" disabled={unfreeze.isPending} onClick={() => unfreeze.mutate()}>Unfreeze</button>}
        {canFreeze && data.card.status !== "TERMINATED" && <button type="button" className="btn btn-danger" disabled={terminate.isPending} onClick={() => { if (window.confirm("Terminate this card permanently?")) terminate.mutate(); }}>Terminate</button>}
      </div>
    </div>

    {message && <p className="notice" role="status">{message}</p>}
    {(freeze.isError || unfreeze.isError || terminate.isError || saveControls.isError || authorize.isError || txnAction.isError) && (
      <p className="error" role="alert">{(freeze.error ?? unfreeze.error ?? terminate.error ?? saveControls.error ?? authorize.error ?? txnAction.error)?.message}</p>
    )}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={data.card.status} /></strong><small>{sandbox ? "SANDBOX / MOCK CARD" : (data.card.providerRef ?? "No provider ref")}</small></article>
      <article className="kpi-card"><span>Available</span><strong>{money(data.totals.currency, data.totals.available)}</strong><small>Fund {data.fund?.name ?? "—"}</small></article>
      <article className="kpi-card"><span>Pending / cleared</span><strong>{money(data.totals.currency, data.totals.pending)} · {money(data.totals.currency, data.totals.cleared)}</strong><small>Holds vs captured</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Linked records</h2>
        <dl className="detail-list">
          <div><dt>Holder</dt><dd>{holderName}{data.holder?.email ? ` · ${data.holder.email}` : ""}</dd></div>
          <div><dt>Fund</dt><dd>{data.fund ? <Link className="detail-link" href={`/app/spend/funds/${data.fund.id}`}>{data.fund.name}</Link> : "—"}</dd></div>
          <div><dt>Spend request</dt><dd>{data.spendRequest ? <Link className="detail-link" href={`/app/spend/requests/${data.spendRequest.id}`}>{data.spendRequest.name}</Link> : "—"}</dd></div>
          <div><dt>Created</dt><dd>{new Date(data.card.createdAt).toLocaleString()}</dd></div>
        </dl>
      </section>
      <section className="work-panel">
        <h2>Controls</h2>
        {canIssue ? <form className="record-form" onSubmit={(event) => { event.preventDefault(); saveControls.mutate(); }}>
          <label>Merchant lock<input className="input" value={controls.merchantLock} onChange={(e) => setControls({ ...controls, merchantLock: e.target.value })} /></label>
          <label>Allowed MCCs (comma-separated)<input className="input" value={controls.allowedMccs} onChange={(e) => setControls({ ...controls, allowedMccs: e.target.value })} placeholder="software,office" /></label>
          <label>Per-transaction limit<input className="input" type="number" step="0.01" value={controls.perTransactionLimit} onChange={(e) => setControls({ ...controls, perTransactionLimit: e.target.value })} /></label>
          <label>Velocity max amount<input className="input" type="number" step="0.01" value={controls.velocityMaxAmount} onChange={(e) => setControls({ ...controls, velocityMaxAmount: e.target.value })} /></label>
          <label>Velocity max count<input className="input" type="number" value={controls.velocityMaxCount} onChange={(e) => setControls({ ...controls, velocityMaxCount: e.target.value })} /></label>
          <label>Velocity window (hours)<input className="input" type="number" value={controls.velocityWindowHours} onChange={(e) => setControls({ ...controls, velocityWindowHours: e.target.value })} /></label>
          <button className="btn btn-primary" type="submit" disabled={saveControls.isPending}>{saveControls.isPending ? "Saving…" : "Save controls"}</button>
        </form> : <dl className="detail-list">
          <div><dt>Merchant lock</dt><dd>{data.controls.merchantLock || "—"}</dd></div>
          <div><dt>Allowed MCCs</dt><dd>{data.controls.allowedMccs || "—"}</dd></div>
          <div><dt>Per-txn limit</dt><dd>{data.controls.perTransactionLimit || "—"}</dd></div>
          <div><dt>Velocity</dt><dd>{data.controls.velocityMaxCount ?? "—"} tx / {data.controls.velocityMaxAmount ?? "—"} in {data.controls.velocityWindowHours}h</dd></div>
        </dl>}
      </section>
    </div>

    {sandbox && canIssue && data.card.status === "ACTIVE" && <section className="settings-card">
      <h2>Sandbox authorize</h2>
      <form className="record-form" onSubmit={(event) => { event.preventDefault(); authorize.mutate(); }}>
        <label>Amount<input className="input" type="number" step="0.01" required value={authForm.amount} onChange={(e) => setAuthForm({ ...authForm, amount: e.target.value })} /></label>
        <label>Merchant<input className="input" required value={authForm.merchant} onChange={(e) => setAuthForm({ ...authForm, merchant: e.target.value })} /></label>
        <label>Merchant category<input className="input" required value={authForm.merchantCategory} onChange={(e) => setAuthForm({ ...authForm, merchantCategory: e.target.value })} /></label>
        <button className="btn btn-primary" type="submit" disabled={authorize.isPending}>{authorize.isPending ? "Authorizing…" : "Authorize"}</button>
      </form>
    </section>}

    <div className="section-title"><h2>Authorizations</h2><span>{data.authorizations.length} recent</span></div>
    <div className="table-wrap"><DataTable rows={data.authorizations} columns={authColumns} /></div>

    <div className="section-title"><h2>Transactions</h2><span>{data.transactions.length} recent</span></div>
    <div className="table-wrap"><DataTable rows={data.transactions} columns={txnColumns} onRowClick={(row) => router.push(`/app/spend/transactions`)} /></div>

    {data.audit.length > 0 && <>
      <div className="section-title"><h2>Activity</h2><span>{data.audit.length}</span></div>
      <div className="timeline">{data.audit.map((item) => (
        <div key={item.id} className="timeline-item"><strong>{item.action}</strong> · {item.objectType}<div className="muted">{new Date(item.createdAt).toLocaleString()}</div></div>
      ))}</div>
    </>}
  </div>;
}
