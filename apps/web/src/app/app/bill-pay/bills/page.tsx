"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { api } from "@/lib/api";
import { ResourcePage } from "@/components/ResourcePage";
import { useSession } from "@/providers/session-provider";

type BillRow = {
  id: string;
  invoiceNumber?: string;
  vendorId?: string;
  status?: string;
  dueDate?: string | null;
  amount?: string | number;
  remainingAmount?: string | number;
  currency?: string;
  memo?: string;
  createdAt?: string;
};

type Vendor = { id: string; name?: string; displayName?: string };
type StageKey = "overview" | "drafts" | "approval" | "payment" | "history" | "urgent";

const stageMeta: Array<{ key: StageKey; label: string; statuses?: string[] }> = [
  { key: "overview", label: "Overview" },
  { key: "drafts", label: "Drafts", statuses: ["DRAFT", "NEEDS_REVIEW"] },
  { key: "approval", label: "For approval", statuses: ["PENDING_APPROVAL", "IN_REVIEW"] },
  { key: "payment", label: "For payment", statuses: ["APPROVED", "PARTIAL"] },
  { key: "history", label: "History", statuses: ["PAID", "REJECTED", "CANCELLED"] },
  { key: "urgent", label: "Urgent" },
];

const legacyStageMap: Record<string, StageKey> = {
  Overview: "overview",
  Drafts: "drafts",
  "For approval": "approval",
  "For payment": "payment",
  History: "history",
  Urgent: "urgent",
};

function money(currency: string, value: string | number | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function isUrgent(bill: { status?: string; dueDate?: unknown }) {
  if (!["DRAFT", "NEEDS_REVIEW", "PENDING_APPROVAL", "IN_REVIEW", "APPROVED", "PARTIAL"].includes(bill.status ?? "")) {
    return false;
  }
  if (!bill.dueDate) return false;
  const due = new Date(String(bill.dueDate)).getTime();
  return Number.isFinite(due) && due <= Date.now() + 7 * 24 * 60 * 60 * 1000;
}

function parseStage(raw: string | null): StageKey {
  if (!raw) return "overview";
  if (stageMeta.some((item) => item.key === raw)) return raw as StageKey;
  return legacyStageMap[raw] ?? "overview";
}

function BillsWorkspaceInner() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const stageParam = search.get("stage");
  const stage = parseStage(stageParam);

  useEffect(() => {
    // Migrate legacy spaced stage values to stable slugs.
    if (stageParam && legacyStageMap[stageParam]) {
      router.replace(`/app/bill-pay/bills?stage=${legacyStageMap[stageParam]}`);
    }
  }, [stageParam, router]);

  const canCreate = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("bill.create"),
  );

  const bills = useQuery({
    queryKey: ["resource", "bills", ""],
    queryFn: () => api.get<BillRow[]>("/bills"),
  });
  const vendors = useQuery({
    queryKey: ["bill-vendor-labels"],
    queryFn: async () => {
      try {
        return await api.get<Vendor[]>("/vendors");
      } catch {
        return [] as Vendor[];
      }
    },
  });
  const rows = bills.data ?? [];
  const vendorRows = vendors.data ?? [];
  const activeMeta = stageMeta.find((item) => item.key === stage) ?? stageMeta[0];

  const counts = Object.fromEntries(
    stageMeta.map((item) => {
      if (item.key === "overview") return [item.key, rows.length];
      if (item.key === "urgent") return [item.key, rows.filter(isUrgent).length];
      return [item.key, rows.filter((row) => item.statuses?.includes(row.status ?? "")).length];
    }),
  ) as Record<StageKey, number>;

  function selectStage(next: StageKey) {
    const href = next === "overview" ? "/app/bill-pay/bills" : `/app/bill-pay/bills?stage=${next}`;
    router.replace(href);
  }

  function vendorLabel(id?: string) {
    if (!id) return "—";
    const vendor = vendorRows.find((row) => row.id === id);
    return vendor?.displayName || vendor?.name || id.slice(0, 8);
  }

  const columns: Column<BillRow>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.invoiceNumber || "Bill"}</strong>
          <small>
            {vendorLabel(row.vendorId)}
            {row.dueDate ? ` · due ${new Date(row.dueDate).toLocaleDateString()}` : ""}
            {isUrgent(row) ? " · urgent" : ""}
          </small>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount),
    },
    {
      key: "remainingAmount",
      header: "Remaining",
      render: (row) => money(row.currency ?? "USD", row.remainingAmount ?? row.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "dueDate",
      header: "Due",
      render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"),
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  const detailHref = (id: string) =>
    stage === "overview" ? `/app/bill-pay/bills/${id}` : `/app/bill-pay/bills/${id}?stage=${stage}`;

  return (
    <div className="bills-workspace-page">
      <div className="stage-heading">
        <p>Bill Pay</p>
        <h1>Payables workspace</h1>
        <span>Review invoices, approve bills, schedule payments, and release them through a separate payment gate.</span>
        {canCreate && (
          <Link className="btn btn-primary" href="/app/bill-pay/bills/new">
            Create bill
          </Link>
        )}
      </div>
      <div className="stage-tabs" role="tablist" aria-label="Bill stages">
        {stageMeta.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={stage === item.key}
            type="button"
            className={stage === item.key ? "active" : ""}
            onClick={() => selectStage(item.key)}
          >
            {item.label}
            <span>{counts[item.key]}</span>
          </button>
        ))}
      </div>
      <ResourcePage
        title={stage === "overview" ? "All bills" : activeMeta.label}
        path="bills"
        columns={columns}
        pageSize={20}
        filter={activeMeta.statuses ? { status: activeMeta.statuses } : undefined}
        predicate={stage === "urgent" ? isUrgent : undefined}
        onRowNavigate={(row) => router.push(detailHref(row.id))}
      />
      <p className="muted my-expenses-hint">
        {stage === "approval"
          ? "Approve here. Reject or request info from "
          : stage === "payment"
            ? "Schedule payment from the bill, then release from "
            : "Vendors and bank readiness live in "}
        {stage === "approval" ? (
          <Link className="detail-link" href="/app/inbox">
            Inbox
          </Link>
        ) : stage === "payment" ? (
          <Link className="detail-link" href="/app/bill-pay/payments">
            Payments
          </Link>
        ) : (
          <Link className="detail-link" href="/app/vendors">
            Vendors
          </Link>
        )}
        {stage === "approval" ? ". " : stage === "payment" ? " or payment runs. " : ". "}
        Batch release uses{" "}
        <Link className="detail-link" href="/app/bill-pay/payment-runs">
          Payment runs
        </Link>
        .
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading bills…</p>}>
      <BillsWorkspaceInner />
    </Suspense>
  );
}
