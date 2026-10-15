"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { WorkIcon, WorkSummary } from "@/components/PersonalWorkPresentation";
import "@/components/personal-work.css";

type RequestRow = {
  id: string;
  name?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  fulfillmentType?: string;
  policyResult?: string;
  purpose?: string;
  createdAt?: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function RequestsOverview({ rows, loading }: { rows: RequestRow[]; loading: boolean }) {
  const stats = [
    { label: "Needs action", value: rows.filter(row => ["DRAFT", "REJECTED", "BLOCKED", "NEEDS_INFO"].includes(row.status ?? "")).length, note: "Review and update requests", icon: "alert" as const },
    { label: "In review", value: rows.filter(row => ["SUBMITTED", "IN_REVIEW"].includes(row.status ?? "")).length, note: "Awaiting approval", icon: "clock" as const },
    { label: "Approved", value: rows.filter(row => row.status === "APPROVED").length, note: "Ready for fulfillment", icon: "check" as const },
    { label: "Fulfilled", value: rows.filter(row => row.status === "FULFILLED").length, note: "Funds made available", icon: "card" as const },
  ];
  return <WorkSummary stats={stats} loading={loading}/>;
}

export default function MyRequestsPage() {
  const router = useRouter();
  const href = (id: string) => `/app/spend/requests/${id}?from=mine`;
  const columns: Column<RequestRow>[] = [
    { key: "name", header: "Request", render: row => <div className="expense-merchant"><span className="expense-merchant-icon"><WorkIcon kind={row.fulfillmentType === "FUND_ONLY" ? "check" : "card"}/></span><span><Link href={href(row.id)} onClick={event => event.stopPropagation()}>{row.name || "Spend request"}</Link><small>{row.purpose?.trim() || "No business purpose added"}</small></span></div> },
    { key: "createdAt", header: "Date", render: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—" },
    { key: "amount", header: "Amount", render: row => <strong className="expense-amount">{money(row.currency ?? "USD", row.amount ?? 0)}</strong> },
    { key: "status", header: "Status", render: row => <StatusBadge status={row.status ?? "UNKNOWN"}/> },
    { key: "fulfillmentType", header: "Fulfillment", render: row => <span className="request-fulfillment"><WorkIcon kind={row.fulfillmentType === "FUND_ONLY" ? "check" : "card"}/>{row.fulfillmentType === "FUND_ONLY" ? "Fund only" : row.fulfillmentType === "VIRTUAL_CARD" ? "Virtual card" : row.fulfillmentType?.replaceAll("_", " ") || "—"}</span> },
    { key: "policyResult", header: "Policy", render: row => <span className="expense-policy">{row.policyResult?.replaceAll("_", " ") || "—"}</span> },
    { key: "open", header: "", render: row => <Link className="expense-open" href={href(row.id)} aria-label={`Open ${row.name || "request"}`} onClick={event => event.stopPropagation()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></Link> },
  ];
  return <div className="my-requests-page personal-work-page">
    <ResourcePage title="My requests" subtitle="Request company funds and follow every approval in one place." path="spend-requests" mineField="requesterId" columns={columns} pageSize={20} myWorkFilters
      overview={(rows, loading) => <RequestsOverview rows={rows} loading={loading}/>}
      listIntro={<div className="expense-list-heading"><div><h2>Request activity</h2><p>Track your requests from submission to fulfillment.</p></div><Link href="/app/me/cards"><WorkIcon kind="card"/>My card <span aria-hidden="true">↗</span></Link></div>}
      onRowNavigate={row => router.push(href(row.id))}/>
    <div className="expense-help"><WorkIcon kind="check"/><p><strong>From request to available funds.</strong> New requests are submitted for approval immediately. Approved virtual card requests issue or top up your card.</p></div>
  </div>;
}
