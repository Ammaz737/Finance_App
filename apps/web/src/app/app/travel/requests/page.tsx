"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

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
  travelerId?: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
};

type Person = { id: string; firstName?: string; lastName?: string; email?: string };

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

function personLabel(people: Person[], id?: string) {
  if (!id) return "—";
  const person = people.find((row) => row.id === id);
  if (!person) return id.slice(0, 8);
  const name = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
  return name || person.email || id.slice(0, 8);
}

const queueLinks = [
  {
    href: "/app/travel/requests",
    label: "For approval",
    status: "PENDING_APPROVAL" as string | null,
    filter: ["PENDING_APPROVAL"],
  },
  {
    href: "/app/travel/requests?status=READY_TO_BOOK",
    label: "Ready to book",
    status: "READY_TO_BOOK",
    filter: ["APPROVED", "READY_TO_BOOK", "BOOKING"],
  },
  {
    href: "/app/travel/requests?status=HISTORY",
    label: "Decided",
    status: "HISTORY",
    filter: ["REJECTED", "CANCELLED", "COMPLETED", "BOOKED"],
  },
];

function RequestsContent() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const status = search.get("status");
  const active = queueLinks.find((item) => item.status === status) ?? queueLinks[0]!;

  const canSeeMine = session
    ? canSeeItem(findNavItem("/app/me/travel") ?? { href: "/app/me/travel", permission: "travel.book" }, session)
    : false;
  const canSeeTrips = session
    ? canSeeItem(findNavItem("/app/travel/trips") ?? { href: "/app/travel/trips", permission: "travel.book" }, session)
    : false;
  const canSeeInbox = session
    ? canSeeItem(findNavItem("/app/inbox") ?? { href: "/app/inbox" }, session)
    : true;

  const people = useQuery({
    queryKey: ["travel-requests-people-labels"],
    queryFn: async () => {
      try {
        return await api.get<Person[]>("/people");
      } catch {
        return [] as Person[];
      }
    },
  });
  const peopleRows = people.data ?? [];

  const columns: Column<TravelRow>[] = [
    {
      key: "name",
      header: "Trip",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Trip request"}</strong>
          <small>
            {row.origin ? `${row.origin} → ` : ""}
            {row.destination || "Destination TBD"}
            {row.purpose?.trim() ? ` · ${row.purpose.slice(0, 40)}` : ""}
          </small>
        </span>
      ),
    },
    {
      key: "travelerId",
      header: "Traveler",
      render: (row) => personLabel(peopleRows, row.travelerId),
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
      key: "policyResult",
      header: "Policy",
      render: (row) => (row.policyResult ? <StatusBadge status={row.policyResult} /> : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "createdAt",
      header: "Submitted",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"),
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Review →</span>,
    },
  ];

  const detailHref = (id: string) =>
    active.status && active.status !== "PENDING_APPROVAL"
      ? `/app/travel/trips/${id}?from=requests&status=${encodeURIComponent(active.status)}`
      : `/app/travel/trips/${id}?from=requests`;

  return (
    <div className="travel-requests-page linked-dest-page">
      <div className="my-work-filters" role="toolbar" aria-label="Trip request queues">
        {queueLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`chip${item.status === active.status ? " chip-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <ResourcePage
        title={active.label}
        path="travel"
        filter={{ status: active.filter }}
        columns={columns}
        pageSize={20}
        actions={active.status === "PENDING_APPROVAL" ? [{ label: "Approve", name: "approve" }] : []}
        onRowNavigate={(row) => router.push(detailHref(row.id))}
      />

      <p className="muted my-expenses-hint">
        {active.status === "PENDING_APPROVAL"
          ? "Approve here. Employees manage drafts in "
          : active.status === "READY_TO_BOOK"
            ? "Approved trips waiting for mock booking. Open a row to search or confirm. "
            : "Past decisions for audit follow-up. "}
        {active.status === "PENDING_APPROVAL" && canSeeMine && (
          <Link className="detail-link" href="/app/me/travel">
            My travel
          </Link>
        )}
        {active.status === "PENDING_APPROVAL" && canSeeMine && "; decisions also appear in "}
        {canSeeInbox && (
          <Link className="detail-link" href="/app/inbox">
            Inbox →
          </Link>
        )}{" "}
        {canSeeTrips && (
          <Link className="detail-link" href="/app/travel/trips">
            All trips →
          </Link>
        )}
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading trip requests…</p>}>
      <RequestsContent />
    </Suspense>
  );
}
