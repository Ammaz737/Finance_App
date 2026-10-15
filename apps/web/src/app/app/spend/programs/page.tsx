"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { SpendIntro, SpendOverview, SpendRecord, SpendOpenLink } from "@/components/SpendPresentation";
import "@/components/personal-work.css";
import "@/components/spend-ui.css";

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
      render: (row) => <SpendRecord title={row.name || "Spend program"} subtitle={row.description?.trim() ? row.description.slice(0, 70) : "Controls max amount and card defaults"} href={`/app/spend/programs/${row.id}`} icon="Spend programs"/>,
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
      render: (row) => <SpendOpenLink href={`/app/spend/programs/${row.id}`} label={`Open record ${row.name || row.id}`}/>,
    },
  ];

  return (
    <div className="spend-programs-page personal-work-page spend-ui-page">
      <ResourcePage
        title="Spend programs"
        subtitle="Manage spending limits, merchant restrictions and card defaults."
        overview={(rows, loading) => <SpendOverview kind="programs" rows={rows} loading={loading}/>}
        listIntro={<SpendIntro title="Program directory" description="Review the controls employees use when requesting company funds."/>}
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
