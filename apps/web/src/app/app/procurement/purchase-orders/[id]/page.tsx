"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  purchaseOrder: {
    id: string; number: string; amount: string | number; receivedAmount: string | number; billedAmount: string | number;
    currency: string; status: string; matchStatus: string; commitmentAmount: string | number;
  };
  lines: Array<{ id: string; description: string; amount: string | number; quantity: string | number }>;
  receiving: Array<{ id: string; amount: string | number; memo: string; createdAt: string }>;
  matches: Array<{ id: string; matchType: string; status: string; variance: string | number; billId: string | null }>;
  request: { id: string; name: string } | null;
  bills: Array<{ id: string; invoiceNumber: string; amount: string | number; status: string }>;
  remainingCommitment?: number;
  timeline?: Array<{ id: string; action: string; createdAt: string }>;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : String(value)}`;
}

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [billId, setBillId] = useState("");

  const detail = useQuery({
    queryKey: ["po-detail", params.id],
    queryFn: () => api.get<Detail>(`/purchase-orders/${params.id}`),
  });

  const receive = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${params.id}/receive`, { amount: receiveAmount }),
    onSuccess: () => {
      setMessage("Receiving recorded.");
      setReceiveAmount("");
      void queryClient.invalidateQueries({ queryKey: ["po-detail", params.id] });
    },
  });

  const match = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${params.id}/match`, { billId }),
    onSuccess: () => {
      setMessage("Match evaluated.");
      setBillId("");
      void queryClient.invalidateQueries({ queryKey: ["po-detail", params.id] });
    },
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load PO. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading purchase order…</p>;

  const { purchaseOrder: po, lines, receiving, matches, request, bills, remainingCommitment, timeline } = detail.data;
  const canReview = session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("procurement.review");
  const selectedBill = bills.find((bill) => bill.id === billId);

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={po.number} subtitle={request?.name ?? "Purchase order"} />
      <Link className="btn btn-ghost" href="/app/procurement/purchase-orders">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {(receive.isError || match.isError) && <p className="error" role="alert">{(receive.error ?? match.error)?.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Commitment</span><strong>{money(po.currency, po.commitmentAmount)}</strong><small><StatusBadge status={po.status} /></small></article>
      <article className="kpi-card"><span>Received</span><strong>{money(po.currency, po.receivedAmount)}</strong><small>vs PO</small></article>
      <article className="kpi-card"><span>Billed</span><strong>{money(po.currency, po.billedAmount)}</strong><small><StatusBadge status={po.matchStatus} /></small></article>
      <article className="kpi-card"><span>Remaining</span><strong>{money(po.currency, remainingCommitment ?? Number(po.commitmentAmount) - Number(po.billedAmount))}</strong><small>Commitment − matched</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Lines</h2>
        <ul className="plain-list">
          {lines.map((line) => <li key={line.id}>{line.description} × {String(line.quantity)} — {money(po.currency, line.amount)}</li>)}
        </ul>
        <h2>Receiving</h2>
        <ul className="plain-list">
          {receiving.map((row) => <li key={row.id}>{money(po.currency, row.amount)} {row.memo ? `· ${row.memo}` : ""}</li>)}
          {!receiving.length && <li className="muted">Nothing received yet.</li>}
        </ul>
        {canReview && ["ISSUED", "OPEN", "PARTIALLY_RECEIVED"].includes(po.status) && <form className="stack-form" onSubmit={(e) => { e.preventDefault(); receive.mutate(); }}>
          <label>Amount<input className="input" value={receiveAmount} onChange={(e) => setReceiveAmount(e.target.value)} required /></label>
          <button className="btn btn-primary" type="submit" disabled={receive.isPending}>Record receipt</button>
        </form>}
      </section>
      <section className="work-panel">
        <h2>Matching</h2>
        <ul className="plain-list">
          {matches.map((row) => <li key={row.id}>{row.matchType} · <StatusBadge status={row.status} /> · variance {String(row.variance)}</li>)}
          {!matches.length && <li className="muted">No match records.</li>}
        </ul>
        <h3>Bills</h3>
        <ul className="plain-list">
          {bills.map((bill) => (
            <li key={bill.id}>
              <button type="button" className="text-button" onClick={() => setBillId(bill.id)}>{bill.invoiceNumber}</button>
              {" "}{money(po.currency, bill.amount)} · <StatusBadge status={bill.status} />
              {" "}· <Link href={`/app/bill-pay/bills/${bill.id}`}>Open</Link>
            </li>
          ))}
          {!bills.length && <li className="muted">Create a bill with this PO, then match.</li>}
        </ul>
        {canReview && <form className="stack-form" onSubmit={(e) => { e.preventDefault(); match.mutate(); }}>
          <p className="muted">{selectedBill ? `Selected: ${selectedBill.invoiceNumber}` : "Select a linked bill above."}</p>
          <button className="btn btn-primary" type="submit" disabled={match.isPending || !billId}>Run 2/3-way match</button>
        </form>}
        {request && <Link className="btn btn-ghost" href={`/app/procurement/requests/${request.id}`}>Open request</Link>}
      </section>
      <section className="work-panel">
        <h2>Activity</h2>
        <ul className="plain-list">
          {(timeline ?? []).map((event) => (
            <li key={event.id}>{event.action} · {new Date(event.createdAt).toLocaleString()}</li>
          ))}
          {!(timeline ?? []).length && <li className="muted">No activity yet.</li>}
        </ul>
      </section>
    </div>
  </div>;
}
