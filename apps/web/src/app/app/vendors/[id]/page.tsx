"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  vendor: {
    id: string;
    name: string;
    legalName?: string;
    displayName?: string;
    category: string;
    status: string;
    paymentStatus?: string;
    riskLevel: string;
    notes: string;
    ownerId: string | null;
  };
  owner?: { firstName: string; lastName: string; email: string } | null;
  bankAccounts: Array<{
    id: string;
    last4: string;
    routingMasked: string;
    status: string;
    isCurrent: boolean;
    changeReason: string;
    createdAt: string;
    paymentMethod?: string;
    beneficiaryName?: string;
    changedBy?: string;
  }>;
  bills: Array<{
    id: string;
    invoiceNumber: string;
    amount: string | number;
    remainingAmount: string | number;
    currency: string;
    status: string;
  }>;
  payments: Array<{
    id: string;
    amount: string | number;
    currency: string;
    status: string;
    settlementId: string | null;
  }>;
  purchaseOrders?: Array<{ id: string; number: string; status: string; amount: string | number; currency: string }>;
  timeline?: Array<{ action: string; createdAt: string }>;
  summary: {
    billCount: number;
    openBillCount: number;
    lifetimeSpend: number;
    currentBankLast4: string | null;
    riskLevel: string;
    paymentStatus?: string;
  };
  sandbox?: boolean;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [last4, setLast4] = useState("");
  const [routing, setRouting] = useState("");
  const [reason, setReason] = useState("");
  const [vendorForm, setVendorForm] = useState({
    name: "",
    legalName: "",
    displayName: "",
    category: "",
    riskLevel: "LOW",
    notes: "",
  });

  const detail = useQuery({
    queryKey: ["vendor-detail", params.id],
    queryFn: () => api.get<Detail>(`/vendors/${params.id}`),
  });

  useEffect(() => {
    if (!detail.data) return;
    const value = detail.data.vendor;
    setVendorForm({
      name: value.name,
      legalName: value.legalName ?? "",
      displayName: value.displayName ?? "",
      category: value.category ?? "",
      riskLevel: value.riskLevel,
      notes: value.notes ?? "",
    });
  }, [detail.data]);

  const vendorAction = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: object }) =>
      api.post(`/vendors/${params.id}/${name}`, body ?? {}),
    onSuccess: (_result, input) => {
      setMessage(`Vendor ${input.name} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["vendor-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "vendors"] });
    },
  });

  const setBank = useMutation({
    mutationFn: () =>
      api.post(`/vendors/${params.id}/set-bank`, { last4, routingMasked: routing, changeReason: reason }),
    onSuccess: () => {
      setMessage("Bank details updated. Prior account kept in history. Verification required.");
      setLast4("");
      setRouting("");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["vendor-detail", params.id] });
    },
  });

  const verifyBank = useMutation({
    mutationFn: (bankAccountId: string) => api.post(`/vendors/${params.id}/verify-bank`, { bankAccountId }),
    onSuccess: () => {
      setMessage("Bank details verified.");
      void queryClient.invalidateQueries({ queryKey: ["vendor-detail", params.id] });
    },
  });

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load vendor.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading vendor…</p>;

  const { vendor, bankAccounts, bills, payments, summary, owner, purchaseOrders, timeline } = detail.data;
  const canEdit = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("vendor.create"),
  );
  const canBank = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("vendor.bank_details.manage"),
  );
  const canSeeVendors = session
    ? canSeeItem(findNavItem("/app/vendors") ?? { href: "/app/vendors", permission: "vendor.read" }, session)
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
  const canSeePos = session
    ? canSeeItem(
        findNavItem("/app/procurement/purchase-orders") ?? {
          href: "/app/procurement/purchase-orders",
          permission: "procurement.review",
        },
        session,
      )
    : false;

  const backHref = canSeeVendors ? "/app/vendors" : canSeeBills ? "/app/bill-pay/bills" : "/app/home";
  const backLabel =
    backHref === "/app/vendors"
      ? "Back to vendors"
      : backHref === "/app/bill-pay/bills"
        ? "Back to bills"
        : "Back to overview";
  const title = vendor.displayName || vendor.name;

  return (
    <div className="detail-page vendor-detail-page">
      <div className="resource-heading">
        <PageHeader
          title={title}
          subtitle={`${vendor.legalName || vendor.name} · ${vendor.category || "Vendor"} · risk ${summary.riskLevel}`}
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
      {(setBank.isError || verifyBank.isError || vendorAction.isError) && (
        <p className="error" role="alert">
          {(setBank.error ?? verifyBank.error ?? vendorAction.error)?.message}
        </p>
      )}
      {detail.data.sandbox && <p className="muted">SANDBOX vendor banking — masked details only.</p>}

      <div className="overview-stat-grid">
        <article className="overview-stat">
          <span>Status</span>
          <strong>
            <StatusBadge status={vendor.status} />
          </strong>
          <small>{summary.openBillCount} open bills</small>
        </article>
        <article className="overview-stat">
          <span>Payment readiness</span>
          <strong>
            <StatusBadge status={vendor.paymentStatus ?? summary.paymentStatus ?? "NEEDS_BANK"} />
          </strong>
          <small>Owner {owner ? `${owner.firstName} ${owner.lastName}` : "—"}</small>
        </article>
        <article className="overview-stat">
          <span>Lifetime spend</span>
          <strong>{summary.lifetimeSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          <small>{summary.billCount} invoices</small>
        </article>
        <article className="overview-stat">
          <span>Bank</span>
          <strong>{summary.currentBankLast4 ? `•••• ${summary.currentBankLast4}` : "None"}</strong>
          <small>{bankAccounts.length} history rows</small>
        </article>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Overview</h2>
          {canEdit ? (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                vendorAction.mutate({ name: "update", body: vendorForm });
              }}
            >
              <label>
                Name
                <input
                  className="input"
                  value={vendorForm.name}
                  onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })}
                />
              </label>
              <label>
                Legal name
                <input
                  className="input"
                  value={vendorForm.legalName}
                  onChange={(event) => setVendorForm({ ...vendorForm, legalName: event.target.value })}
                />
              </label>
              <label>
                Display name
                <input
                  className="input"
                  value={vendorForm.displayName}
                  onChange={(event) => setVendorForm({ ...vendorForm, displayName: event.target.value })}
                />
              </label>
              <label>
                Category
                <input
                  className="input"
                  value={vendorForm.category}
                  onChange={(event) => setVendorForm({ ...vendorForm, category: event.target.value })}
                />
              </label>
              <label>
                Risk
                <select
                  className="input"
                  value={vendorForm.riskLevel}
                  onChange={(event) => setVendorForm({ ...vendorForm, riskLevel: event.target.value })}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
              <label>
                Notes
                <input
                  className="input"
                  value={vendorForm.notes}
                  onChange={(event) => setVendorForm({ ...vendorForm, notes: event.target.value })}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={vendorAction.isPending}>
                Save vendor
              </button>
            </form>
          ) : (
            <dl className="detail-list">
              <div>
                <dt>Legal name</dt>
                <dd>{vendor.legalName || vendor.name}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{vendor.category || "—"}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{vendor.notes || "—"}</dd>
              </div>
            </dl>
          )}
          {canEdit && vendor.status === "ACTIVE" && (
            <button
              className="btn btn-danger"
              type="button"
              style={{ marginTop: 12 }}
              onClick={() =>
                window.confirm("Deactivate this vendor?") && vendorAction.mutate({ name: "deactivate" })
              }
            >
              Deactivate
            </button>
          )}
        </section>

        <section className="panel">
          <h2>Banking / payment details</h2>
          <ul className="plain-list">
            {bankAccounts.map((account) => (
              <li key={account.id}>
                •••• {account.last4} / {account.routingMasked} · {account.paymentMethod ?? "ACH"} ·{" "}
                <StatusBadge status={account.status} />
                {account.isCurrent ? " (current)" : ""}
                {account.changeReason ? ` — ${account.changeReason}` : ""}
                {canBank &&
                  account.isCurrent &&
                  account.status === "PENDING_VERIFICATION" &&
                  account.changedBy !== session?.userId && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={verifyBank.isPending}
                      onClick={() => verifyBank.mutate(account.id)}
                    >
                      Verify
                    </button>
                  )}
              </li>
            ))}
            {!bankAccounts.length && <li className="muted">No bank accounts yet.</li>}
          </ul>
          {canBank && (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                setBank.mutate();
              }}
            >
              <label>
                Last 4
                <input className="input" value={last4} onChange={(e) => setLast4(e.target.value)} required maxLength={4} />
              </label>
              <label>
                Routing (masked)
                <input className="input" value={routing} onChange={(e) => setRouting(e.target.value)} required />
              </label>
              <label>
                Change reason
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={setBank.isPending}>
                Update bank details
              </button>
            </form>
          )}
        </section>
      </div>

      <div className="detail-grid">
        <section className="panel work-panel">
          <h2>Bills</h2>
          <ul className="plain-list">
            {bills.map((bill) => (
              <li key={bill.id}>
                {canSeeBills ? (
                  <Link className="detail-link" href={`/app/bill-pay/bills/${bill.id}`}>
                    {bill.invoiceNumber} →
                  </Link>
                ) : (
                  bill.invoiceNumber
                )}{" "}
                {money(bill.currency, bill.remainingAmount)} remaining · <StatusBadge status={bill.status} />
              </li>
            ))}
            {!bills.length && <li className="muted">No bills.</li>}
          </ul>
          <h2 style={{ marginTop: 20 }}>Payments</h2>
          <ul className="plain-list">
            {payments.slice(0, 10).map((payment) => (
              <li key={payment.id}>
                {canSeePayments ? (
                  <Link className="detail-link" href={`/app/bill-pay/payments/${payment.id}`}>
                    {money(payment.currency, payment.amount)} →
                  </Link>
                ) : (
                  money(payment.currency, payment.amount)
                )}{" "}
                · <StatusBadge status={payment.status} />
                {payment.settlementId ? ` · ${payment.settlementId}` : ""}
              </li>
            ))}
            {!payments.length && <li className="muted">No payments.</li>}
          </ul>
        </section>

        <section className="panel work-panel">
          <h2>Purchase orders</h2>
          <ul className="plain-list">
            {(purchaseOrders ?? []).map((po) => (
              <li key={po.id}>
                {canSeePos ? (
                  <Link className="detail-link" href={`/app/procurement/purchase-orders/${po.id}`}>
                    {po.number} →
                  </Link>
                ) : (
                  po.number
                )}{" "}
                · {money(po.currency, po.amount)} · <StatusBadge status={po.status} />
              </li>
            ))}
            {!(purchaseOrders ?? []).length && <li className="muted">No purchase orders.</li>}
          </ul>
          <h2 style={{ marginTop: 20 }}>Activity</h2>
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
