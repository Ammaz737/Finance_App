"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  vendor: { id: string; name: string; category: string; status: string; riskLevel: string; notes: string; ownerId: string | null };
  bankAccounts: Array<{ id: string; last4: string; routingMasked: string; status: string; isCurrent: boolean; changeReason: string; createdAt: string }>;
  bills: Array<{ id: string; invoiceNumber: string; amount: string | number; remainingAmount: string | number; currency: string; status: string }>;
  payments: Array<{ id: string; amount: string | number; currency: string; status: string; settlementId: string | null }>;
  summary: { billCount: number; openBillCount: number; lifetimeSpend: number; currentBankLast4: string | null; riskLevel: string };
};

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [last4, setLast4] = useState("");
  const [routing, setRouting] = useState("");
  const [reason, setReason] = useState("");

  const detail = useQuery({
    queryKey: ["vendor-detail", params.id],
    queryFn: () => api.get<Detail>(`/vendors/${params.id}`),
  });

  const setBank = useMutation({
    mutationFn: () => api.post(`/vendors/${params.id}/set-bank`, { last4, routingMasked: routing, changeReason: reason }),
    onSuccess: () => {
      setMessage("Bank details updated. Prior account kept in history.");
      setLast4(""); setRouting(""); setReason("");
      void queryClient.invalidateQueries({ queryKey: ["vendor-detail", params.id] });
    },
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load vendor. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading vendor…</p>;

  const { vendor, bankAccounts, bills, payments, summary } = detail.data;
  const canBank = session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("vendor.bank_details.manage");

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={vendor.name} subtitle={`${vendor.category || "Vendor"} · risk ${summary.riskLevel}`} />
      <Link className="btn btn-ghost" href="/app/vendors">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {setBank.isError && <p className="error" role="alert">{setBank.error.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={vendor.status} /></strong><small>{summary.openBillCount} open bills</small></article>
      <article className="kpi-card"><span>Lifetime spend</span><strong>{summary.lifetimeSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>{summary.billCount} invoices</small></article>
      <article className="kpi-card"><span>Bank</span><strong>{summary.currentBankLast4 ? `•••• ${summary.currentBankLast4}` : "None"}</strong><small>{bankAccounts.length} history rows</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Bank change control</h2>
        <ul className="plain-list">
          {bankAccounts.map((account) => (
            <li key={account.id}>
              •••• {account.last4} / {account.routingMasked} · <StatusBadge status={account.status} />
              {account.isCurrent ? " (current)" : ""} {account.changeReason ? `— ${account.changeReason}` : ""}
            </li>
          ))}
          {!bankAccounts.length && <li className="muted">No bank accounts yet.</li>}
        </ul>
        {canBank && <form className="stack-form" onSubmit={(event) => { event.preventDefault(); setBank.mutate(); }}>
          <label>Last 4<input className="input" value={last4} onChange={(e) => setLast4(e.target.value)} required maxLength={4} /></label>
          <label>Routing (masked)<input className="input" value={routing} onChange={(e) => setRouting(e.target.value)} required /></label>
          <label>Change reason<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button className="btn btn-primary" type="submit" disabled={setBank.isPending}>Update bank details</button>
        </form>}
      </section>
      <section className="work-panel">
        <h2>Bills</h2>
        <ul className="plain-list">
          {bills.map((bill) => (
            <li key={bill.id}>
              <Link href={`/app/bill-pay/bills/${bill.id}`}>{bill.invoiceNumber}</Link>
              {" "}{bill.currency} {String(bill.remainingAmount)} remaining · <StatusBadge status={bill.status} />
            </li>
          ))}
          {!bills.length && <li className="muted">No bills.</li>}
        </ul>
        <h2>Payments</h2>
        <ul className="plain-list">
          {payments.slice(0, 10).map((payment) => (
            <li key={payment.id}>{payment.currency} {String(payment.amount)} · <StatusBadge status={payment.status} />{payment.settlementId ? ` · ${payment.settlementId}` : ""}</li>
          ))}
          {!payments.length && <li className="muted">No payments.</li>}
        </ul>
        {vendor.notes && <p className="muted">{vendor.notes}</p>}
      </section>
    </div>
  </div>;
}
