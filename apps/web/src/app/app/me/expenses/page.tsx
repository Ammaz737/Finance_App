"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type ExpenseRow = {
  id: string;
  merchant?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  policyResult?: string;
  createdAt?: string;
  receiptId?: string | null;
  memo?: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export default function MyExpensesPage() {
  const router = useRouter();
  const columns: Column<ExpenseRow>[] = [
    {
      key: "merchant",
      header: "Merchant",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.merchant || "Expense"}</strong>
          <small>{row.memo?.trim() ? row.memo.slice(0, 60) : "Add business purpose"}</small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount ?? 0),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "receipt",
      header: "Receipt",
      render: (row) => (row.receiptId ? <span className="req-ok">Attached</span> : <span className="req-missing">Missing</span>),
    },
    {
      key: "policyResult",
      header: "Policy",
      render: (row) => row.policyResult || "—",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"),
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  return (
    <div className="my-expenses-page">
      <ResourcePage
        title="My expenses"
        path="expenses"
        mineField="userId"
        columns={columns}
        pageSize={20}
        myWorkFilters
        onRowNavigate={(row) => router.push(`/app/expenses/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Card charges create incomplete expenses here. Complete memo + receipt, then submit for approval.{" "}
        <Link className="detail-link" href="/app/me/cards">
          My card →
        </Link>
      </p>
    </div>
  );
}
