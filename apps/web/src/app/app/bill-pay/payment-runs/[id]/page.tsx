"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  run: { id: string; name: string; status: string; createdBy: string; legalEntityId: string };
  items: Array<{ id: string; billId: string; amount: string | number; currency: string; status: string; createdBy: string }>;
};

export default function PaymentRunDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [paymentId, setPaymentId] = useState("");

  const detail = useQuery({
    queryKey: ["payment-run-detail", params.id],
    queryFn: () => api.get<Detail>(`/payment-runs/${params.id}`),
  });

  const add = useMutation({
    mutationFn: () => api.post(`/payment-runs/${params.id}/add-payments`, { paymentIds: [paymentId] }),
    onSuccess: () => {
      setMessage("Payment added to run.");
      setPaymentId("");
      void queryClient.invalidateQueries({ queryKey: ["payment-run-detail", params.id] });
    },
  });

  const release = useMutation({
    mutationFn: () => api.post(`/payment-runs/${params.id}/release`, {}),
    onSuccess: () => {
      setMessage("Run released. Each payment is now PROCESSING.");
      void queryClient.invalidateQueries({ queryKey: ["payment-run-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "payments"] });
    },
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load payment run. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading payment run…</p>;

  const { run, items } = detail.data;
  const canManage = session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("payment_run.manage");
  const canRelease = canManage && run.status === "OPEN" && session?.userId !== run.createdBy;

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={run.name} subtitle="Batch release gate — creator cannot release" />
      <Link className="btn btn-ghost" href="/app/bill-pay/payment-runs">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {(add.isError || release.isError) && <p className="error" role="alert">{(add.error ?? release.error)?.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={run.status} /></strong><small>{items.length} payments</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Items</h2>
        <ul className="plain-list">
          {items.map((item) => (
            <li key={item.id}>{item.currency} {String(item.amount)} · <StatusBadge status={item.status} /> · bill {item.billId.slice(0, 8)}</li>
          ))}
          {!items.length && <li className="muted">No payments in this run.</li>}
        </ul>
        {canManage && run.status === "OPEN" && <form className="stack-form" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <label>Scheduled payment id<input className="input" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} required /></label>
          <button className="btn btn-primary" type="submit" disabled={add.isPending}>Add payment</button>
        </form>}
        {canRelease && <button className="btn btn-primary" type="button" disabled={release.isPending} onClick={() => release.mutate()}>Release run</button>}
      </section>
    </div>
  </div>;
}
