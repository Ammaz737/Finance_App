"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
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
    card: rows.filter((row) =>
      ["CARD", "CARD_TRANSACTION", "EXPENSE"].includes(row.sourceType),
    ).length,
    reimbursement: rows.filter((row) => row.sourceType === "REIMBURSEMENT").length,
    bill: rows.filter((row) => row.sourceType === "BILL").length,
    payment: rows.filter((row) => row.sourceType === "PAYMENT").length,
  };

  const canSync = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("accounting.sync"),
  );
  const canCode = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("accounting.code"),
  );
  const canSeeRules = session
    ? canSeeItem(
        findNavItem("/app/accounting/rules") ?? { href: "/app/accounting/rules", permission: "accounting.read" },
        session,
      )
    : false;
  const canSeeIntegrations = session
    ? canSeeItem(
        findNavItem("/app/accounting/integrations") ?? {
          href: "/app/accounting/integrations",
          permission: "accounting.read",
        },
        session,
      )
    : false;
  const canSeeCompanyIntegrations = session
    ? canSeeItem(
        findNavItem("/app/company/integrations") ?? {
          href: "/app/company/integrations",
          permission: "report.read",
        },
        session,
      )
    : false;

  const syncAll = useMutation({
    mutationFn: () => api.post("/erp-sync", {}),
    onSuccess: () => {
      setMessage("Ready entries synced to mock ERP.");
      void queryClient.invalidateQueries({ queryKey: ["resource", "accounting"] });
    },
  });

  return (
    <div className="accounting-overview-page linked-dest-page stack-lg">
      <div className="resource-heading">
        <PageHeader
          title="Accounting queue"
          subtitle="One source row per event. Sync acknowledgement is idempotent — retries never duplicate ERP postings."
        />
        <div className="detail-actions-top">
          {canSync && counts.ready > 0 && (
            <button
              className="btn btn-primary"
              type="button"
              disabled={syncAll.isPending}
              onClick={() => syncAll.mutate()}
            >
              Sync all ready
            </button>
          )}
          {canCode && canSeeRules && (
            <Link className="btn btn-ghost" href="/app/accounting/rules">
              Manage rules
            </Link>
          )}
          {canSeeIntegrations && (
            <Link className="btn btn-ghost" href="/app/accounting/integrations">
              Integrations
            </Link>
          )}
        </div>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {entries.isError && (
        <div className="error-panel" role="alert">
          Could not load accounting queue.{" "}
          <button type="button" className="text-button" onClick={() => void entries.refetch()}>
            Try again
          </button>
        </div>
      )}
      {syncAll.isError && (
        <p className="error" role="alert">
          {syncAll.error.message}
        </p>
      )}

      <div className="overview-stat-grid">
        <Link href="/app/accounting/review" className="overview-stat primary">
          <span>Needs review</span>
          <strong>{entries.isPending ? "…" : counts.needsReview}</strong>
          <small>Code these entries first</small>
        </Link>
        <Link href="/app/accounting/ready-to-sync" className="overview-stat">
          <span>Ready to sync</span>
          <strong>{entries.isPending ? "…" : counts.ready}</strong>
          <small>Waiting for ERP export</small>
        </Link>
        <Link href="/app/accounting/synced" className="overview-stat">
          <span>Synced</span>
          <strong>{entries.isPending ? "…" : counts.synced}</strong>
          <small>Acknowledged by provider</small>
        </Link>
        <Link href="/app/accounting/errors" className="overview-stat">
          <span>Sync errors</span>
          <strong>{entries.isPending ? "…" : counts.errors}</strong>
          <small>Retry without duplicate ERP ids</small>
        </Link>
      </div>

      <div className="overview-split">
        <section className="overview-panel">
          <h2>Sources</h2>
          <Link href="/app/accounting/card">
            <span>Cards / expenses</span>
            <strong>{counts.card}</strong>
          </Link>
          <Link href="/app/accounting/reimbursements">
            <span>Reimbursements</span>
            <strong>{counts.reimbursement}</strong>
          </Link>
          <Link href="/app/accounting/bill-pay">
            <span>Bills</span>
            <strong>{counts.bill}</strong>
          </Link>
          <Link href="/app/accounting/bill-pay?source=PAYMENT">
            <span>Payments</span>
            <strong>{counts.payment}</strong>
          </Link>
        </section>
        <section className="overview-panel muted-panel">
          <h2>Lifecycle</h2>
          <p>NEEDS_REVIEW → READY_TO_SYNC → SYNCING → SYNCED.</p>
          <p>Errors return to retry without creating a second ERP posting id.</p>
          <div className="overview-panel-links">
            <Link href="/app/inbox">Inbox accounting tasks</Link>
            {canSeeCompanyIntegrations ? (
              <Link href="/app/company/integrations">Integration health</Link>
            ) : canSeeIntegrations ? (
              <Link href="/app/accounting/integrations">Accounting integrations</Link>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
