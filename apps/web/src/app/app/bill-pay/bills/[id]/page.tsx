"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  bill: {
    id: string; invoiceNumber: string; amount: string | number; remainingAmount: string | number; currency: string;
    status: string; memo: string; dueDate: string | null; createdBy: string; vendorId: string;
    duplicateStatus?: string; vendorMatchStatus?: string; codingSource?: string; paymentMethod?: string;
  };
  vendor: { id: string; name: string; displayName?: string; paymentStatus?: string } | null;
  entity?: { name: string } | null;
  lines: Array<{ id: string; description: string; amount: string | number; category: string; glAccount?: string }>;
  payments: Array<{ id: string; amount: string | number; currency: string; rail: string; status: string; settlementId: string | null; createdBy: string }>;
  attachment: { originalName: string; malwareStatus: string; ocrStatus?: string | null } | null;
  accounting: { id: string; status: string } | null;
  approvalProgress?: Array<{ label: string; status: string }>;
  approvalLabel?: string;
  duplicate?: { status: string };
  vendorMatch?: { status: string };
  vendorPayment?: { last4: string; status: string; paymentMethod: string } | null;
  timeline?: Array<{ action: string; createdAt: string; actorId?: string | null }>;
  sandbox?: boolean;
  readyForPayment?: boolean;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function BillDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const sandbox = process.env.NODE_ENV !== "production";

  const detail = useQuery({
    queryKey: ["bill-detail", params.id],
    queryFn: () => api.get<Detail>(`/bills/${params.id}`),
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/bills/${params.id}/approve`, {}),
    onSuccess: () => {
      setMessage("Bill approved. Payment release is a separate step.");
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "bills"] });
    },
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/bills/${params.id}/submit`, {}),
    onSuccess: () => {
      setMessage("Bill submitted for approval.");
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
    },
  });

  const schedule = useMutation({
    mutationFn: () => api.post(`/payments`, {
      billId: params.id,
      amount: payAmount || String(detail.data?.bill.remainingAmount ?? ""),
      rail: "ACH",
      idempotencyKey: `web-${params.id}-${Date.now()}`,
    }),
    onSuccess: () => {
      setMessage("Payment scheduled. A different user must release it.");
      setPayAmount("");
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "payments"] });
    },
  });

  const paymentAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/payments/${id}/${action}`, {}),
    onSuccess: (_data, vars) => {
      setMessage(`Payment ${vars.action} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "payments"] });
    },
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load bill. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading bill…</p>;

  const { bill, vendor, lines, payments, attachment, accounting, approvalProgress, approvalLabel, timeline, vendorPayment, entity } = detail.data;
  const canApprove = bill.status === "PENDING_APPROVAL"
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("bill.approve"))
    && session?.userId !== bill.createdBy;
  const canSubmit = ["DRAFT", "NEEDS_REVIEW"].includes(bill.status)
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("bill.create"));
  const canSchedule = ["APPROVED", "PARTIAL"].includes(bill.status)
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("payment.create"));
  const canRelease = session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("payment.release");

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={`Invoice ${bill.invoiceNumber}`} subtitle={`${vendor?.displayName ?? vendor?.name ?? "Vendor"} · ${money(bill.currency, bill.amount)}`} />
      <Link className="btn btn-ghost" href="/app/bill-pay/bills">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {(approve.isError || schedule.isError || paymentAction.isError || submit.isError) && (
      <p className="error" role="alert">{(approve.error ?? schedule.error ?? paymentAction.error ?? submit.error)?.message}</p>
    )}
    {detail.data.sandbox && <p className="muted">SANDBOX / MOCK PAYMENT rail for settlement confirmation.</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={bill.status} /></strong><small>{entity?.name ?? "Entity"}</small></article>
      <article className="kpi-card"><span>Remaining</span><strong>{money(bill.currency, bill.remainingAmount)}</strong><small>Settled payments only reduce this</small></article>
      <article className="kpi-card"><span>Duplicate</span><strong>{bill.duplicateStatus ?? detail.data.duplicate?.status ?? "CLEAR"}</strong><small>Vendor match {bill.vendorMatchStatus ?? detail.data.vendorMatch?.status}</small></article>
      <article className="kpi-card"><span>Accounting</span><strong>{accounting ? <StatusBadge status={accounting.status} /> : "—"}</strong><small>Bill source row</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Summary</h2>
        <p>{bill.memo || "No memo"}</p>
        <p className="muted">Payment method {bill.paymentMethod ?? "ACH"} · Coding {bill.codingSource ?? "MANUAL"}</p>
        <p className="muted">Vendor payment: {vendorPayment ? `•••• ${vendorPayment.last4} (${vendorPayment.status})` : vendor?.paymentStatus ?? "—"}</p>
        <div className="detail-actions">
          {canSubmit && <button className="btn btn-primary" type="button" disabled={submit.isPending} onClick={() => submit.mutate()}>Submit for approval</button>}
          {canApprove && <button className="btn btn-primary" type="button" disabled={approve.isPending} onClick={() => approve.mutate()}>Approve bill</button>}
          {canSchedule && <>
            <input className="input" placeholder="Partial amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} aria-label="Partial amount" />
            <button className="btn btn-primary" type="button" disabled={schedule.isPending} onClick={() => schedule.mutate()}>Schedule payment</button>
          </>}
        </div>
      </section>
      <section className="work-panel">
        <h2>Invoice & lines</h2>
        <ul className="plain-list">
          {lines.map((line) => <li key={line.id}>{line.description} — {money(bill.currency, line.amount)}{line.category ? ` · ${line.category}` : ""}{line.glAccount ? ` · GL ${line.glAccount}` : ""}</li>)}
        </ul>
        <p className="muted">Document: {attachment ? `${attachment.originalName} (${attachment.malwareStatus}${attachment.ocrStatus ? ` · OCR ${attachment.ocrStatus}` : ""})` : "None attached"}</p>
      </section>
      <section className="work-panel">
        <h2>Approval</h2>
        <p className="muted">{approvalLabel || "No approval started"}</p>
        <ul className="plain-list">
          {(approvalProgress ?? []).map((step) => <li key={step.label}>{step.label} — {step.status}</li>)}
          {!(approvalProgress ?? []).length && <li className="muted">Waiting for submission.</li>}
        </ul>
        <p className="muted">Approve ≠ release.</p>
      </section>
      <section className="work-panel">
        <h2>Payments</h2>
        <ul className="plain-list">
          {payments.map((payment) => (
            <li key={payment.id}>
              <Link href={`/app/bill-pay/payments/${payment.id}`}>{money(payment.currency, payment.amount)}</Link>
              {" "}· {payment.rail} · <StatusBadge status={payment.status} />
              {payment.settlementId ? ` · ${payment.settlementId}` : ""}
              <span className="detail-actions">
                {canRelease && payment.status === "SCHEDULED" && session?.userId !== payment.createdBy && (
                  <button className="btn btn-ghost" type="button" disabled={paymentAction.isPending} onClick={() => paymentAction.mutate({ id: payment.id, action: "release" })}>Release</button>
                )}
                {canRelease && sandbox && payment.status === "PROCESSING" && (
                  <button className="btn btn-ghost" type="button" disabled={paymentAction.isPending} onClick={() => paymentAction.mutate({ id: payment.id, action: "confirm-settlement" })}>Confirm settlement</button>
                )}
              </span>
            </li>
          ))}
          {!payments.length && <li className="muted">No payments yet{detail.data.readyForPayment ? " — ready for payment." : "."}</li>}
        </ul>
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
