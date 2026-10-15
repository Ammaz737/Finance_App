"use client";

import "@/components/personal-work.css";
import "@/components/spend-ui.css";
import "@/components/procurement-ui.css";
import { ProcurementOverview } from "@/components/ProcurementPresentation";
import { SpendIntro, SpendRecord, SpendOpenLink } from "@/components/SpendPresentation";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type RequestRow = {
  id: string;
  name?: string;
  memo?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  outcomeType?: string;
  requesterId?: string;
  approvalProgress?: string;
  createdAt?: string;
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

function outcomeLabel(value?: string) {
  if (value === "VIRTUAL_CARD") return "Virtual card";
  if (value === "VENDOR_SETUP") return "Vendor setup";
  if (value === "PURCHASE_ORDER") return "Purchase order";
  return value || "—";
}

export default function ProcurementRequestsPage() {
  const router = useRouter();
  const session = useSession();
  const canReview = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("procurement.review"),
  );
  const canRequest = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("procurement.request"),
  );

  const needsActionStatuses = [
    ...(canRequest ? ["DRAFT"] : []),
    ...(canReview ? ["IN_REVIEW"] : []),
  ];

  const people = useQuery({
    queryKey: ["procurement-request-people-labels"],
    queryFn: async () => {
      try {
        return await api.get<Person[]>("/people");
      } catch {
        return [] as Person[];
      }
    },
  });
  const peopleRows = people.data ?? [];

  const columns: Column<RequestRow>[] = [
    {
      key: "name",
      header: "Request",
      render: (row) => (
        <SpendRecord title={row.name || "Procurement request"} subtitle={row.memo?.trim() ? row.memo.slice(0, 56) : outcomeLabel(row.outcomeType)} href={`/app/procurement/requests/${row.id}`} icon="Requests"/>
      ),
    },
    {
      key: "requesterId",
      header: "Requester",
      render: (row) => personLabel(peopleRows, row.requesterId),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => money(row.currency ?? "USD", row.amount ?? 0),
    },
    {
      key: "outcomeType",
      header: "Outcome",
      render: (row) => outcomeLabel(row.outcomeType),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "approvalProgress",
      header: "Approvals",
      render: (row) => row.approvalProgress || "—",
    },
    {
      key: "open",
      header: "",
      render: (row) => <SpendOpenLink href={`/app/procurement/requests/${row.id}`} label="Open procurement request"/>,
    },
  ];

  return (
    <div className="procurement-requests-page personal-work-page spend-ui-page procurement-ui-page">
      <ResourcePage subtitle="Manage purchase requests from intake through approval." overview={(rows, loading) => <ProcurementOverview kind="requests" rows={rows} loading={loading}/>} listIntro={<SpendIntro title="Request queue" description="Track ownership, approvals and the requested fulfillment outcome."/>}
        title="Procurement requests"
        path="procurement"
        columns={columns}
        pageSize={20}
        myWorkFilters
        needsActionStatuses={needsActionStatuses.length ? needsActionStatuses : ["DRAFT", "IN_REVIEW"]}
        onRowNavigate={(row) => router.push(`/app/procurement/requests/${row.id}`)}
        onCreated={(row) => router.push(`/app/procurement/requests/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        {canReview ? (
          <>
            Use <strong>Needs action</strong> for drafts and requests awaiting review. Reject or request info from{" "}
            <Link className="detail-link" href="/app/inbox">
              Inbox
            </Link>
            .{" "}
          </>
        ) : (
          <>
            Drafts stay here until you submit. After approval, purchase orders appear under{" "}
            <Link className="detail-link" href="/app/procurement/purchase-orders">
              Purchase orders
            </Link>
            .{" "}
          </>
        )}
        Intake programs live in{" "}
        <Link className="detail-link" href="/app/procurement/programs">
          Programs
        </Link>
        .
      </p>
    </div>
  );
}
