"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { SpendIntro, SpendOverview, SpendRecord, SpendOpenLink } from "@/components/SpendPresentation";
import "@/components/personal-work.css";
import "@/components/spend-ui.css";
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
      render: (row) => <SpendRecord title={row.merchant || "Transaction"} subtitle={row.authorizedAt ? new Date(row.authorizedAt).toLocaleString() : row.memo?.trim() ? row.memo.slice(0, 48) : "Card activity"} href={`/app/spend/transactions/${row.id}`} icon="Transactions"/>,
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
      render: (row) => <SpendOpenLink href={`/app/spend/transactions/${row.id}`} label={`Open record ${row.merchant || row.id}`}/>,
    },
  ];

  return (
    <div className="spend-transactions-page personal-work-page spend-ui-page">
      <ResourcePage
        title="Transactions"
        subtitle="Track card authorizations, cleared payments and linked expenses."
        overview={(rows, loading) => <SpendOverview kind="transactions" rows={rows} loading={loading}/>}
        listIntro={<SpendIntro title="Transaction activity" description="Review merchants, payment amounts and settlement status."/>}
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
