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

function SyncedContent() {
  const columns: Column<AccountingRow>[] = [
    {
      key: "sourceType",
      header: "Entry",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{accountingSourceLabel(row.sourceType)}</strong>
          <small>{row.externalId ? `ERP ${row.externalId}` : row.category || "Synced"}</small>
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
      key: "externalId",
      header: "External id",
      render: (row) => row.externalId || "—",
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
    <div className="accounting-queue-page personal-work-page spend-ui-page accounting-synced-page">
      <ResourcePage
        subtitle="Acknowledged postings and their provider references."
        overview={(rows, loading) => <AccountingOverview kind="entries" rows={rows} loading={loading}/>}
        listIntro={<SpendIntro title="Synced entries" description="Acknowledged postings and their provider references."/>}
        title="Synced"
        path="accounting"
        columns={columns}
        pageSize={25}
        filter={{ status: ["SYNCED"] }}
      />
      <p className="muted my-expenses-hint">
        Acknowledged postings keep a stable external id so retries never duplicate. Active work continues in{" "}
        <Link className="detail-link" href="/app/accounting/review">
          Needs review
        </Link>
        .
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading synced entries…</p>}>
      <SyncedContent />
    </Suspense>
  );
}
