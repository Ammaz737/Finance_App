"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";

type PoRow = {
  id: string;
  number?: string;
  vendorId?: string;
  amount?: string | number;
  receivedAmount?: string | number;
  billedAmount?: string | number;
  currency?: string;
  status?: string;
  matchStatus?: string;
  createdAt?: string;
};

type Vendor = { id: string; name?: string };

function money(currency: string, value: string | number | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function vendorLabel(vendors: Vendor[], id?: string) {
  if (!id) return "—";
  return vendors.find((row) => row.id === id)?.name || id.slice(0, 8);
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const vendors = useQuery({
    queryKey: ["po-vendor-labels"],
    queryFn: async () => {
      try {
        return await api.get<Vendor[]>("/vendors");
      } catch {
        return [] as Vendor[];
      }
    },
  });
  const vendorRows = vendors.data ?? [];

  const columns: Column<PoRow>[] = [
    {
      key: "number",
      header: "Purchase order",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.number || "PO"}</strong>
          <small>{vendorLabel(vendorRows, row.vendorId)}</small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount),
    },
    {
      key: "receivedAmount",
      header: "Received",
      render: (row) => money(row.currency ?? "USD", row.receivedAmount),
    },
    {
      key: "billedAmount",
      header: "Billed",
      render: (row) => money(row.currency ?? "USD", row.billedAmount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "matchStatus",
      header: "Match",
      render: (row) => <StatusBadge status={row.matchStatus ?? "—"} />,
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  return (
    <div className="procurement-pos-page">
      <ResourcePage
        title="Purchase orders"
        path="purchase-orders"
        columns={columns}
        pageSize={20}
        myWorkFilters
        needsActionStatuses={["ISSUED", "OPEN", "PARTIALLY_RECEIVED"]}
        onRowNavigate={(row) => router.push(`/app/procurement/purchase-orders/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Needs action covers issued and partially received POs. Record goods in{" "}
        <Link className="detail-link" href="/app/procurement/receiving">
          Receiving
        </Link>{" "}
        and clear variances in{" "}
        <Link className="detail-link" href="/app/procurement/match-exceptions">
          Match exceptions
        </Link>
        .
      </p>
    </div>
  );
}
