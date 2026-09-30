"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type Row = {
  id: string;
  type?: string;
  memo?: string;
  merchant?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  policyResult?: string;
  createdAt?: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export default function MyReimbursementsPage() {
  const router = useRouter();
  const columns: Column<Row>[] = [
    {
      key: "memo",
      header: "Reimbursement",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.memo?.trim() || `${row.type ?? "STANDARD"} reimbursement`}</strong>
          <small>{row.merchant || row.type || "Out-of-pocket"}</small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount ?? 0),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => row.type || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
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
    <div className="my-reimbursements-page">
      <ResourcePage
        title="My reimbursements"
        path="reimbursements"
        mineField="userId"
        columns={columns}
        pageSize={20}
        myWorkFilters
        onRowNavigate={(row) => router.push(`/app/expenses/reimbursements/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Create a draft, open it to attach a receipt (required for standard spend ≥ $75), then submit for approval.{" "}
        <Link className="detail-link" href="/app/me/expenses">
          Card expenses →
        </Link>
      </p>
    </div>
  );
}
