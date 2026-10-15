"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { WorkIcon, WorkSummary } from "@/components/PersonalWorkPresentation";
import "@/components/personal-work.css";

type ExpenseRow = {
  id: string;
  merchant?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  policyResult?: string;
  createdAt?: string;
  receiptId?: string | null;
  memo?: string;
};


function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function ExpenseOverview({ rows, loading }: { rows: ExpenseRow[]; loading: boolean }) {
  const stats = [
    { label: "Needs action", value: rows.filter(row => ["INCOMPLETE", "DRAFT", "REJECTED"].includes(row.status ?? "")).length, note: "Complete and submit", icon: "alert" as const },
    { label: "Missing receipts", value: rows.filter(row => !row.receiptId).length, note: "Attach supporting documents", icon: "receipt" as const },
    { label: "In review", value: rows.filter(row => ["SUBMITTED", "IN_REVIEW"].includes(row.status ?? "")).length, note: "Awaiting a decision", icon: "clock" as const },
    { label: "Approved", value: rows.filter(row => row.status === "APPROVED").length, note: "Reviewed and approved", icon: "check" as const },
  ];
  return <WorkSummary stats={stats} loading={loading}/>;
}

export default function MyExpensesPage() {
  const router = useRouter();
  const columns: Column<ExpenseRow>[] = [
    { key: "merchant", header: "Expense", render: row => <div className="expense-merchant"><span className="expense-merchant-icon"><WorkIcon/></span><span><Link href={`/app/expenses/${row.id}`} onClick={event => event.stopPropagation()}>{row.merchant || "Expense"}</Link><small>{row.memo?.trim() || "Add a business purpose"}</small></span></div> },
    { key: "createdAt", header: "Date", render: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—" },
    { key: "amount", header: "Amount", render: row => <strong className="expense-amount">{money(row.currency ?? "USD", row.amount ?? 0)}</strong> },
    { key: "status", header: "Status", render: row => <StatusBadge status={row.status ?? "UNKNOWN"}/> },
    { key: "receipt", header: "Receipt", render: row => <span className={`expense-receipt ${row.receiptId ? "is-attached" : "is-missing"}`}><WorkIcon kind={row.receiptId ? "check" : "receipt"}/>{row.receiptId ? "Attached" : "Missing"}</span> },
    { key: "policyResult", header: "Policy", render: row => <span className="expense-policy">{row.policyResult?.replaceAll("_", " ") || "—"}</span> },
    { key: "open", header: "", render: row => <Link className="expense-open" href={`/app/expenses/${row.id}`} aria-label={`Open ${row.merchant || "expense"}`} onClick={event => event.stopPropagation()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></Link> },
  ];
  return <div className="my-expenses-page personal-work-page">
    <ResourcePage title="My expenses" subtitle="Manage your card expenses, receipts and approvals." path="expenses" mineField="userId" columns={columns} pageSize={20} myWorkFilters
      overview={(rows, loading) => <ExpenseOverview rows={rows} loading={loading}/>}
      listIntro={<div className="expense-list-heading"><div><h2>Expense activity</h2><p>Review your spending and keep every expense complete.</p></div><Link href="/app/me/cards"><WorkIcon kind="card"/>My card <span aria-hidden="true">↗</span></Link></div>}
      onRowNavigate={row => router.push(`/app/expenses/${row.id}`)}/>
    <div className="expense-help"><WorkIcon/><p><strong>Keep your expenses up to date.</strong> Add a business purpose and receipt, then submit for approval. Card charges appear here automatically.</p></div>
  </div>;
}
