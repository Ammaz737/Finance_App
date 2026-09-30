"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type ProgramRow = {
  id: string;
  name?: string;
  description?: string;
  maxAmount?: string | number;
  currency?: string;
  defaultFulfillmentType?: string;
  status?: string;
  merchantLockDefault?: string | null;
};

function money(currency: string, value: string | number | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export default function SpendProgramsPage() {
  const router = useRouter();
  const columns: Column<ProgramRow>[] = [
    {
      key: "name",
      header: "Program",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Spend program"}</strong>
          <small>{row.description?.trim() ? row.description.slice(0, 70) : "Controls max amount and card defaults"}</small>
        </span>
      ),
    },
    {
      key: "maxAmount",
      header: "Max request",
      render: (row) => money(row.currency ?? "USD", row.maxAmount),
    },
    {
      key: "defaultFulfillmentType",
      header: "Fulfillment",
      render: (row) => (row.defaultFulfillmentType === "FUND_ONLY" ? "Fund only" : "Virtual card"),
    },
    {
      key: "merchantLockDefault",
      header: "Merchant lock",
      render: (row) => row.merchantLockDefault || "—",
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
    <div className="spend-programs-page">
      <ResourcePage
        title="Spend programs"
        path="spend-programs"
        columns={columns}
        pageSize={20}
        actions={[{ label: "Deactivate", name: "deactivate" }]}
        onRowNavigate={(row) => router.push(`/app/spend/programs/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Active programs appear when employees create spend requests. Link a budget on create to track capacity.{" "}
        <Link className="detail-link" href="/app/insights/budgets">
          Budgets →
        </Link>{" "}
        <Link className="detail-link" href="/app/me/requests">
          My requests →
        </Link>
      </p>
    </div>
  );
}
