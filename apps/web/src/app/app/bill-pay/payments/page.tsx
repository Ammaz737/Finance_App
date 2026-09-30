"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";

type PaymentRow = {
  id: string;
  billId?: string;
  amount?: string | number;
  currency?: string;
  rail?: string;
  status?: string;
  settlementId?: string | null;
  createdAt?: string;
};

type Bill = { id: string; invoiceNumber?: string };

function money(currency: string, value: string | number | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export default function PaymentsPage() {
  const router = useRouter();
  const bills = useQuery({
    queryKey: ["payment-bill-labels"],
    queryFn: async () => {
      try {
        return await api.get<Bill[]>("/bills");
      } catch {
        return [] as Bill[];
      }
    },
  });
  const billRows = bills.data ?? [];

  const columns: Column<PaymentRow>[] = [
    {
      key: "amount",
      header: "Payment",
      render: (row) => {
        const bill = billRows.find((item) => item.id === row.billId);
        return (
          <span className="inbox-table-request">
            <strong>{money(row.currency ?? "USD", row.amount)}</strong>
            <small>
              {row.rail || "ACH"}
              {bill?.invoiceNumber ? ` · ${bill.invoiceNumber}` : ""}
            </small>
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "settlementId",
      header: "Settlement",
      render: (row) => row.settlementId || "—",
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
    <div className="payments-page">
      <ResourcePage
        title="Payments"
        path="payments"
        columns={columns}
        pageSize={20}
        myWorkFilters
        needsActionStatuses={["SCHEDULED", "PROCESSING"]}
        onRowNavigate={(row) => router.push(`/app/bill-pay/payments/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Use <strong>Needs action</strong> for scheduled releases and in-flight settlement. Schedule from approved bills; batch via{" "}
        <Link className="detail-link" href="/app/bill-pay/payment-runs">
          Payment runs
        </Link>
        .
      </p>
    </div>
  );
}
