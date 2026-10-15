"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { WorkIcon, WorkSummary } from "@/components/PersonalWorkPresentation";
import "@/components/personal-work.css";

type ReimbursementRow = {
  id: string;
  type?: string;
  memo?: string;
  merchant?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  policyResult?: string;
  createdAt?: string;
};

const typeLabels: Record<string, string> = { STANDARD: "Standard", MILEAGE: "Mileage", PER_DIEM: "Per diem" };
const typeLabel = (type?: string) => type ? typeLabels[type] ?? type.replaceAll("_", " ") : "Standard";
const title = (row: ReimbursementRow) => row.memo?.trim() || `${typeLabel(row.type)} reimbursement`;
const detailHref = (id: string) => `/app/expenses/reimbursements/${id}`;

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function ReimbursementsOverview({ rows, loading }: { rows: ReimbursementRow[]; loading: boolean }) {
  return <WorkSummary loading={loading} stats={[
    { label: "Needs action", value: rows.filter(row => ["DRAFT", "NEEDS_INFO", "FAILED"].includes(row.status ?? "")).length, note: "Complete or update claims", icon: "alert" },
    { label: "In review", value: rows.filter(row => ["IN_REVIEW", "AWAITING_APPROVAL", "POLICY_REVIEW"].includes(row.status ?? "")).length, note: "Awaiting approval", icon: "clock" },
    { label: "Awaiting payout", value: rows.filter(row => ["APPROVED", "READY_FOR_PAYOUT", "SCHEDULED"].includes(row.status ?? "")).length, note: "Approved or scheduled", icon: "card" },
    { label: "Paid", value: rows.filter(row => row.status === "PAID").length, note: "Reimbursement completed", icon: "check" },
  ]}/>;
}

export default function MyReimbursementsPage() {
  const router = useRouter();
  const columns: Column<ReimbursementRow>[] = [
    {
      key: "memo", header: "Reimbursement",
      render: row => <div className="expense-merchant"><span className="expense-merchant-icon"><WorkIcon kind="receipt"/></span><span><Link href={detailHref(row.id)} onClick={event => event.stopPropagation()}>{title(row)}</Link><small>{row.merchant?.trim() || "Out-of-pocket expense"}</small></span></div>,
    },
    { key: "createdAt", header: "Date", render: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—" },
    { key: "amount", header: "Amount", render: row => <strong className="expense-amount">{money(row.currency ?? "USD", row.amount ?? 0)}</strong> },
    { key: "status", header: "Status", render: row => <StatusBadge status={row.status ?? "UNKNOWN"}/> },
    { key: "type", header: "Type", render: row => <span className="reimbursement-type">{typeLabel(row.type)}</span> },
    { key: "policyResult", header: "Policy", render: row => <span className="expense-policy">{row.policyResult?.replaceAll("_", " ") || "—"}</span> },
    { key: "open", header: "", render: row => <Link className="expense-open" href={detailHref(row.id)} aria-label={`Open ${title(row)}`} onClick={event => event.stopPropagation()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></Link> },
  ];

  return <div className="my-reimbursements-page personal-work-page">
    <ResourcePage title="My reimbursements" subtitle="Claim out-of-pocket expenses and track approvals and payouts." path="reimbursements" mineField="userId" columns={columns} pageSize={20} myWorkFilters
      overview={(rows, loading) => <ReimbursementsOverview rows={rows} loading={loading}/>}
      listIntro={<div className="expense-list-heading"><div><h2>Reimbursement activity</h2><p>Follow your claims from draft to payment.</p></div><Link href="/app/me/expenses"><WorkIcon kind="card"/>Card expenses <span aria-hidden="true">↗</span></Link></div>}
      onRowNavigate={row => router.push(detailHref(row.id))}
      onCreated={row => router.push(detailHref(row.id))}/>
    <div className="expense-help"><WorkIcon kind="receipt"/><p><strong>Complete your claim before submitting.</strong> New reimbursements open as drafts so you can add a receipt and review the details. Standard spend of $75 or more requires a receipt.</p></div>
  </div>;
}
