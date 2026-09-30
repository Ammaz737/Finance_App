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

function ErrorsContent() {
  const columns: Column<AccountingRow>[] = [
    {
      key: "sourceType",
      header: "Entry",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{accountingSourceLabel(row.sourceType)}</strong>
          <small>{row.syncError?.trim() ? row.syncError.slice(0, 72) : "Sync failed"}</small>
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
      key: "syncError",
      header: "Error",
      render: (row) => row.syncError || "—",
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Retry →</span>,
    },
  ];

  return (
    <div className="accounting-queue-page">
      <ResourcePage
        title="Sync errors"
        path="accounting"
        columns={columns}
        pageSize={25}
        filter={{ status: ["SYNC_ERROR"] }}
        actions={[
          { label: "Retry", name: "retry" },
          { label: "Mark ready", name: "ready" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Retry keeps the same ERP posting id. Fix coding first if needed, then mark ready. Queue health is on{" "}
        <Link className="detail-link" href="/app/accounting/overview">
          Overview
        </Link>
        .
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading sync errors…</p>}>
      <ErrorsContent />
    </Suspense>
  );
}
