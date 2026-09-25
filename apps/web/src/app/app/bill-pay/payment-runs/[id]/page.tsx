"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  run: { id: string; name: string; status: string; createdBy: string; legalEntityId: string; sourceAccountId?: string | null };
  items: Array<{ id: string; billId: string; amount: string | number; currency: string; status: string; createdBy: string; bill?: { invoiceNumber: string } | null }>;
  eligiblePayments: Array<{ id: string; billId: string; amount: string | number; currency: string; status: string; bill?: { invoiceNumber: string } | null }>;
  sourceAccount: { name: string; last4: string; currency: string } | null;
  paymentCount: number;
  total: number;
  validationIssues: string[];
};

export default function PaymentRunDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const detail = useQuery({
    queryKey: ["payment-run-detail", params.id],
    queryFn: () => api.get<Detail>(`/payment-runs/${params.id}`),
  });

  const add = useMutation({
    mutationFn: () => api.post(`/payment-runs/${params.id}/add-payments`, { paymentIds: selectedIds }),
    onSuccess: () => {
      setMessage("Payment added to run.");
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["payment-run-detail", params.id] });
    },
  });

  const remove = useMutation({
    mutationFn: (paymentId: string) => api.post(`/payment-runs/${params.id}/remove-payments`, { paymentIds: [paymentId] }),
    onSuccess: () => {
      setMessage("Payment removed from run.");
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
    {(add.isError || remove.isError || release.isError) && <p className="error" role="alert">{(add.error ?? remove.error ?? release.error)?.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={run.status} /></strong><small>{items.length} payments</small></article>
      <article className="kpi-card"><span>Run total</span><strong>{items[0]?.currency ?? ""} {detail.data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong><small>{detail.data.paymentCount} selected</small></article>
      <article className="kpi-card"><span>Source account</span><strong>{detail.data.sourceAccount?.name ?? "Not selected"}</strong><small>{detail.data.sourceAccount ? `•••• ${detail.data.sourceAccount.last4}` : "Choose when creating a run"}</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Items</h2>
        <ul className="plain-list">
          {items.map((item) => (
            <li key={item.id}>{item.currency} {String(item.amount)} · <StatusBadge status={item.status} /> · bill {item.bill?.invoiceNumber ?? item.billId.slice(0, 8)} {canManage && run.status === "OPEN" && <button className="btn btn-ghost" type="button" disabled={remove.isPending} onClick={() => remove.mutate(item.id)}>Remove</button>}</li>
          ))}
          {!items.length && <li className="muted">No payments in this run.</li>}
        </ul>
        {canManage && run.status === "OPEN" && <form className="stack-form" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <fieldset><legend>Add eligible payments</legend>{detail.data.eligiblePayments.map((payment) => <label className="checkbox" key={payment.id}><input type="checkbox" checked={selectedIds.includes(payment.id)} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, payment.id] : selectedIds.filter((id) => id !== payment.id))} /> {payment.bill?.invoiceNumber ?? payment.billId.slice(0, 8)} · {payment.currency} {String(payment.amount)}</label>)}{!detail.data.eligiblePayments.length && <p className="muted">No unassigned scheduled payments are eligible for this entity.</p>}</fieldset>
          <button className="btn btn-primary" type="submit" disabled={add.isPending || !selectedIds.length}>Add selected payments</button>
        </form>}
        {detail.data.validationIssues.length > 0 && <div className="policy-box"><strong>Remaining validation</strong><ul>{detail.data.validationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
        {canRelease && <button className="btn btn-primary" type="button" disabled={release.isPending || detail.data.validationIssues.length > 0} onClick={() => release.mutate()}>Release run</button>}
      </section>
    </div>
  </div>;
}
