"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Trip = {
  id: string;
  name?: string;
  destination?: string;
  origin?: string;
  status?: string;
  travelerId?: string;
  startDate?: string | null;
  endDate?: string | null;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

const SEARCHABLE = ["DRAFT", "APPROVED", "READY_TO_BOOK", "PENDING_APPROVAL", "BOOKING", "IN_REVIEW"];

export default function TravelSearchPage() {
  const session = useSession();
  const canBook = session
    ? canSeeItem(findNavItem("/app/me/travel") ?? { href: "/app/me/travel", permission: "travel.book" }, session)
    : false;
  const canSeeTrips = session
    ? canSeeItem(findNavItem("/app/travel/trips") ?? { href: "/app/travel/trips", permission: "travel.book" }, session)
    : false;
  const canSeeRequests = session
    ? canSeeItem(findNavItem("/app/travel/requests") ?? { href: "/app/travel/requests", permission: "travel.approve" }, session)
    : false;

  const trips = useQuery({
    queryKey: ["travel-search-hub"],
    queryFn: () => api.get<Trip[]>("/travel"),
    enabled: canBook || canSeeTrips,
  });

  const mineId = session?.userId;
  const actionable = (trips.data ?? [])
    .filter((row) => SEARCHABLE.includes(String(row.status ?? "")))
    .filter((row) => !mineId || row.travelerId === mineId || canSeeTrips)
    .slice(0, 8);

  return (
    <div className="travel-search-page linked-dest-page spend-detail">
      <PageHeader
        title="Travel search"
        subtitle="Mock flights, hotels, and cars — search runs on a trip, not as a standalone booking engine"
      />

      <div className="overview-stat-grid" style={{ marginBottom: 8 }}>
        <article className="overview-stat">
          <span>1. Open a trip</span>
          <strong>Draft or approved</strong>
          <small>Create from My travel, then open the trip detail</small>
        </article>
        <article className="overview-stat">
          <span>2. Search quotes</span>
          <strong>Flight · Hotel · Car</strong>
          <small>Normalized mock offers with policy flags</small>
        </article>
        <article className="overview-stat">
          <span>3. Hold & confirm</span>
          <strong>Sandbox only</strong>
          <small>Reprice, mock hold, then confirm — not live inventory</small>
        </article>
      </div>

      <div className="detail-actions-top" style={{ marginBottom: 16 }}>
        {canBook && (
          <Link className="btn btn-primary" href="/app/me/travel">
            My travel
          </Link>
        )}
        {canSeeTrips && (
          <Link className="btn btn-ghost" href="/app/travel/trips?focus=book">
            Trips needing booking
          </Link>
        )}
        {canSeeRequests && (
          <Link className="btn btn-ghost" href="/app/travel/requests">
            Trip requests
          </Link>
        )}
      </div>

      <section className="work-panel">
        <h2>Trips ready to search</h2>
        {trips.isPending && <p className="muted">Loading trips…</p>}
        {trips.isError && (
          <p className="error-panel" role="alert">
            Could not load trips.{" "}
            <button className="text-button" type="button" onClick={() => void trips.refetch()}>
              Try again
            </button>
          </p>
        )}
        {!trips.isPending && !actionable.length && (
          <div className="empty-work">
            <strong>No searchable trips yet</strong>
            <p>Create a draft trip first, then open it to run flight, hotel, or car search.</p>
            {canBook && (
              <Link className="btn btn-ghost" href="/app/me/travel">
                Go to My travel
              </Link>
            )}
          </div>
        )}
        {actionable.length > 0 && (
          <ul className="plain-list travel-search-list">
            {actionable.map((trip) => (
              <li key={trip.id}>
                <Link className="detail-link" href={`/app/travel/trips/${trip.id}?from=${trip.travelerId === mineId ? "mine" : "trips"}`}>
                  <strong>{trip.name || "Trip"}</strong>
                </Link>
                {" · "}
                {trip.origin ? `${trip.origin} → ` : ""}
                {trip.destination || "Destination TBD"}
                {" · "}
                {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
                {" · "}
                <StatusBadge status={trip.status ?? "UNKNOWN"} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
