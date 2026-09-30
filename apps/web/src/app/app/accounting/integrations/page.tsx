"use client";

import Link from "next/link";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { useSession } from "@/providers/session-provider";

type IntegrationRow = {
  id: string;
  name?: string;
  provider?: string;
  status?: string;
  type?: string;
  lastSyncAt?: string;
  createdAt?: string;
};

export default function Page() {
  const session = useSession();
  const canSeeCompany = session
    ? canSeeItem(
        findNavItem("/app/company/integrations") ?? {
          href: "/app/company/integrations",
          permission: "report.read",
        },
        session,
      )
    : false;

  const columns: Column<IntegrationRow>[] = [
    {
      key: "name",
      header: "Integration",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || row.provider || "Integration"}</strong>
          <small>{row.type || row.provider || "Accounting connector"}</small>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "lastSyncAt",
      header: "Last sync",
      render: (row) =>
        row.lastSyncAt
          ? new Date(row.lastSyncAt).toLocaleString()
          : row.createdAt
            ? new Date(row.createdAt).toLocaleDateString()
            : "—",
    },
  ];

  return (
    <div className="accounting-queue-page">
      <ResourcePage
        title="Accounting integrations"
        path="integrations"
        columns={columns}
        pageSize={20}
        actions={[{ label: "Ping", name: "ping" }]}
      />
      <p className="muted my-expenses-hint">
        Sync ready entries from{" "}
        <Link className="detail-link" href="/app/accounting/ready-to-sync">
          Ready to sync
        </Link>
        {canSeeCompany ? (
          <>
            . Org-wide connector health is under{" "}
            <Link className="detail-link" href="/app/company/integrations">
              Company integrations
            </Link>
            .
          </>
        ) : (
          "."
        )}
      </p>
    </div>
  );
}
