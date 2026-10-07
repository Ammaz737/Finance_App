"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  run: {
    id: string;
    name: string;
    status: string;
    createdBy: string;
    legalEntityId: string;
    sourceAccountId?: string | null;
  };
  items: Array<{
    id: string;
    billId: string;
    amount: string | number;
    currency: string;
    status: string;
    createdBy: string;
    bill?: { invoiceNumber: string } | null;
  }>;
  eligiblePayments: Array<{
    id: string;
    billId: string;
    amount: string | number;
    currency: string;
    status: string;
    bill?: { invoiceNumber: string } | null;
  }>;
  sourceAccount: { name: string; last4: string; currency: string } | null;
  paymentCount: number;
  total: number;
  validationIssues: string[];
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

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
      setMessage("Payments added to run.");
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["payment-run-detail", params.id] });
    },
  });

  const remove = useMutation({
    mutationFn: (paymentId: string) =>
      api.post(`/payment-runs/${params.id}/remove-payments`, { paymentIds: [paymentId] }),
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
      void queryClient.invalidateQueries({ queryKey: ["resource", "payment-runs"] });
    },
  });

  if (detail.isError) {
    const errMsg = (detail.error as Error)?.message ?? "";
    const forbidden = /forbidden|missing access|permission/i.test(errMsg);
    return (
      <div className="error-panel" role="alert">
        {forbidden
          ? "You do not have permission to view payment runs. Sign in as AP, Treasury, or Admin."
          : errMsg
            ? `Could not load payment run: ${errMsg}`
            : "Could not load payment run."}{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading payment run…</p>;

  const { run, items } = detail.data;
  const canManage = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("payment_run.manage"),
  );
  const canRelease = canManage && run.status === "OPEN" && session?.userId !== run.createdBy;
  const canSeeRuns = session
    ? canSeeItem(
        findNavItem("/app/bill-pay/payment-runs") ?? {
          href: "/app/bill-pay/payment-runs",
          permission: "payment_run.manage",
        },
        session,
      )
    : false;
  const canSeeBills = session
    ? canSeeItem(
        findNavItem("/app/bill-pay/bills") ?? { href: "/app/bill-pay/bills", permission: "bill.create" },
        session,
      )
    : false;
  const canSeePayments = session
    ? canSeeItem(
        findNavItem("/app/bill-pay/payments") ?? { href: "/app/bill-pay/payments", permission: "payment.create" },
        session,
      )
    : false;

  const backHref = canSeeRuns ? "/app/bill-pay/payment-runs" : canSeePayments ? "/app/bill-pay/payments" : "/app/home";
  const backLabel =
    backHref === "/app/bill-pay/payment-runs"
      ? "Back to payment runs"
      : backHref === "/app/bill-pay/payments"
        ? "Back to payments"
        : "Back to overview";
  const currency = items[0]?.currency ?? detail.data.eligiblePayments[0]?.currency ?? "USD";

  return (
    <div className="detail-page payment-run-detail-page">
      <div className="resource-heading">
        <PageHeader title={run.name} subtitle="Batch release gate — creator cannot release" />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {(add.isError || remove.isError || release.isError) && (
        <p className="error" role="alert">
          {(add.error ?? remove.error ?? release.error)?.message}
        </p>
      )}

      <div className="overview-stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <article className="overview-stat">
          <span>Status</span>
          <strong>
            <StatusBadge status={run.status} />
          </strong>
          <small>{items.length} payments in run</small>
        </article>
        <article className="overview-stat">
          <span>Run total</span>
          <strong>{money(currency, detail.data.total)}</strong>
          <small>{detail.data.paymentCount} selected</small>
        </article>
        <article className="overview-stat">
          <span>Source account</span>
          <strong>{detail.data.sourceAccount?.name ?? "Not selected"}</strong>
          <small>
            {detail.data.sourceAccount ? `•••• ${detail.data.sourceAccount.last4}` : "Choose when creating a run"}
          </small>
        </article>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Items</h2>
          <ul className="plain-list">
            {items.map((item) => (
              <li key={item.id}>
                {money(item.currency, item.amount)} · <StatusBadge status={item.status} /> ·{" "}
                {canSeeBills ? (
                  <Link className="detail-link" href={`/app/bill-pay/bills/${item.billId}`}>
                    {item.bill?.invoiceNumber ?? item.billId.slice(0, 8)} →
                  </Link>
                ) : (
                  item.bill?.invoiceNumber ?? item.billId.slice(0, 8)
                )}
                {canSeePayments && (
                  <>
                    {" · "}
                    <Link className="detail-link" href={`/app/bill-pay/payments/${item.id}`}>
                      Payment →
                    </Link>
                  </>
                )}
                {canManage && run.status === "OPEN" && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.id)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
            {!items.length && <li className="muted">No payments in this run.</li>}
          </ul>
        </section>

        <section className="panel">
          <h2>Add & release</h2>
          {canManage && run.status === "OPEN" && (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                add.mutate();
              }}
            >
              <fieldset>
                <legend>Eligible scheduled payments</legend>
                {detail.data.eligiblePayments.map((payment) => (
                  <label className="checkbox" key={payment.id}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(payment.id)}
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked
                            ? [...selectedIds, payment.id]
                            : selectedIds.filter((id) => id !== payment.id),
                        )
                      }
                    />{" "}
                    {payment.bill?.invoiceNumber ?? payment.billId.slice(0, 8)} ·{" "}
                    {money(payment.currency, payment.amount)}
                  </label>
                ))}
                {!detail.data.eligiblePayments.length && (
                  <p className="muted">No unassigned scheduled payments are eligible for this entity.</p>
                )}
              </fieldset>
              <button className="btn btn-primary" type="submit" disabled={add.isPending || !selectedIds.length}>
                Add selected payments
              </button>
            </form>
          )}
          {detail.data.validationIssues.length > 0 && (
            <div className="policy-box">
              <strong>Remaining validation</strong>
              <ul>
                {detail.data.validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {canRelease && (
            <button
              className="btn btn-primary"
              type="button"
              style={{ marginTop: 12 }}
              disabled={release.isPending || detail.data.validationIssues.length > 0}
              onClick={() => release.mutate()}
            >
              Release run
            </button>
          )}
          {run.status === "OPEN" && session?.userId === run.createdBy && (
            <p className="muted" style={{ marginTop: 12 }}>
              You created this run — another user must release it.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
