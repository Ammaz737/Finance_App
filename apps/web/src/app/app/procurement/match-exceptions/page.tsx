"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type MatchRow = {
  id: string;
  purchaseOrderId: string;
  billId: string | null;
  matchType: string;
  status: string;
  reasonCode?: string;
  exceptionStatus?: string;
  variance: string | number;
  explanation: string;
};

type Po = { id: string; number?: string };

function MatchExceptionsInner() {
  const session = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<MatchRow | null>(null);
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");

  const rows = useQuery({
    queryKey: ["resource", "matches", "exceptions"],
    queryFn: async () => {
      const all = await api.get<MatchRow[]>("/matches");
      return all.filter(
        (row) =>
          ["EXCEPTION", "BLOCKED"].includes(row.status) &&
          ["OPEN", "IN_REVIEW", ""].includes(row.exceptionStatus ?? ""),
      );
    },
  });

  const pos = useQuery({
    queryKey: ["match-exception-po-labels"],
    queryFn: async () => {
      try {
        return await api.get<Po[]>("/purchase-orders");
      } catch {
        return [] as Po[];
      }
    },
  });
  const poRows = pos.data ?? [];

  useEffect(() => {
    const matchId = searchParams.get("match");
    if (matchId && rows.data) {
      setSelected(rows.data.find((row) => row.id === matchId) ?? null);
    }
  }, [rows.data, searchParams]);

  const resolve = useMutation({
    mutationFn: (resolution: string) =>
      api.post(`/matches/${selected!.id}/resolve`, {
        resolution,
        note: comment || "Reviewed in match exceptions UI",
      }),
    onSuccess: () => {
      setMessage("Exception updated.");
      setSelected(null);
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["resource", "matches"] });
    },
  });

  const canSeeBills = session
    ? canSeeItem(
        findNavItem("/app/bill-pay/bills") ?? { href: "/app/bill-pay/bills", permission: "bill.create" },
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

  function poNumber(id: string) {
    return poRows.find((row) => row.id === id)?.number || id.slice(0, 8);
  }

  return (
    <div className="detail-page match-exceptions-page">
      <div className="resource-heading">
        <PageHeader
          title="Match exceptions"
          subtitle="PO ↔ receiving ↔ bill variances that need a reviewer decision"
        />
        {canSeePos && (
          <Link className="btn btn-ghost" href="/app/procurement/purchase-orders">
            Purchase orders
          </Link>
        )}
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {resolve.isError && (
        <p className="error" role="alert">
          {resolve.error.message}
        </p>
      )}
      {rows.isError && (
        <div className="error-panel" role="alert">
          Could not load exceptions.{" "}
          <button className="text-button" type="button" onClick={() => void rows.refetch()}>
            Try again
          </button>
        </div>
      )}

      <div className="detail-grid">
        <section className="panel">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h2>Open exceptions</h2>
            <span>{rows.data?.length ?? 0}</span>
          </div>
          {rows.isPending && <p className="muted">Loading…</p>}
          <ul className="plain-list match-exception-list">
            {(rows.data ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`match-exception-item${selected?.id === row.id ? " is-selected" : ""}`}
                  onClick={() => setSelected(row)}
                >
                  <span className="inbox-table-request">
                    <strong>
                      {row.reasonCode || row.matchType} · {poNumber(row.purchaseOrderId)}
                    </strong>
                    <small>Variance {String(row.variance)}</small>
                  </span>
                  <StatusBadge status={row.status} />
                </button>
              </li>
            ))}
            {!(rows.data ?? []).length && !rows.isPending && (
              <li className="muted">No open match exceptions.</li>
            )}
          </ul>
        </section>

        <section className="panel work-panel">
          <h2>Review</h2>
          {!selected && <p className="muted">Select an exception to resolve.</p>}
          {selected && (
            <>
              <dl className="detail-list">
                <div>
                  <dt>Explanation</dt>
                  <dd>{selected.explanation || "—"}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>
                    {selected.matchType} · {selected.reasonCode || "—"}
                  </dd>
                </div>
                <div>
                  <dt>Variance</dt>
                  <dd>{String(selected.variance)}</dd>
                </div>
                <div>
                  <dt>Links</dt>
                  <dd>
                    {canSeePos ? (
                      <Link className="detail-link" href={`/app/procurement/purchase-orders/${selected.purchaseOrderId}`}>
                        Open PO →
                      </Link>
                    ) : (
                      "PO"
                    )}
                    {selected.billId && canSeeBills ? (
                      <>
                        {" · "}
                        <Link className="detail-link" href={`/app/bill-pay/bills/${selected.billId}`}>
                          Open bill →
                        </Link>
                      </>
                    ) : null}
                  </dd>
                </div>
              </dl>
              <label>
                Comment
                <textarea
                  className="input"
                  rows={3}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
              <div className="detail-actions" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate("APPROVED_OVERRIDE")}
                >
                  Approve override
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate("REQUESTED_RECEIVING_UPDATE")}
                >
                  Request receiving update
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate("REQUESTED_CORRECTED_INVOICE")}
                >
                  Request corrected invoice
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate("CORRECTED")}
                >
                  Mark corrected
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate("RESOLVED")}
                >
                  Resolve
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={resolve.isPending || !comment.trim()}
                  onClick={() => resolve.mutate("COMMENTED")}
                >
                  Comment
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate("REJECTED")}
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MatchExceptionsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading match exceptions…</p>}>
      <MatchExceptionsInner />
    </Suspense>
  );
}
