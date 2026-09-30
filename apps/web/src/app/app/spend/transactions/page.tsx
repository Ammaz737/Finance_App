"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { useSession } from "@/providers/session-provider";

type TxnRow = {
  id: string;
  merchant?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  authorizedAt?: string;
  clearedAt?: string | null;
  cardId?: string | null;
  fundId?: string | null;
  memo?: string;
};

function money(currency: string, value: string | number | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function TransactionsContent() {
  const router = useRouter();
  const session = useSession();
  const privileged = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("card.issue") ||
      session?.permissions.includes("expense.approve"),
  );
  const canIssue = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("card.issue"),
  );

  const columns: Column<TxnRow>[] = [
    {
      key: "merchant",
      header: "Merchant",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.merchant || "Transaction"}</strong>
          <small>
            {row.authorizedAt
              ? new Date(row.authorizedAt).toLocaleString()
              : row.memo?.trim()
                ? row.memo.slice(0, 48)
                : "Card activity"}
          </small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "clearedAt",
      header: "Cleared",
      render: (row) => (row.clearedAt ? new Date(row.clearedAt).toLocaleDateString() : "—"),
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  return (
    <div className="spend-transactions-page">
      <ResourcePage
        title="Transactions"
        path="transactions"
        columns={columns}
        pageSize={25}
        myWorkFilters
        needsActionStatuses={["PENDING"]}
        onRowNavigate={(row) => router.push(`/app/spend/transactions/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        {privileged
          ? "Pending holds need capture or void in sandbox. Cleared spend links to expenses for receipt and memo. "
          : "You see activity on your own cards. Open a row for card, fund, and expense links. "}
        <Link className="detail-link" href={canIssue ? "/app/cards" : "/app/me/cards"}>
          {canIssue ? "Corporate cards →" : "My card →"}
        </Link>
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading transactions…</p>}>
      <TransactionsContent />
    </Suspense>
  );
}
