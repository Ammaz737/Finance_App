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

function ReviewContent() {
  const columns: Column<AccountingRow>[] = [
    {
      key: "sourceType",
      header: "Entry",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{accountingSourceLabel(row.sourceType)}</strong>
          <small>
            {row.category?.trim() || row.memo?.trim() || (row.sourceId ? `Source ${row.sourceId.slice(0, 8)}` : "Needs coding")}
          </small>
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
      key: "updatedAt",
      header: "Updated",
      render: (row) =>
        row.updatedAt
          ? new Date(row.updatedAt).toLocaleDateString()
          : row.createdAt
            ? new Date(row.createdAt).toLocaleDateString()
            : "—",
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Code →</span>,
    },
  ];

  return (
    <div className="accounting-queue-page">
      <ResourcePage
        title="Needs review"
        path="accounting"
        columns={columns}
        pageSize={25}
        filter={{ status: ["NEEDS_REVIEW"] }}
        actions={[
          { label: "Mark ready", name: "ready" },
          { label: "Retry", name: "retry" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Open a row to code category / GL, then mark ready. Sync errors are handled in{" "}
        <Link className="detail-link" href="/app/accounting/errors">
          Sync errors
        </Link>
        . Auto-coding rules live in{" "}
        <Link className="detail-link" href="/app/accounting/rules">
          Rules
        </Link>
        .
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading accounting review…</p>}>
      <ReviewContent />
    </Suspense>
  );
}
