"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Entry = { id: string; status: string; sourceType: string };

export default function Page() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const entries = useQuery({
    queryKey: ["resource", "accounting"],
    queryFn: () => api.get<Entry[]>("/accounting"),
  });
  const rows = entries.data ?? [];
  const counts = {
    needsReview: rows.filter((row) => row.status === "NEEDS_REVIEW").length,
    ready: rows.filter((row) => row.status === "READY_TO_SYNC").length,
    synced: rows.filter((row) => row.status === "SYNCED").length,
    errors: rows.filter((row) => row.status === "SYNC_ERROR").length,
    card: rows.filter((row) => row.sourceType === "CARD_TRANSACTION").length,
    reimbursement: rows.filter((row) => row.sourceType === "REIMBURSEMENT").length,
    bill: rows.filter((row) => row.sourceType === "BILL").length,
    payment: rows.filter((row) => row.sourceType === "PAYMENT").length,
  };

  const canSync = session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("accounting.sync");
  const canCode = session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("accounting.code");

  const syncAll = useMutation({
    mutationFn: () => api.post("/erp-sync", {}),
    onSuccess: () => {
      setMessage("Ready entries synced to mock ERP.");
      void queryClient.invalidateQueries({ queryKey: ["resource", "accounting"] });
    },
  });

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title="Accounting queue" subtitle="One source row per event. Sync ack is idempotent — retries never duplicate ERP postings." />
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {syncAll.isError && <p className="error" role="alert">{syncAll.error.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Needs review</span><strong>{counts.needsReview}</strong><small><Link href="/app/accounting/review">Open</Link></small></article>
      <article className="kpi-card"><span>Ready</span><strong>{counts.ready}</strong><small><Link href="/app/accounting/ready-to-sync">Open</Link></small></article>
      <article className="kpi-card"><span>Synced</span><strong>{counts.synced}</strong><small><Link href="/app/accounting/synced">Open</Link></small></article>
      <article className="kpi-card"><span>Errors</span><strong>{counts.errors}</strong><small><Link href="/app/accounting/errors">Retry</Link></small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Sources</h2>
        <ul className="plain-list">
          <li>Cards: {counts.card} · <Link href="/app/accounting/card">View</Link></li>
          <li>Reimbursements: {counts.reimbursement} · <Link href="/app/accounting/reimbursements">View</Link></li>
          <li>Bills: {counts.bill} · <Link href="/app/accounting/bill-pay">View</Link></li>
          <li>Payments: {counts.payment}</li>
        </ul>
        <div className="detail-actions">
          {canSync && counts.ready > 0 && (
            <button className="btn btn-primary" type="button" disabled={syncAll.isPending} onClick={() => syncAll.mutate()}>
              Sync all ready
            </button>
          )}
          {canCode && <Link className="btn btn-ghost" href="/app/accounting/rules">Manage rules</Link>}
          {canCode && <Link className="btn btn-ghost" href="/app/accounting/integrations">Integrations</Link>}
        </div>
      </section>
      <section className="work-panel">
        <h2>Lifecycle</h2>
        <p className="muted">NEEDS_REVIEW → READY_TO_SYNC → SYNCING → SYNCED. Errors return to retry without a second ERP id.</p>
      </section>
    </div>
  </div>;
}
