"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type RequestRow = {
  id: string;
  name?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  fulfillmentType?: string;
  policyResult?: string;
  purpose?: string;
  createdAt?: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export default function MyRequestsPage() {
  const router = useRouter();
  const columns: Column<RequestRow>[] = [
    {
      key: "name",
      header: "Request",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Spend request"}</strong>
          <small>{row.purpose?.trim() ? row.purpose.slice(0, 60) : "No purpose yet"}</small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount ?? 0),
    },
    {
      key: "fulfillmentType",
      header: "Fulfillment",
      render: (row) => (row.fulfillmentType === "FUND_ONLY" ? "Fund only" : "Virtual card"),
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
    <div className="my-requests-page">
      <ResourcePage
        title="My requests"
        path="spend-requests"
        mineField="requesterId"
        columns={columns}
        pageSize={20}
        myWorkFilters
        onRowNavigate={(row) => router.push(`/app/spend/requests/${row.id}?from=mine`)}
      />
      <p className="muted my-expenses-hint">
        New requests submit for approval immediately. Use <strong>New</strong> and <strong>Needs action</strong> chips to
        find recent or blocked items. Virtual card fulfillment issues or tops up your single card after approval.{" "}
        <Link className="detail-link" href="/app/me/cards">
          My card →
        </Link>
      </p>
    </div>
  );
}
