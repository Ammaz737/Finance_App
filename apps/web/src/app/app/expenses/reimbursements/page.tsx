"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Row = {
  id: string;
  type?: string;
  memo?: string;
  merchant?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  policyResult?: string;
  userId?: string;
  createdAt?: string;
  failureReason?: string;
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

const statusLabels: Record<string, string> = {
  IN_REVIEW: "For approval",
  APPROVED: "For payout",
  PAID: "Paid / History",
  FAILED: "Failures",
};

/** Expand nav shortcuts so in-flight payout states stay visible in the payout queue. */
const queueStatusFilters: Record<string, string[]> = {
  IN_REVIEW: ["IN_REVIEW"],
  APPROVED: ["APPROVED", "READY_FOR_PAYOUT", "SCHEDULED"],
  PAID: ["PAID"],
  FAILED: ["FAILED"],
};

const queueLinks = [
  { href: "/app/expenses/reimbursements", label: "All", status: null as string | null, permission: null as string | null },
  { href: "/app/expenses/reimbursements?status=IN_REVIEW", label: "For approval", status: "IN_REVIEW", permission: "reimbursement.approve" },
  { href: "/app/expenses/reimbursements?status=APPROVED", label: "For payout", status: "APPROVED", permission: "reimbursement.pay" },
  { href: "/app/expenses/reimbursements?status=PAID", label: "Paid / History", status: "PAID", permission: "reimbursement.pay" },
  { href: "/app/expenses/reimbursements?status=FAILED", label: "Failures", status: "FAILED", permission: "reimbursement.pay" },
];

function ReimbursementsQueueInner() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const status = search.get("status");
  const selectedStatus = status && statusLabels[status] ? status : null;
  const statusFilter = selectedStatus ? queueStatusFilters[selectedStatus] : undefined;

  const canApprove = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("reimbursement.approve"),
  );
  const canPay = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("reimbursement.pay"),
  );

  const needsActionStatuses = [
    ...(canApprove ? ["IN_REVIEW"] : []),
    ...(canPay ? ["APPROVED", "READY_FOR_PAYOUT", "FAILED"] : []),
  ];

  const people = useQuery({
    queryKey: ["reimbursement-queue-people-labels"],
    queryFn: async () => {
      try {
        return await api.get<Person[]>("/people");
      } catch {
        return [] as Person[];
      }
    },
  });
  const peopleRows = people.data ?? [];

  const visibleQueues = queueLinks.filter((item) => {
    if (!item.permission) return true;
    return (
      session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes(item.permission)
    );
  });

  const columns: Column<Row>[] = [
    {
      key: "memo",
      header: "Reimbursement",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.memo?.trim() || `${row.type ?? "STANDARD"} reimbursement`}</strong>
          <small>
            {row.merchant || personLabel(peopleRows, row.userId)}
            {row.status === "FAILED" && row.failureReason ? ` · ${row.failureReason.slice(0, 40)}` : ""}
          </small>
        </span>
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
      key: "type",
      header: "Type",
      render: (row) => row.type || "—",
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
      render: () => <span className="detail-link">Review →</span>,
    },
  ];

  const detailHref = (id: string) =>
    selectedStatus
      ? `/app/expenses/reimbursements/${id}?status=${encodeURIComponent(selectedStatus)}`
      : `/app/expenses/reimbursements/${id}`;

  return (
    <div className="linked-dest-page reimbursements-queue-page">
      <div className="my-work-filters" role="toolbar" aria-label="Reimbursement queues">
        {visibleQueues.map((item) => (
          <Link
            key={item.href}
            className={`chip${(item.status ?? null) === selectedStatus ? " chip-active" : ""}`}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <ResourcePage
        title={selectedStatus ? statusLabels[selectedStatus] : "Reimbursements"}
        path="reimbursements"
        filter={statusFilter ? { status: statusFilter } : undefined}
        columns={columns}
        pageSize={20}
        myWorkFilters={!selectedStatus}
        needsActionStatuses={needsActionStatuses}
        onRowNavigate={(row) => router.push(detailHref(row.id))}
      />
      <p className="muted my-expenses-hint">
        {selectedStatus === "IN_REVIEW"
          ? "Approve here. Reject or request info from "
          : selectedStatus === "APPROVED"
            ? "Includes approved and in-flight payouts. Open a row to schedule or confirm. "
            : selectedStatus === "FAILED"
              ? "Failed payouts can be rescheduled from the detail page. "
              : selectedStatus === "PAID"
                ? "Paid history for audit and accounting follow-up. "
                : "Use the queue chips or "}
        {(selectedStatus === "IN_REVIEW" || !selectedStatus) && (
          <Link className="detail-link" href="/app/inbox">
            Inbox
          </Link>
        )}
        {selectedStatus === "IN_REVIEW" ? ". " : !selectedStatus ? " for reject / request info. " : ""}
        Employees create drafts in{" "}
        <Link className="detail-link" href="/app/me/reimbursements">
          My reimbursements
        </Link>
        .
      </p>
    </div>
  );
}

export default function ReimbursementsQueuePage() {
  return (
    <Suspense fallback={<p className="muted">Loading reimbursements…</p>}>
      <ReimbursementsQueueInner />
    </Suspense>
  );
}
