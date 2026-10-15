"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { AccountingOverview } from "@/components/AccountingPresentation";
import { SpendIntro } from "@/components/SpendPresentation";
import { ResourcePage } from "@/components/ResourcePage";
import {
  accountingMoney,
  accountingSourceLabel,
  type AccountingRow,
} from "@/lib/accounting-list";

function BillPayAccountingContent() {
  const search = useSearchParams();
  const source = search.get("source");
  const sourceFilter =
    source === "PAYMENT" ? ["PAYMENT"] : source === "BILL" ? ["BILL"] : ["BILL", "PAYMENT"];
  const title =
    source === "PAYMENT" ? "Payment accounting" : source === "BILL" ? "Bill accounting" : "Bill Pay accounting";

  const columns: Column<AccountingRow>[] = [
    {
      key: "sourceType",
      header: "Entry",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{accountingSourceLabel(row.sourceType)}</strong>
          <small>{row.category?.trim() || row.memo?.trim() || "AP source"}</small>
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
    <div className="accounting-queue-page personal-work-page spend-ui-page accounting-bill-pay-page">
      <ResourcePage
        subtitle="Code and sync your accounts payable activity."
        overview={(rows, loading) => <AccountingOverview kind="entries" rows={rows} loading={loading}/>}
        listIntro={<>
          <SpendIntro title="Bill & payment entries" description="Code and sync your accounts payable activity."/>
          <div className="my-work-filters" role="toolbar" aria-label="Bill Pay source filters">
        <Link className={`chip${!source ? " chip-active" : ""}`} href="/app/accounting/bill-pay">
          All
        </Link>
        <Link
          className={`chip${source === "BILL" ? " chip-active" : ""}`}
          href="/app/accounting/bill-pay?source=BILL"
        >
          Bills
        </Link>
        <Link
          className={`chip${source === "PAYMENT" ? " chip-active" : ""}`}
          href="/app/accounting/bill-pay?source=PAYMENT"
        >
          Payments
        </Link>
          </div>
        </>}
        title={title}
        path="accounting"
        columns={columns}
        pageSize={25}
        filter={{ sourceType: sourceFilter }}
        actions={[
          { label: "Mark ready", name: "ready" },
          { label: "Sync", name: "sync" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Operational documents live in{" "}
        <Link className="detail-link" href="/app/bill-pay/bills">
          Bill Pay
        </Link>
        . Coding still happens from the row drawer here.
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading Bill Pay accounting…</p>}>
      <BillPayAccountingContent />
    </Suspense>
  );
}
