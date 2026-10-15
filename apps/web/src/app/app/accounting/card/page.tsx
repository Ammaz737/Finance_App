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

function CardAccountingContent() {
  const columns: Column<AccountingRow>[] = [
    {
      key: "sourceType",
      header: "Entry",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{accountingSourceLabel(row.sourceType)}</strong>
          <small>{row.category?.trim() || row.memo?.trim() || "Card / expense source"}</small>
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
    <div className="accounting-queue-page personal-work-page spend-ui-page accounting-card-page">
      <ResourcePage
        subtitle="Card purchases and expenses in the accounting queue."
        overview={(rows, loading) => <AccountingOverview kind="entries" rows={rows} loading={loading}/>}
        listIntro={<SpendIntro title="Card & expense entries" description="Card purchases and expenses in the accounting queue."/>}
        title="Card accounting"
        path="accounting"
        columns={columns}
        pageSize={25}
        filter={{ sourceType: ["CARD_TRANSACTION", "CARD", "EXPENSE"] }}
        actions={[
          { label: "Mark ready", name: "ready" },
          { label: "Sync", name: "sync" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Card and expense postings. Incomplete coding also appears in{" "}
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
    <Suspense fallback={<p className="muted">Loading card accounting…</p>}>
      <CardAccountingContent />
    </Suspense>
  );
}
