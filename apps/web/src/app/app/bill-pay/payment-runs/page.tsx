"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type RunRow = {
  id: string;
  name?: string;
  status?: string;
  legalEntityId?: string;
  createdBy?: string;
  createdAt?: string;
};

export default function PaymentRunsPage() {
  const router = useRouter();

  const columns: Column<RunRow>[] = [
    {
      key: "name",
      header: "Run",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Payment run"}</strong>
          <small>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "Batch release gate"}</small>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
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
    <div className="payment-runs-page">
      <ResourcePage
        title="Payment runs"
        path="payment-runs"
        columns={columns}
        pageSize={20}
        myWorkFilters
        needsActionStatuses={["OPEN"]}
        onRowNavigate={(row) => router.push(`/app/bill-pay/payment-runs/${row.id}`)}
        onCreated={(row) => router.push(`/app/bill-pay/payment-runs/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Create an empty OPEN run, add already-scheduled payments for the same entity, then have a different user release.
        Schedule payments from approved{" "}
        <Link className="detail-link" href="/app/bill-pay/bills?stage=payment">
          bills
        </Link>{" "}
        first — bills do not appear in a run until a payment exists.
      </p>
    </div>
  );
}
