"use client";

import "@/components/personal-work.css";
import "@/components/spend-ui.css";
import "@/components/procurement-ui.css";
import { ProcurementOverview } from "@/components/ProcurementPresentation";
import { SpendIntro, SpendRecord, SpendOpenLink } from "@/components/SpendPresentation";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";

type ReceivingRow = {
  id: string;
  purchaseOrderId?: string;
  amount?: string | number;
  memo?: string;
  receivedBy?: string;
  createdAt?: string;
  currency?: string;
};

type Po = { id: string; number?: string };
type Person = { id: string; firstName?: string; lastName?: string; email?: string };

function money(currency: string, value: string | number | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function personLabel(people: Person[], id?: string) {
  if (!id) return "—";
  const person = people.find((row) => row.id === id);
  if (!person) return id.slice(0, 8);
  const name = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
  return name || person.email || id.slice(0, 8);
}

export default function ReceivingPage() {
  const router = useRouter();
  const pos = useQuery({
    queryKey: ["receiving-po-labels"],
    queryFn: async () => {
      try {
        return await api.get<Po[]>("/purchase-orders");
      } catch {
        return [] as Po[];
      }
    },
  });
  const people = useQuery({
    queryKey: ["receiving-people-labels"],
    queryFn: async () => {
      try {
        return await api.get<Person[]>("/people");
      } catch {
        return [] as Person[];
      }
    },
  });
  const poRows = pos.data ?? [];
  const peopleRows = people.data ?? [];

  const columns: Column<ReceivingRow>[] = [
    {
      key: "purchaseOrderId",
      header: "Purchase order",
      render: (row) => {
        const po = poRows.find((item) => item.id === row.purchaseOrderId);
        return (
          row.purchaseOrderId ? <SpendRecord title={po?.number || (row.purchaseOrderId ? row.purchaseOrderId.slice(0, 8) : "PO")} subtitle={row.memo?.trim() ? row.memo.slice(0, 56) : "Goods / services receipt"} href={`/app/procurement/purchase-orders/${row.purchaseOrderId}`} icon="Receiving"/> : <span className="inbox-table-request"><strong>{po?.number || (row.purchaseOrderId ? row.purchaseOrderId.slice(0, 8) : "PO")}</strong><small>{row.memo?.trim() ? row.memo.slice(0, 56) : "Goods / services receipt"}</small></span>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount),
    },
    {
      key: "receivedBy",
      header: "Received by",
      render: (row) => personLabel(peopleRows, row.receivedBy),
    },
    {
      key: "createdAt",
      header: "When",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"),
    },
    {
      key: "open",
      header: "",
      render: (row) => row.purchaseOrderId ? <SpendOpenLink href={`/app/procurement/purchase-orders/${row.purchaseOrderId}`} label="Open purchase order"/> : <span className="muted">—</span>,
    },
  ];

  return (
    <div className="procurement-receiving-page personal-work-page spend-ui-page procurement-ui-page">
      <ResourcePage subtitle="Record goods and services received against purchase orders." overview={(rows, loading) => <ProcurementOverview kind="receiving" rows={rows} loading={loading}/>} listIntro={<SpendIntro title="Receiving register" description="Track deliveries, receipt amounts and the people recording them."/>}
        title="Receiving"
        path="receiving"
        columns={columns}
        pageSize={20}
        onRowNavigate={(row) => {
          if (typeof row.purchaseOrderId === "string" && row.purchaseOrderId) {
            router.push(`/app/procurement/purchase-orders/${row.purchaseOrderId}`);
          }
        }}
      />
      <p className="muted my-expenses-hint">
        Record receipts here or from a PO detail. Open a row to return to the{" "}
        <Link className="detail-link" href="/app/procurement/purchase-orders">
          purchase order
        </Link>
        . Variances surface in{" "}
        <Link className="detail-link" href="/app/procurement/match-exceptions">
          Match exceptions
        </Link>
        .
      </p>
    </div>
  );
}
