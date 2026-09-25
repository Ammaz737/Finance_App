"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { api } from "@/lib/api";

type TravelKpis = {
  travelPending?: number;
  travel?: {
    trips: number;
    travelers: number;
    averageTripCost: string;
    cancelledBookings: number;
    refunds: number;
    refundAmount: string;
    airfareSpend: Array<{ currency: string; amount: string }>;
    hotelSpend: Array<{ currency: string; amount: string }>;
    carSpend: Array<{ currency: string; amount: string }>;
    spendByDestination: Array<{ destination: string; amount: string }>;
    inPolicySpendTrips: number;
    outOfPolicySpendTrips: number;
  };
};

export default function TravelReportsPage() {
  const dash = useQuery({
    queryKey: ["reporting-travel"],
    queryFn: () => api.get<TravelKpis>("/reporting"),
  });

  if (dash.isPending) return <p className="muted">Loading travel KPIs…</p>;
  if (dash.isError || !dash.data) {
    return <div className="error-panel">Could not load travel reporting.</div>;
  }

  const t = dash.data.travel;
  return (
    <div className="spend-detail">
      <PageHeader title="Travel reporting" subtitle="Spend, policy, cancellations, and refunds" />
      <div className="kpi-grid">
        <article className="kpi-card"><span>Trips</span><strong>{t?.trips ?? 0}</strong><small>Pending: {dash.data.travelPending ?? 0}</small></article>
        <article className="kpi-card"><span>Travelers</span><strong>{t?.travelers ?? 0}</strong><small>Avg trip {t?.averageTripCost ?? "0.00"}</small></article>
        <article className="kpi-card"><span>In / out of policy</span><strong>{t?.inPolicySpendTrips ?? 0} / {t?.outOfPolicySpendTrips ?? 0}</strong></article>
        <article className="kpi-card"><span>Cancelled / refunds</span><strong>{t?.cancelledBookings ?? 0} / {t?.refunds ?? 0}</strong><small>Refunded {t?.refundAmount ?? "0"}</small></article>
      </div>
      <section className="work-panel">
        <h2>Spend by destination</h2>
        <ul className="plain-list">
          {(t?.spendByDestination ?? []).map((row) => (
            <li key={row.destination}>{row.destination}: {row.amount}</li>
          ))}
          {!(t?.spendByDestination ?? []).length && <li className="muted">No confirmed trip spend yet.</li>}
        </ul>
      </section>
    </div>
  );
}
