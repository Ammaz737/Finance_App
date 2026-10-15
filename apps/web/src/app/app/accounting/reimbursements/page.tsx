"use client";

import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge, type Column } from "@finance/design-system";
import { AccountingOverview } from "@/components/AccountingPresentation";
import { SpendIntro } from "@/components/SpendPresentation";
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
    <div className="accounting-queue-page personal-work-page spend-ui-page accounting-reimbursements-page">
      <ResourcePage
        subtitle="Accounting entries created after reimbursement payout."
        overview={(rows, loading) => <AccountingOverview kind="entries" rows={rows} loading={loading}/>}
        listIntro={<SpendIntro title="Reimbursement entries" description="Accounting entries created after reimbursement payout."/>}
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
