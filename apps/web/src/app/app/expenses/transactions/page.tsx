"use client";

import "@/components/personal-work.css";
import "@/components/spend-ui.css";
import "@/components/expenses-ui.css";
import { ExpenseOverview } from "@/components/ExpensePresentation";
import { SpendIntro, SpendRecord, SpendOpenLink } from "@/components/SpendPresentation";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";

type ExpenseRow = {
  id: string;
  merchant?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  policyResult?: string;
  userId?: string;
  createdAt?: string;
  receiptId?: string | null;
  memo?: string;
};

type Person = { id: string; firstName?: string; lastName?: string; email?: string };

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function personLabel(people: Person[], id?: string) {
  if (!id) return "—";
  const person = people.find((row) => row.id === id);
  if (!person) return id.slice(0, 8);
  const name = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
  return name || person.email || id.slice(0, 8);
}

export default function ExpenseReviewPage() {
  const router = useRouter();
  const people = useQuery({
    queryKey: ["expense-review-people-labels"],
    queryFn: async () => {
      try {
        return await api.get<Person[]>("/people");
      } catch {
        return [] as Person[];
      }
    },
  });
  const peopleRows = people.data ?? [];

  const columns: Column<ExpenseRow>[] = [
    {
      key: "merchant",
      header: "Expense",
      render: (row) => (
        <SpendRecord title={row.merchant || "Expense"} subtitle={row.memo?.trim() ? row.memo.slice(0, 56) : personLabel(peopleRows, row.userId)} href={`/app/expenses/${row.id}`} icon="Expense review"/>
      ),
    },
    {
      key: "userId",
      header: "Employee",
      render: (row) => personLabel(peopleRows, row.userId),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount ?? 0),
    },
    {
      key: "receipt",
      header: "Receipt",
      render: (row) => (row.receiptId ? <span className="req-ok">Attached</span> : <span className="req-missing">Missing</span>),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "policyResult",
      header: "Policy",
      render: (row) => row.policyResult || "—",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"),
    },
    {
      key: "open",
      header: "",
      render: (row) => <SpendOpenLink href={`/app/expenses/${row.id}`} label={`Review ${row.merchant || "expense"}`}/>,
    },
  ];

  return (
    <div className="expense-review-page personal-work-page spend-ui-page expenses-ui-page">
      <ResourcePage
        subtitle="Review employee expenses, receipts and policy checks."
        overview={(rows, loading) => <ExpenseOverview kind="review" rows={rows} loading={loading}/>}
        listIntro={<><SpendIntro title="Expense queue" description="Review submissions and follow up on missing information."/></>}
        title="Expense review"
        path="expenses"
        columns={columns}
        pageSize={20}
        myWorkFilters
        needsActionStatuses={["SUBMITTED", "IN_REVIEW"]}
        onRowNavigate={(row) => router.push(`/app/expenses/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Use <strong>Needs action</strong> for submitted expenses waiting on approval. Reject or request info from{" "}
        <Link className="detail-link" href="/app/inbox">
          Inbox
        </Link>
        . Employees complete receipts in{" "}
        <Link className="detail-link" href="/app/me/expenses">
          My expenses
        </Link>
        .
      </p>
    </div>
  );
}
