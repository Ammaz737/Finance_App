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

const ACTIVE = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "READY_TO_BOOK", "BOOKING", "BLOCKED", "IN_REVIEW"];
const NEEDS_BOOKING = ["APPROVED", "READY_TO_BOOK", "BOOKING"];
const DONE = ["BOOKED", "COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"];

const focusLinks = [
  { href: "/app/travel/trips", label: "All", focus: null as string | null },
  { href: "/app/travel/trips?focus=active", label: "Active", focus: "active" },
  { href: "/app/travel/trips?focus=book", label: "Needs booking", focus: "book" },
  { href: "/app/travel/trips?focus=done", label: "Done", focus: "done" },
];

function TripsContent() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const focus = search.get("focus");
  const activeFocus = focus === "active" || focus === "book" || focus === "done" ? focus : null;

  const canApprove = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("travel.approve"),
  );
  const canSeeMine = session
    ? canSeeItem(findNavItem("/app/me/travel") ?? { href: "/app/me/travel", permission: "travel.book" }, session)
    : false;
  const canSeeRequests = session
    ? canSeeItem(findNavItem("/app/travel/requests") ?? { href: "/app/travel/requests", permission: "travel.approve" }, session)
    : false;
  const canSeeSearch = session
    ? canSeeItem(findNavItem("/app/travel/search") ?? { href: "/app/travel/search", permission: "travel.book" }, session)
    : false;
  const canSeeReports = session
    ? canSeeItem(findNavItem("/app/travel/reports") ?? { href: "/app/travel/reports", permission: "report.read" }, session)
    : false;

  const people = useQuery({
    queryKey: ["travel-trips-people-labels"],
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
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "policyResult",
      header: "Policy",
      render: (row) => (row.policyResult ? <StatusBadge status={row.policyResult} /> : "—"),
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  const actions = [
    { label: "Submit", name: "submit" },
    ...(canApprove ? [{ label: "Approve", name: "approve" }] : []),
  ];

  return (
    <div className="travel-trips-page linked-dest-page">
      <div className="my-work-filters" role="toolbar" aria-label="Trip focus">
        {focusLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`chip${activeFocus === item.focus ? " chip-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <ResourcePage
        title="Travel trips"
        path="travel"
        columns={columns}
        pageSize={20}
        actions={actions}
        predicate={(row) => {
          const status = String(row.status ?? "");
          if (activeFocus === "active") return ACTIVE.includes(status);
          if (activeFocus === "book") return NEEDS_BOOKING.includes(status);
          if (activeFocus === "done") return DONE.includes(status);
          return true;
        }}
        onRowNavigate={(row) => router.push(`/app/travel/trips/${row.id}?from=trips`)}
        onCreated={(row) => router.push(`/app/travel/trips/${row.id}?from=trips`)}
      />

      <p className="muted my-expenses-hint">
        Create opens the trip so you can search offers, reprice, submit, hold, confirm, then cancel/refund. Approvals stay in Trip requests / Inbox.{" "}
        {canSeeMine && (
          <Link className="detail-link" href="/app/me/travel">
            My travel →
          </Link>
        )}{" "}
        {canSeeRequests && (
          <Link className="detail-link" href="/app/travel/requests">
            Trip requests →
          </Link>
        )}{" "}
        {canSeeSearch && (
          <Link className="detail-link" href="/app/travel/search">
            Search →
          </Link>
        )}{" "}
        {canSeeReports && (
          <Link className="detail-link" href="/app/travel/reports">
            Reports →
          </Link>
        )}
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading trips…</p>}>
      <TripsContent />
    </Suspense>
  );
}
