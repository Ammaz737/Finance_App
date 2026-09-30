"use client";

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
        <span className="inbox-table-request">
          <strong>{row.merchantGuess?.trim() || "Receipt upload"}</strong>
          <small>
            {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
            {row.expenseId ? " · Linked to expense" : " · Needs linking"}
          </small>
        </span>
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
        <span className="detail-link">{row.expenseId ? "Open expense →" : "Link →"}</span>
      ),
    },
  ];

  return (
    <div className="receipts-page">
      <div className="my-work-filters" role="toolbar" aria-label="Receipt match filters">
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
      </div>
      <ResourcePage
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
