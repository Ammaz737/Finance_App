"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";

type RequestRow = {
  id: string;
  name?: string;
  purpose?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  fulfillmentType?: string;
  policyResult?: string;
  requesterId?: string;
  createdAt?: string;
};

type Person = { id: string; firstName?: string; lastName?: string; email?: string };

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function personLabel(people: Person[], id?: string) {
  if (!id) return "—";
  const person = people.find((row) => row.id === id);
  if (!person) return id.slice(0, 8);
  const name = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
  return name || person.email || id.slice(0, 8);
}

export default function SpendRequestsPage() {
  const router = useRouter();
  const people = useQuery({
    queryKey: ["spend-request-people-labels"],
    queryFn: async () => {
      try {
        return await api.get<Person[]>("/people");
      } catch {
        return [] as Person[];
      }
    },
  });
  const peopleRows = people.data ?? [];

  const columns: Column<RequestRow>[] = [
    {
      key: "name",
      header: "Request",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Spend request"}</strong>
          <small>{row.purpose?.trim() ? row.purpose.slice(0, 60) : "No purpose yet"}</small>
        </span>
      ),
    },
    {
      key: "requesterId",
      header: "Requester",
      render: (row) => personLabel(peopleRows, row.requesterId),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount ?? 0),
    },
    {
      key: "fulfillmentType",
      header: "Fulfillment",
      render: (row) => (row.fulfillmentType === "FUND_ONLY" ? "Fund only" : "Virtual card"),
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
      render: () => <span className="detail-link">Review →</span>,
    },
  ];

  return (
    <div className="spend-requests-page">
      <ResourcePage
        title="Spend requests"
        path="spend-requests"
        columns={columns}
        pageSize={20}
        myWorkFilters
        needsActionStatuses={["SUBMITTED", "IN_REVIEW"]}
        actions={[{ label: "Approve", name: "approve" }]}
        onRowNavigate={(row) => router.push(`/app/spend/requests/${row.id}?from=queue`)}
      />
      <p className="muted my-expenses-hint">
        Use <strong>Needs action</strong> for pending approvals. Reject or request info from{" "}
        <Link className="detail-link" href="/app/inbox">
          Inbox
        </Link>
        . Employees create requests in{" "}
        <Link className="detail-link" href="/app/me/requests">
          My requests
        </Link>
        .
      </p>
    </div>
  );
}
