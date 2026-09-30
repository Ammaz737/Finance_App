"use client";

import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import {
  accountingMoney,
  accountingSourceLabel,
  type AccountingRow,
} from "@/lib/accounting-list";

function ReadyContent() {
  const columns: Column<AccountingRow>[] = [
    {
      key: "sourceType",
      header: "Entry",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{accountingSourceLabel(row.sourceType)}</strong>
          <small>{row.category?.trim() || "Ready for ERP export"}</small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => accountingMoney(row.currency ?? "USD", row.amount),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.category || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  return (
    <div className="accounting-queue-page">
      <ResourcePage
        title="Ready to sync"
        path="accounting"
        columns={columns}
        pageSize={25}
        filter={{ status: ["READY_TO_SYNC"] }}
        actions={[
          { label: "Undo ready", name: "undo-ready" },
          { label: "Sync", name: "sync" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Sync one row here or use <strong>Sync all ready</strong> on{" "}
        <Link className="detail-link" href="/app/accounting/overview">
          Overview
        </Link>
        . Undo ready returns the entry to coding.
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading ready queue…</p>}>
      <ReadyContent />
    </Suspense>
  );
}
