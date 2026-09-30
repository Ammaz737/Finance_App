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
  purchaseOrder: {
    id: string;
    number: string;
    amount: string | number;
    receivedAmount: string | number;
    billedAmount: string | number;
    currency: string;
    status: string;
    matchStatus: string;
    commitmentAmount: string | number;
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
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
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
      void queryClient.invalidateQueries({ queryKey: ["resource", "purchase-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "receiving"] });
    },
  });

  const match = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${params.id}/match`, { billId }),
    onSuccess: () => {
      setMessage("Match evaluated.");
      setBillId("");
      void queryClient.invalidateQueries({ queryKey: ["po-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "matches"] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "matches", "exceptions"] });
    },
  });

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load PO.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading purchase order…</p>;

  const { purchaseOrder: po, lines, receiving, matches, request, bills, remainingCommitment, timeline } = detail.data;
  const canReview = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("procurement.review"),
  );

  const canSeePos = session
    ? canSeeItem(
        findNavItem("/app/procurement/purchase-orders") ?? {
          href: "/app/procurement/purchase-orders",
          permission: "procurement.review",
        },
        session,
      )
    : false;
  const canSeeRequests = session
    ? canSeeItem(
        findNavItem("/app/procurement/requests") ?? {
          href: "/app/procurement/requests",
          permission: "procurement.request",
        },
        session,
      )
    : false;
  const canSeeReceiving = session
    ? canSeeItem(
        findNavItem("/app/procurement/receiving") ?? {
          href: "/app/procurement/receiving",
          permission: "procurement.review",
        },
        session,
      )
    : false;
  const canSeeExceptions = session
    ? canSeeItem(
        findNavItem("/app/procurement/match-exceptions") ?? {
          href: "/app/procurement/match-exceptions",
          permission: "procurement.review",
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

  const backHref = canSeePos ? "/app/procurement/purchase-orders" : canSeeReceiving ? "/app/procurement/receiving" : "/app/home";
  const backLabel =
    backHref === "/app/procurement/purchase-orders"
      ? "Back to purchase orders"
      : backHref === "/app/procurement/receiving"
        ? "Back to receiving"
        : "Back to overview";

  const requestHref = request && canSeeRequests ? `/app/procurement/requests/${request.id}` : null;
  const selectedBill = bills.find((bill) => bill.id === billId);
  const openExceptions = matches.filter((row) => ["EXCEPTION", "BLOCKED"].includes(row.status));

  return (
    <div className="detail-page procurement-detail-page">
      <div className="resource-heading">
        <PageHeader title={po.number} subtitle={request?.name ?? "Purchase order"} />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {(receive.isError || match.isError) && (
        <p className="error" role="alert">
          {(receive.error ?? match.error)?.message}
        </p>
      )}

      <div className="overview-stat-grid">
        <article className="overview-stat">
          <span>Commitment</span>
          <strong>{money(po.currency, po.commitmentAmount)}</strong>
          <small>
            <StatusBadge status={po.status} />
          </small>
        </article>
        <article className="overview-stat">
          <span>Received</span>
          <strong>{money(po.currency, po.receivedAmount)}</strong>
          <small>
            {canSeeReceiving ? (
              <Link className="detail-link" href="/app/procurement/receiving">
                Receiving →
              </Link>
            ) : (
              "vs PO"
            )}
          </small>
        </article>
        <article className="overview-stat">
          <span>Billed</span>
          <strong>{money(po.currency, po.billedAmount)}</strong>
          <small>
            <StatusBadge status={po.matchStatus} />
          </small>
        </article>
        <article className="overview-stat">
          <span>Remaining</span>
          <strong>
            {money(po.currency, remainingCommitment ?? Number(po.commitmentAmount) - Number(po.billedAmount))}
          </strong>
          <small>
            {openExceptions.length && canSeeExceptions ? (
              <Link className="detail-link" href="/app/procurement/match-exceptions">
                {openExceptions.length} exception{openExceptions.length === 1 ? "" : "s"} →
              </Link>
            ) : (
              "Commitment − matched"
            )}
          </small>
        </article>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Lines</h2>
          <ul className="plain-list">
            {lines.map((line) => (
              <li key={line.id}>
                {line.description} × {String(line.quantity)} — {money(po.currency, line.amount)}
              </li>
            ))}
            {!lines.length && <li className="muted">No line items.</li>}
          </ul>
          <h2 style={{ marginTop: 20 }}>Receiving</h2>
          <ul className="plain-list">
            {receiving.map((row) => (
              <li key={row.id}>
                {money(po.currency, row.amount)}
                {row.memo ? ` · ${row.memo}` : ""}
                {row.createdAt ? ` · ${new Date(row.createdAt).toLocaleDateString()}` : ""}
              </li>
            ))}
            {!receiving.length && <li className="muted">Nothing received yet.</li>}
          </ul>
          {canReview && ["ISSUED", "OPEN", "PARTIALLY_RECEIVED"].includes(po.status) && (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                receive.mutate();
              }}
            >
              <label>
                Amount
                <input
                  className="input"
                  value={receiveAmount}
                  onChange={(event) => setReceiveAmount(event.target.value)}
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={receive.isPending}>
                Record receipt
              </button>
            </form>
          )}
        </section>

        <section className="panel work-panel">
          <h2>Matching</h2>
          <ul className="plain-list">
            {matches.map((row) => (
              <li key={row.id}>
                {row.matchType} · <StatusBadge status={row.status} /> · variance {String(row.variance)}
                {row.billId && canSeeBills ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link className="detail-link" href={`/app/bill-pay/bills/${row.billId}`}>
                      Bill →
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
            {!matches.length && <li className="muted">No match records.</li>}
          </ul>
          <h3>Bills</h3>
          <ul className="plain-list">
            {bills.map((bill) => (
              <li key={bill.id}>
                <button type="button" className="text-button" onClick={() => setBillId(bill.id)}>
                  {bill.invoiceNumber}
                </button>{" "}
                {money(po.currency, bill.amount)} · <StatusBadge status={bill.status} />
                {canSeeBills ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link className="detail-link" href={`/app/bill-pay/bills/${bill.id}`}>
                      Open
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
            {!bills.length && <li className="muted">Create a bill with this PO, then match.</li>}
          </ul>
          {canReview && (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                match.mutate();
              }}
            >
              <p className="muted">{selectedBill ? `Selected: ${selectedBill.invoiceNumber}` : "Select a linked bill above."}</p>
              <button className="btn btn-primary" type="submit" disabled={match.isPending || !billId}>
                Run 2/3-way match
              </button>
            </form>
          )}
          {requestHref && (
            <p style={{ marginTop: 16 }}>
              <Link className="detail-link" href={requestHref}>
                Open request →
              </Link>
            </p>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Activity</h2>
        <div className="timeline">
          {(timeline ?? []).map((event) => (
            <div key={event.id} className="timeline-item">
              <strong>{event.action}</strong>
              <div className="muted">{new Date(event.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {!(timeline ?? []).length && <p className="muted">No activity yet.</p>}
        </div>
      </section>
    </div>
  );
}
