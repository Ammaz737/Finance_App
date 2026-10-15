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

function BankingAccountingContent() {
  const columns: Column<AccountingRow>[] = [
    {
      key: "sourceType",
      header: "Entry",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{accountingSourceLabel(row.sourceType)}</strong>
          <small>{row.category?.trim() || "Bank / treasury source"}</small>
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
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  return (
    <div className="accounting-queue-page personal-work-page spend-ui-page accounting-banking-page">
      <ResourcePage
        subtitle="Bank and treasury postings in one place."
        overview={(rows, loading) => <AccountingOverview kind="entries" rows={rows} loading={loading}/>}
        listIntro={<SpendIntro title="Banking entries" description="Bank and treasury postings in one place."/>}
        title="Banking accounting"
        path="accounting"
        columns={columns}
        pageSize={25}
        filter={{ sourceType: ["BANK", "BANK_TRANSFER"] }}
      />
      <p className="muted my-expenses-hint">
        Bank transfer postings when treasury is enabled. Main queues stay under{" "}
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
    <Suspense fallback={<p className="muted">Loading banking accounting…</p>}>
      <BankingAccountingContent />
    </Suspense>
  );
}
