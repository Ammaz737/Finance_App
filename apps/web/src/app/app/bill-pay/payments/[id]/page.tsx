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
  payment: {
    id: string;
    amount: string | number;
    currency: string;
    rail: string;
    status: string;
    providerRef: string | null;
    settlementId: string | null;
    failureReason: string | null;
    createdBy: string;
    releasedBy: string | null;
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
      void queryClient.invalidateQueries({ queryKey: ["resource", "payments"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load payment.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading payment…</p>;

  const { payment, bill, vendor, accounting, timeline, creator, releaser, providerLabel } = detail.data;
  const canRelease =
    (session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("payment.release")) &&
    payment.status === "SCHEDULED" &&
    session?.userId !== payment.createdBy;

  const canSeePayments = session
    ? canSeeItem(
        findNavItem("/app/bill-pay/payments") ?? { href: "/app/bill-pay/payments", permission: "payment.create" },
        session,
      )
    : false;
  const canSeeBills = session
    ? canSeeItem(
        findNavItem("/app/bill-pay/bills") ?? { href: "/app/bill-pay/bills", permission: "bill.create" },
        session,
      )
    : false;
  const canSeeVendors = session
    ? canSeeItem(findNavItem("/app/vendors") ?? { href: "/app/vendors", permission: "vendor.read" }, session)
    : false;
  const canSeeAccounting = session
    ? canSeeItem(
        findNavItem("/app/accounting/review") ?? { href: "/app/accounting/review", permission: "accounting.read" },
        session,
      )
    : false;

  const backHref = canSeePayments ? "/app/bill-pay/payments" : canSeeBills ? "/app/bill-pay/bills" : "/app/home";
  const backLabel =
    backHref === "/app/bill-pay/payments"
      ? "Back to payments"
      : backHref === "/app/bill-pay/bills"
        ? "Back to bills"
        : "Back to overview";

  return (
    <div className="detail-page payment-detail-page">
      <div className="resource-heading">
        <PageHeader
          title={money(payment.currency, payment.amount)}
          subtitle={`${payment.rail} · ${providerLabel ?? "Payment"}`}
        />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {action.isError && (
        <p className="error" role="alert">
          {action.error.message}
        </p>
      )}
      {detail.data.sandbox && (
        <p className="muted">{providerLabel ?? "SANDBOX payment rail"}</p>
      )}

      <div className="overview-stat-grid">
        <article className="overview-stat">
          <span>Status</span>
          <strong>
            <StatusBadge status={payment.status} />
          </strong>
          <small>{payment.failureReason || "—"}</small>
        </article>
        {bill && canSeeBills ? (
          <Link href={`/app/bill-pay/bills/${bill.id}`} className="overview-stat">
            <span>Bill</span>
            <strong>{bill.invoiceNumber}</strong>
            <small>
              <StatusBadge status={bill.status} /> · Open →
            </small>
          </Link>
        ) : (
          <article className="overview-stat">
            <span>Bill</span>
            <strong>{bill?.invoiceNumber ?? "—"}</strong>
            <small>{bill ? <StatusBadge status={bill.status} /> : null}</small>
          </article>
        )}
        {vendor && canSeeVendors ? (
          <Link href={`/app/vendors/${vendor.id}`} className="overview-stat">
            <span>Vendor</span>
            <strong>{vendor.name}</strong>
            <small>{vendor.paymentStatus || "—"}</small>
          </Link>
        ) : (
          <article className="overview-stat">
            <span>Vendor</span>
            <strong>{vendor?.name ?? "—"}</strong>
            <small>{vendor?.paymentStatus ?? ""}</small>
          </article>
        )}
        {accounting && canSeeAccounting ? (
          <Link
            href={`/app/accounting/review?entry=${encodeURIComponent(accounting.id)}`}
            className="overview-stat"
          >
            <span>Accounting</span>
            <strong>
              <StatusBadge status={accounting.status} />
            </strong>
            <small>PAYMENT source →</small>
          </Link>
        ) : (
          <article className="overview-stat">
            <span>Accounting</span>
            <strong>{accounting ? <StatusBadge status={accounting.status} /> : "—"}</strong>
            <small>PAYMENT source</small>
          </article>
        )}
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Release</h2>
          <dl className="detail-list">
            <div>
              <dt>Created by</dt>
              <dd>{creator ? `${creator.firstName} ${creator.lastName}` : "—"}</dd>
            </div>
            <div>
              <dt>Released by</dt>
              <dd>{releaser ? `${releaser.firstName} ${releaser.lastName}` : "—"}</dd>
            </div>
            <div>
              <dt>Provider ref</dt>
              <dd>{payment.providerRef ?? "—"}</dd>
            </div>
            <div>
              <dt>Settlement</dt>
              <dd>{payment.settlementId ?? "—"}</dd>
            </div>
          </dl>
          <div className="detail-actions">
            {canRelease && (
              <button
                className="btn btn-primary"
                type="button"
                disabled={action.isPending}
                onClick={() => action.mutate("release")}
              >
                Release payment
              </button>
            )}
            {sandbox && payment.status === "PROCESSING" && (
              <button
                className="btn btn-ghost"
                type="button"
                disabled={action.isPending}
                onClick={() => action.mutate("confirm-settlement")}
              >
                Confirm settlement
              </button>
            )}
          </div>
          {payment.status === "SCHEDULED" && !canRelease && session?.userId === payment.createdBy && (
            <p className="muted" style={{ marginTop: 12 }}>
              Creator cannot release — another user with release permission must approve.
            </p>
          )}
        </section>

        <section className="panel">
          <h2>Activity</h2>
          <div className="timeline">
            {(timeline ?? []).map((event, index) => (
              <div key={`${event.action}-${index}`} className="timeline-item">
                <strong>{event.action}</strong>
                <div className="muted">{new Date(event.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {!(timeline ?? []).length && <p className="muted">No timeline events yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
