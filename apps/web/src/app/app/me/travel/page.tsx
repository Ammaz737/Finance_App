"use client";

import Link from "next/link";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { WorkIcon, WorkSummary } from "@/components/PersonalWorkPresentation";
import "@/components/personal-work.css";

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
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
};

const EDITABLE = ["DRAFT", "PENDING_APPROVAL", "IN_REVIEW", "REJECTED", "BLOCKED"];
const tripHref = (id: string) => `/app/travel/trips/${id}?from=mine`;

function money(currency: string, value: string | number | null | undefined) {
  if (value == null) return "—";
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function TravelOverview({ rows, loading }: { rows: TravelRow[]; loading: boolean }) {
  return <WorkSummary loading={loading} stats={[
    { label: "Draft trips", value: rows.filter(row => row.status === "DRAFT").length, note: "Complete and submit", icon: "receipt" },
    { label: "In review", value: rows.filter(row => ["PENDING_APPROVAL", "IN_REVIEW"].includes(row.status ?? "")).length, note: "Awaiting approval", icon: "clock" },
    { label: "Ready to book", value: rows.filter(row => ["APPROVED", "READY_TO_BOOK", "BOOKING"].includes(row.status ?? "")).length, note: "Choose and confirm bookings", icon: "plane" },
    { label: "Booked", value: rows.filter(row => row.status === "BOOKED").length, note: "Travel arrangements confirmed", icon: "check" },
  ]}/>;
}

export default function MyTravelPage() {
  const columns: Column<TravelRow>[] = [
    { key: "name", header: "Trip", render: row => <div className="expense-merchant"><span className="expense-merchant-icon"><WorkIcon kind="plane"/></span><span><strong className="travel-trip-title">{row.name || "Trip"}</strong><small>{row.origin ? `${row.origin} → ` : ""}{row.destination || "Destination to be confirmed"}{row.purpose?.trim() ? ` · ${row.purpose}` : ""}</small></span></div> },
    { key: "dates", header: "Travel dates", render: row => <span className="travel-trip-dates"><span>{fmtDate(row.startDate)}</span><span>{row.endDate ? `to ${fmtDate(row.endDate)}` : "Return date to be confirmed"}</span></span> },
    { key: "estimatedAmount", header: "Estimate", render: row => <strong className="expense-amount">{money(row.currency ?? "USD", row.estimatedAmount)}</strong> },
    { key: "status", header: "Status", render: row => <StatusBadge status={row.status ?? "UNKNOWN"}/> },
    { key: "policyResult", header: "Policy", render: row => <span className="expense-policy">{row.policyResult?.replaceAll("_", " ") || "—"}</span> },
    { key: "createdAt", header: "Created", render: row => fmtDate(row.createdAt) },
    { key: "actionsHint", header: "", render: row => <div className="travel-row-actions"><button type="button" className="travel-manage" aria-label={`Review ${row.name || "trip"}`}>{EDITABLE.includes(row.status ?? "") ? "Manage" : "Review"}</button><Link className="expense-open" href={tripHref(row.id)} aria-label={`Open full trip ${row.name || "trip"}`} onClick={event => event.stopPropagation()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></Link></div> },
  ];

  return <div className="my-travel-page personal-work-page">
    <ResourcePage title="My travel" subtitle="Plan business trips and track requests, approvals and bookings." path="travel" mineField="travelerId" columns={columns} pageSize={20} myWorkFilters
      overview={(rows, loading) => <TravelOverview rows={rows} loading={loading}/>}
      listIntro={<div className="expense-list-heading"><div><h2>Trip activity</h2><p>Follow your travel plans from request to confirmed booking.</p></div><div className="travel-shortcuts"><Link href="/app/travel/search"><WorkIcon kind="plane"/>Travel search <span aria-hidden="true">↗</span></Link><Link href="/app/travel/trips">All trips <span aria-hidden="true">↗</span></Link></div></div>}
      actions={[{ label: "Edit", name: "update" }, { label: "Delete", name: "delete" }, { label: "Submit", name: "submit" }]}
      getDetailHref={row => tripHref(row.id)}/>
    <div className="expense-help"><WorkIcon kind="plane"/><p><strong>Plan, approve, then book.</strong> Manage draft and pending trips before approval. Once approved, open the full trip to search quotes and confirm your booking.</p></div>
  </div>;
}
