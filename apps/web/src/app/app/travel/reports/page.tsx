"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type MoneyTotal = { currency: string; amount: string };

type TravelKpis = {
  travelPending?: number;
  travel?: {
    trips: number;
    travelers: number;
    averageTripCost: string;
    cancelledBookings: number;
    refunds: number;
    refundAmount: string;
    airfareSpend: MoneyTotal[];
    hotelSpend: MoneyTotal[];
    carSpend: MoneyTotal[];
    spendByDestination: Array<{ destination: string; amount: string }>;
    inPolicySpendTrips: number;
    outOfPolicySpendTrips: number;
  };
};

function moneyList(totals: MoneyTotal[] | undefined) {
  if (!totals?.length) return "—";
  return totals
    .map((item) => `${item.currency} ${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .join(" · ");
}

function fmtAmount(value: string | undefined) {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value;
}

export default function TravelReportsPage() {
  const session = useSession();
  const canReport = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("report.read"),
  );
  const canSeeTrips = session
    ? canSeeItem(findNavItem("/app/travel/trips") ?? { href: "/app/travel/trips", permission: "travel.book" }, session)
    : false;
  const canSeeRequests = session
    ? canSeeItem(findNavItem("/app/travel/requests") ?? { href: "/app/travel/requests", permission: "travel.approve" }, session)
    : false;

  const dash = useQuery({
    queryKey: ["reporting-travel"],
    queryFn: () => api.get<TravelKpis>("/reporting"),
    enabled: canReport,
  });

  if (!canReport) {
    return (
      <div className="error-panel" role="alert">
        Travel reporting requires report read access.
      </div>
    );
  }

  if (dash.isPending) return <p className="muted">Loading travel KPIs…</p>;
  if (dash.isError || !dash.data) {
    return (
      <div className="error-panel" role="alert">
        Could not load travel reporting.{" "}
        <button className="text-button" type="button" onClick={() => void dash.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const t = dash.data.travel;

  return (
    <div className="travel-reports-page linked-dest-page spend-detail">
      <div className="resource-heading">
        <PageHeader title="Travel reporting" subtitle="Confirmed booking spend, policy mix, cancellations, and refunds" />
        <div className="detail-actions-top">
          {canSeeRequests && (dash.data.travelPending ?? 0) > 0 && (
            <Link className="btn btn-ghost" href="/app/travel/requests">
              {dash.data.travelPending} pending
            </Link>
          )}
          {canSeeTrips && (
            <Link className="btn btn-ghost" href="/app/travel/trips">
              All trips
            </Link>
          )}
        </div>
      </div>

      <div className="kpi-grid travel-report-kpis">
        <article className="kpi-card">
          <span>Trips</span>
          <strong>{t?.trips ?? 0}</strong>
          <small>Pending approval: {dash.data.travelPending ?? 0}</small>
        </article>
        <article className="kpi-card">
          <span>Travelers</span>
          <strong>{t?.travelers ?? 0}</strong>
          <small>Avg trip {fmtAmount(t?.averageTripCost)}</small>
        </article>
        <article className="kpi-card">
          <span>In / out of policy</span>
          <strong>
            {t?.inPolicySpendTrips ?? 0} / {t?.outOfPolicySpendTrips ?? 0}
          </strong>
          <small>Confirmed trips</small>
        </article>
        <article className="kpi-card">
          <span>Cancelled / refunds</span>
          <strong>
            {t?.cancelledBookings ?? 0} / {t?.refunds ?? 0}
          </strong>
          <small>Refunded {fmtAmount(t?.refundAmount)}</small>
        </article>
      </div>

      <div className="work-panels">
        <section className="work-panel">
          <h2>Spend by booking type</h2>
          <dl className="detail-list">
            <div>
              <dt>Airfare</dt>
              <dd>{moneyList(t?.airfareSpend)}</dd>
            </div>
            <div>
              <dt>Hotel</dt>
              <dd>{moneyList(t?.hotelSpend)}</dd>
            </div>
            <div>
              <dt>Car</dt>
              <dd>{moneyList(t?.carSpend)}</dd>
            </div>
          </dl>
          <p className="muted" style={{ marginTop: 12 }}>
            Booking-type totals are confirmed sandbox bookings only. Trip estimates are planning figures.
          </p>
        </section>
        <section className="work-panel">
          <h2>Spend by destination</h2>
          <ul className="plain-list">
            {(t?.spendByDestination ?? []).map((row) => (
              <li key={row.destination}>
                <strong>{row.destination}</strong>
                <span className="muted"> · {fmtAmount(row.amount)}</span>
              </li>
            ))}
            {!(t?.spendByDestination ?? []).length && <li className="muted">No confirmed trip spend yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
