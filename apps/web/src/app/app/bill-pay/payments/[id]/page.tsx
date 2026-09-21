"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  payment: {
    id: string; amount: string | number; currency: string; rail: string; status: string;
    providerRef: string | null; settlementId: string | null; failureReason: string | null;
    createdBy: string; releasedBy: string | null;
  };
  bill: { id: string; invoiceNumber: string; remainingAmount: string | number; status: string } | null;
  vendor: { id: string; name: string; paymentStatus: string } | null;
  accounting: { id: string; status: string } | null;
  creator?: { firstName: string; lastName: string } | null;
  releaser?: { firstName: string; lastName: string } | null;
  timeline?: Array<{ action: string; createdAt: string }>;
  sandbox?: boolean;
  providerLabel?: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const sandbox = process.env.NODE_ENV !== "production";

  const detail = useQuery({
    queryKey: ["payment-detail", params.id],
    queryFn: () => api.get<Detail>(`/payments/${params.id}`),
  });

  const action = useMutation({
    mutationFn: (name: string) => api.post(`/payments/${params.id}/${name}`, {}),
    onSuccess: (_data, name) => {
      setMessage(`Payment ${name} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["payment-detail", params.id] });
    },
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load payment. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading payment…</p>;

  const { payment, bill, vendor, accounting, timeline, creator, releaser, providerLabel } = detail.data;
  const canRelease = (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("payment.release"))
    && payment.status === "SCHEDULED"
    && session?.userId !== payment.createdBy;

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={money(payment.currency, payment.amount)} subtitle={`${payment.rail} · ${providerLabel ?? "Payment"}`} />
      <Link className="btn btn-ghost" href="/app/bill-pay/payments">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {action.isError && <p className="error" role="alert">{action.error.message}</p>}
    {detail.data.sandbox && <p className="muted">SANDBOX / MOCK PAYMENT</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={payment.status} /></strong><small>{payment.failureReason || "—"}</small></article>
      <article className="kpi-card"><span>Bill</span><strong>{bill ? <Link href={`/app/bill-pay/bills/${bill.id}`}>{bill.invoiceNumber}</Link> : "—"}</strong><small>{bill ? <StatusBadge status={bill.status} /> : null}</small></article>
      <article className="kpi-card"><span>Vendor</span><strong>{vendor?.name ?? "—"}</strong><small>{vendor?.paymentStatus ?? ""}</small></article>
      <article className="kpi-card"><span>Accounting</span><strong>{accounting ? <StatusBadge status={accounting.status} /> : "—"}</strong><small>PAYMENT source</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Release</h2>
        <p className="muted">Created by {creator ? `${creator.firstName} ${creator.lastName}` : "—"} · Released by {releaser ? `${releaser.firstName} ${releaser.lastName}` : "—"}</p>
        <p className="muted">Provider ref {payment.providerRef ?? "—"} · Settlement {payment.settlementId ?? "—"}</p>
        <div className="detail-actions">
          {canRelease && <button className="btn btn-primary" type="button" disabled={action.isPending} onClick={() => action.mutate("release")}>Release payment</button>}
          {sandbox && payment.status === "PROCESSING" && (
            <button className="btn btn-ghost" type="button" disabled={action.isPending} onClick={() => action.mutate("confirm-settlement")}>Confirm settlement</button>
          )}
        </div>
      </section>
      <section className="work-panel">
        <h2>Activity</h2>
        <ul className="plain-list">
          {(timeline ?? []).map((event, index) => (
            <li key={`${event.action}-${index}`}>{event.action} · {new Date(event.createdAt).toLocaleString()}</li>
          ))}
          {!(timeline ?? []).length && <li className="muted">No timeline events yet.</li>}
        </ul>
      </section>
    </div>
  </div>;
}
