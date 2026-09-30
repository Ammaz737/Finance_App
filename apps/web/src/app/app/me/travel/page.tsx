"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type TravelRow = {
  id: string;
  name?: string;
  destination?: string;
  origin?: string;
  purpose?: string;
  status?: string;
  policyResult?: string;
  estimatedAmount?: string | number;
  currency?: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
};

function money(currency: string, value: string | number | null | undefined) {
  if (value == null) return "—";
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function MyTravelPage() {
  const router = useRouter();
  const columns: Column<TravelRow>[] = [
    {
      key: "name",
      header: "Trip",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Trip"}</strong>
          <small>
            {row.origin ? `${row.origin} → ` : ""}
            {row.destination || "Destination TBD"}
            {row.purpose?.trim() ? ` · ${row.purpose.slice(0, 40)}` : ""}
          </small>
        </span>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      render: (row) => `${fmtDate(row.startDate)} – ${fmtDate(row.endDate)}`,
    },
    {
      key: "estimatedAmount",
      header: "Estimate",
      render: (row) => money(row.currency ?? "USD", row.estimatedAmount),
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
    <div className="my-travel-page">
      <ResourcePage
        title="My travel"
        path="travel"
        mineField="travelerId"
        columns={columns}
        pageSize={20}
        myWorkFilters
        actions={[{ label: "Submit", name: "submit" }]}
        onRowNavigate={(row) => router.push(`/app/travel/trips/${row.id}?from=mine`)}
      />
      <p className="muted my-expenses-hint">
        Draft a trip, search quotes from the trip page, then submit for approval. Use{" "}
        <strong>New</strong> to spot trips from the last 7 days, or <strong>Needs action</strong> for drafts and bookings.{" "}
        <Link className="detail-link" href="/app/travel/search">
          Travel search →
        </Link>{" "}
        <Link className="detail-link" href="/app/travel/trips">
          All trips →
        </Link>
      </p>
    </div>
  );
}
