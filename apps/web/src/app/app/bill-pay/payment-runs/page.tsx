"use client";

import "@/components/personal-work.css";
import "@/components/spend-ui.css";
import "@/components/bill-pay-ui.css";
import { BillPayOverview } from "@/components/BillPayPresentation";
import { SpendIntro, SpendRecord, SpendOpenLink } from "@/components/SpendPresentation";

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
        <SpendRecord title={row.name || "Payment run"} subtitle={row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "Batch release gate"} href={`/app/bill-pay/payment-runs/${row.id}`} icon="Payment runs"/>
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
      render: (row) => <SpendOpenLink href={`/app/bill-pay/payment-runs/${row.id}`} label="Open payment run"/>,
    },
  ];

  return (
    <div className="payment-runs-page personal-work-page spend-ui-page bill-pay-ui-page">
      <ResourcePage subtitle="Prepare and release batches of scheduled payments." overview={(rows, loading) => <BillPayOverview kind="runs" rows={rows} loading={loading}/>} listIntro={<SpendIntro title="Payment batches" description="Manage batch preparation and the separate release gate."/>}
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
