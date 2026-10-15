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
import { useSession } from "@/providers/session-provider";

type VendorRow = {
  id: string;
  name?: string;
  displayName?: string;
  category?: string;
  riskLevel?: string;
  status?: string;
  paymentStatus?: string;
  createdAt?: string;
};

export default function VendorsPage() {
  const router = useRouter();
  const session = useSession();
  const canSeeBills = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("bill.create") ||
      session?.permissions.includes("bill.read") ||
      session?.permissions.includes("bill.approve"),
  );

  const columns: Column<VendorRow>[] = [
    {
      key: "name",
      header: "Vendor",
      render: (row) => (
        <SpendRecord title={row.displayName || row.name || "Vendor"} subtitle={row.category?.trim() || "Counterparty"} href={`/app/vendors/${row.id}`} icon="Vendors"/>
      ),
    },
    {
      key: "riskLevel",
      header: "Risk",
      render: (row) => <StatusBadge status={row.riskLevel ?? "LOW"} />,
    },
    {
      key: "paymentStatus",
      header: "Payment ready",
      render: (row) => <StatusBadge status={row.paymentStatus ?? "NEEDS_BANK"} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "createdAt",
      header: "Added",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"),
    },
    {
      key: "open",
      header: "",
      render: (row) => <SpendOpenLink href={`/app/vendors/${row.id}`} label="Open vendor"/>,
    },
  ];

  return (
    <div className="vendors-page personal-work-page spend-ui-page bill-pay-ui-page">
      <ResourcePage subtitle="Manage vendor relationships, risk and payment readiness." overview={(rows, loading) => <BillPayOverview kind="vendors" rows={rows} loading={loading}/>} listIntro={<SpendIntro title="Vendor directory" description="Review vendor status and payment setup before paying invoices."/>}
        title="Vendors"
        path="vendors"
        columns={columns}
        pageSize={20}
        myWorkFilters
        needsActionStatuses={["INACTIVE"]}
        onRowNavigate={(row) => router.push(`/app/vendors/${row.id}`)}
        onCreated={(row) => router.push(`/app/vendors/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Open a vendor for bank details, bills, and purchase history.{" "}
        {canSeeBills ? (
          <>
            Create invoices in{" "}
            <Link className="detail-link" href="/app/bill-pay/bills">
              Bill Pay
            </Link>
            .
          </>
        ) : (
          "Payment readiness requires verified bank details."
        )}
      </p>
    </div>
  );
}
