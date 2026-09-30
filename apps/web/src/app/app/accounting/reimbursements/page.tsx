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

function ReimbursementAccountingContent() {
  const columns: Column<AccountingRow>[] = [
    {
      key: "sourceType",
      header: "Entry",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{accountingSourceLabel(row.sourceType)}</strong>
          <small>{row.category?.trim() || row.memo?.trim() || "Reimbursement source"}</small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => accountingMoney(row.currency ?? "USD", row.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.category || "—",
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
        title="Reimbursement accounting"
        path="accounting"
        columns={columns}
        pageSize={25}
        filter={{ sourceType: ["REIMBURSEMENT"] }}
        actions={[
          { label: "Mark ready", name: "ready" },
          { label: "Sync", name: "sync" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Created after reimbursement payout. Operational queue:{" "}
        <Link className="detail-link" href="/app/expenses/reimbursements">
          Reimbursements
        </Link>
        .
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading reimbursement accounting…</p>}>
      <ReimbursementAccountingContent />
    </Suspense>
  );
}
