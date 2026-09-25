"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";

type CardRow = { id: string; fundId?: string; last4?: string; type?: string; status?: string; [key: string]: unknown };
type FundRow = { id: string; name: string; availableAmount: string | number; currency: string };

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export default function Page() {
  const router = useRouter();
  const funds = useQuery({ queryKey: ["my-card-funds"], queryFn: () => api.get<FundRow[]>("/funds") });
  const fundById = new Map((funds.data ?? []).map((fund) => [fund.id, fund]));
  const columns: Column<CardRow>[] = [
    { key: "last4", header: "Card", render: (row) => `•••• ${row.last4 ?? "—"}` },
    { key: "type", header: "Type", render: (row) => String(row.type ?? "—").replaceAll("_", " ") },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} /> },
    { key: "fund", header: "Linked fund", render: (row) => fundById.get(row.fundId ?? "")?.name ?? "—" },
    { key: "available", header: "Available", render: (row) => {
      const fund = fundById.get(row.fundId ?? "");
      return fund ? money(fund.currency, fund.availableAmount) : "—";
    } },
    { key: "details", header: "Transactions", render: () => <span className="detail-link">View card activity →</span> },
  ];
  return <ResourcePage
    title="My cards"
    path="cards"
    mineField="holderId"
    columns={columns}
    pageSize={20}
    onRowNavigate={(row) => router.push(`/app/me/cards/${row.id}`)}
  />;
}
