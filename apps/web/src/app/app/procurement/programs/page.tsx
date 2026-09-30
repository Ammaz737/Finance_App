"use client";

import Link from "next/link";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type ProgramRow = {
  id: string;
  name?: string;
  description?: string;
  defaultOutcomeType?: string;
  status?: string;
  requireReceiving?: boolean;
  matchTolerancePct?: number | string;
};

function outcomeLabel(value?: string) {
  if (value === "VIRTUAL_CARD") return "Virtual card";
  if (value === "VENDOR_SETUP") return "Vendor setup";
  if (value === "PURCHASE_ORDER") return "Purchase order";
  return value || "—";
}

export default function ProcurementProgramsPage() {
  const columns: Column<ProgramRow>[] = [
    {
      key: "name",
      header: "Program",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Intake program"}</strong>
          <small>{row.description?.trim() ? row.description.slice(0, 70) : "Routes purchase requests to reviewers"}</small>
        </span>
      ),
    },
    {
      key: "defaultOutcomeType",
      header: "Default outcome",
      render: (row) => outcomeLabel(row.defaultOutcomeType),
    },
    {
      key: "requireReceiving",
      header: "Receiving",
      render: (row) => (row.requireReceiving === false ? "Optional" : "Required"),
    },
    {
      key: "matchTolerancePct",
      header: "Match tolerance",
      render: (row) => {
        const pct = Number(row.matchTolerancePct);
        if (!Number.isFinite(pct)) return "—";
        return `${(pct * 100).toFixed(pct < 0.01 ? 2 : 1)}%`;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "ACTIVE"} />,
    },
  ];

  return (
    <div className="procurement-programs-page">
      <ResourcePage title="Procurement programs" path="procurement-programs" columns={columns} pageSize={20} />
      <p className="muted my-expenses-hint">
        Active programs appear when creating procurement requests. After approval, fulfillment continues in{" "}
        <Link className="detail-link" href="/app/procurement/requests">
          Requests
        </Link>{" "}
        and{" "}
        <Link className="detail-link" href="/app/procurement/purchase-orders">
          Purchase orders
        </Link>
        .
      </p>
    </div>
  );
}
