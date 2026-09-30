"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type FundRow = {
  id: string;
  name?: string;
  ownerId?: string;
  availableAmount?: string | number;
  limitAmount?: string | number;
  currency?: string;
  status?: string;
  createdAt?: string;
  validFrom?: string;
  validTo?: string | null;
};

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

function remainingPct(available?: string | number, limit?: string | number) {
  const avail = Number(available ?? 0);
  const lim = Number(limit ?? 0);
  if (!Number.isFinite(lim) || lim <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((avail / lim) * 100)));
}

export default function FundsPage() {
  const router = useRouter();
  const session = useSession();
  const people = useQuery({
    queryKey: ["fund-people-labels"],
    queryFn: async () => {
      try {
        return await api.get<Person[]>("/people");
      } catch {
        return [] as Person[];
      }
    },
  });
  const peopleRows = people.data ?? [];
  const isSelfOnly = Boolean(
    session &&
      !session.roles.includes("Owner") &&
      !session.permissions.includes("*") &&
      !session.permissions.includes("card.issue") &&
      session.permissions.includes("card.read"),
  );

  const columns: Column<FundRow>[] = [
    {
      key: "name",
      header: "Fund",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Fund"}</strong>
          <small>{personLabel(peopleRows, row.ownerId)}</small>
        </span>
      ),
    },
    {
      key: "availableAmount",
      header: "Available",
      render: (row) => money(row.currency ?? "USD", row.availableAmount),
    },
    {
      key: "limitAmount",
      header: "Limit",
      render: (row) => money(row.currency ?? "USD", row.limitAmount),
    },
    {
      key: "remaining",
      header: "Remaining",
      render: (row) => {
        const pct = remainingPct(row.availableAmount, row.limitAmount);
        if (pct == null) return "—";
        return (
          <span className={`fund-remaining${pct <= 15 ? " is-low" : pct >= 80 ? " is-high" : ""}`}>
            {pct}%
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
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  return (
    <div className="funds-page">
      <ResourcePage
        title="Funds"
        path="funds"
        columns={columns}
        pageSize={20}
        myWorkFilters
        needsActionStatuses={["INACTIVE", "EXPIRED", "CLOSED"]}
        onRowNavigate={(row) => router.push(`/app/spend/funds/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        {isSelfOnly
          ? "These are funds you own. Card spend draws from your live wallet after approvals top it up. "
          : "Funds hold spend authority from approved requests. One virtual card per holder is topped up from later approvals. "}
        <Link className="detail-link" href={isSelfOnly ? "/app/me/cards" : "/app/cards"}>
          {isSelfOnly ? "My card →" : "Corporate cards →"}
        </Link>
      </p>
    </div>
  );
}
