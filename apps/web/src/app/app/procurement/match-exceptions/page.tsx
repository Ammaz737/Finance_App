"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";

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

export default function MatchExceptionsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<MatchRow | null>(null);
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");

  const rows = useQuery({
    queryKey: ["resource", "matches", "exceptions"],
    queryFn: async () => {
      const all = await api.get<MatchRow[]>("/matches");
      return all.filter((row) => ["EXCEPTION", "BLOCKED"].includes(row.status)
        && ["OPEN", "IN_REVIEW", ""].includes(row.exceptionStatus ?? ""));
    },
  });

  useEffect(() => {
    const matchId = new URLSearchParams(window.location.search).get("match");
    if (matchId && rows.data) setSelected(rows.data.find((row) => row.id === matchId) ?? null);
  }, [rows.data]);

  const resolve = useMutation({
    mutationFn: (resolution: string) => api.post(`/matches/${selected!.id}/resolve`, { resolution, note: comment || "Reviewed in match exceptions UI" }),
    onSuccess: () => {
      setMessage("Exception updated.");
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["resource", "matches"] });
    },
  });

  return <div className="spend-detail">
    <PageHeader title="Match exceptions" subtitle="PO ↔ receiving ↔ bill variances requiring review" />
    {message && <p className="notice" role="status">{message}</p>}
    {resolve.isError && <p className="error" role="alert">{resolve.error.message}</p>}
    <div className="work-panels">
      <section className="work-panel">
        <h2>Open exceptions</h2>
        {rows.isPending && <p className="muted">Loading…</p>}
        <ul className="plain-list">
          {(rows.data ?? []).map((row) => (
            <li key={row.id}>
              <button type="button" className="text-button" onClick={() => setSelected(row)}>
                {row.reasonCode || row.matchType} · variance {String(row.variance)}
              </button>
              {" "}<StatusBadge status={row.status} />
            </li>
          ))}
          {!(rows.data ?? []).length && !rows.isPending && <li className="muted">No open match exceptions.</li>}
        </ul>
      </section>
      <section className="work-panel">
        <h2>Review</h2>
        {!selected && <p className="muted">Select an exception.</p>}
        {selected && <>
          <p>{selected.explanation}</p>
          <p className="muted">{selected.matchType} · {selected.reasonCode || "—"}</p>
          <label>Comment<textarea className="input" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
          <p>
            <Link href={`/app/procurement/purchase-orders/${selected.purchaseOrderId}`}>Open PO</Link>
            {selected.billId ? <> · <Link href={`/app/bill-pay/bills/${selected.billId}`}>Open bill</Link></> : null}
          </p>
          <div className="detail-actions">
            <button className="btn btn-primary" type="button" disabled={resolve.isPending} onClick={() => resolve.mutate("APPROVED_OVERRIDE")}>Approve override</button>
            <button className="btn btn-ghost" type="button" disabled={resolve.isPending} onClick={() => resolve.mutate("REQUESTED_RECEIVING_UPDATE")}>Request receiving update</button>
            <button className="btn btn-ghost" type="button" disabled={resolve.isPending} onClick={() => resolve.mutate("REQUESTED_CORRECTED_INVOICE")}>Request corrected invoice</button>
            <button className="btn btn-ghost" type="button" disabled={resolve.isPending} onClick={() => resolve.mutate("CORRECTED")}>Mark corrected</button>
            <button className="btn btn-ghost" type="button" disabled={resolve.isPending} onClick={() => resolve.mutate("RESOLVED")}>Resolve</button>
            <button className="btn btn-ghost" type="button" disabled={resolve.isPending || !comment.trim()} onClick={() => resolve.mutate("COMMENTED")}>Comment</button>
            <button className="btn btn-ghost" type="button" disabled={resolve.isPending} onClick={() => resolve.mutate("REJECTED")}>Reject</button>
          </div>
        </>}
      </section>
    </div>
  </div>;
}
