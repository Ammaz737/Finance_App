"use client";

import "@/components/personal-work.css";
import "@/components/spend-ui.css";
import "@/components/expenses-ui.css";
import { ExpenseOverview } from "@/components/ExpensePresentation";
import { SpendIntro, SpendRecord, SpendOpenLink } from "@/components/SpendPresentation";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type ReceiptRow = {
  id: string;
  merchantGuess?: string | null;
  amountGuess?: string | number | null;
  matchStatus?: string;
  ocrStatus?: string;
  expenseId?: string | null;
  transactionId?: string | null;
  createdAt?: string;
};

function moneyGuess(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
}

function ReceiptsContent() {
  const router = useRouter();
  const search = useSearchParams();
  const match = search.get("match");
  const matchFilter = match === "UNMATCHED" || match === "MATCHED" ? match : null;

  const columns: Column<ReceiptRow>[] = [
    {
      key: "merchantGuess",
      header: "Receipt",
      render: (row) => (
        <SpendRecord title={row.merchantGuess?.trim() || "Receipt upload"} subtitle={`${row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}${row.expenseId ? " · Linked to expense" : " · Needs linking"}`} href={row.expenseId ? `/app/expenses/${row.expenseId}` : `/app/expenses/receipts/${row.id}`} icon="Receipts"/>
      ),
    },
    {
      key: "amountGuess",
      header: "Amount guess",
      render: (row) => moneyGuess(row.amountGuess),
    },
    {
      key: "matchStatus",
      header: "Match",
      render: (row) => <StatusBadge status={row.matchStatus ?? "UNKNOWN"} />,
    },
    {
      key: "ocrStatus",
      header: "OCR",
      render: (row) => <StatusBadge status={row.ocrStatus ?? "UNKNOWN"} />,
    },
    {
      key: "expenseId",
      header: "Expense",
      render: (row) => (row.expenseId ? <span className="req-ok">Linked</span> : <span className="req-missing">Unlinked</span>),
    },
    {
      key: "open",
      header: "",
      render: (row) => (
        <SpendOpenLink href={row.expenseId ? `/app/expenses/${row.expenseId}` : `/app/expenses/receipts/${row.id}`} label={row.expenseId ? "Open expense" : "Link receipt"}/>
      ),
    },
  ];

  return (
    <div className="receipts-page personal-work-page spend-ui-page expenses-ui-page">

      <ResourcePage
        subtitle="Organize receipt uploads and match them to the right expenses."
        overview={(rows, loading) => <ExpenseOverview kind="receipts" rows={rows} loading={loading}/>}
        listIntro={<><SpendIntro title="Receipt library" description="Track matching and extraction status across your receipt records."/><div className="my-work-filters" role="toolbar" aria-label="Receipt match filters">
        <Link
          className={`chip${!matchFilter ? " chip-active" : ""}`}
          href="/app/expenses/receipts"
        >
          All
        </Link>
        <Link
          className={`chip${matchFilter === "UNMATCHED" ? " chip-active" : ""}`}
          href="/app/expenses/receipts?match=UNMATCHED"
        >
          Unmatched
        </Link>
        <Link
          className={`chip${matchFilter === "MATCHED" ? " chip-active" : ""}`}
          href="/app/expenses/receipts?match=MATCHED"
        >
          Matched
        </Link>
      </div></>}
        title="Receipts"
        path="receipts"
        columns={columns}
        pageSize={20}
        filter={
          matchFilter === "UNMATCHED"
            ? { matchStatus: ["UNMATCHED"] }
            : matchFilter === "MATCHED"
              ? { matchStatus: ["MATCHED"] }
              : undefined
        }
        onRowNavigate={(row) => {
          if (typeof row.expenseId === "string" && row.expenseId) {
            router.push(`/app/expenses/${row.expenseId}`);
          } else {
            router.push(`/app/expenses/receipts/${row.id}`);
          }
        }}
      />
      <p className="muted my-expenses-hint">
        Unmatched receipts open the linker. Linked rows go to the expense. Employees attach from{" "}
        <Link className="detail-link" href="/app/me/expenses">
          My expenses
        </Link>
        .
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading receipts…</p>}>
      <ReceiptsContent />
    </Suspense>
  );
}
