"use client";

import Link from "next/link";
import { StatusBadge, type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { ResourcePage } from "@/components/ResourcePage";
import { useSession } from "@/providers/session-provider";

type EntityRow = {
  id: string;
  name?: string;
  country?: string;
  currency?: string;
  status?: string;
};

export default function Page() {
  const session = useSession();
  const canSeeSettings = session
    ? canSeeItem(findNavItem("/app/company/settings") ?? { href: "/app/company/settings", permission: "roles.assign" }, session)
    : false;
  const canSeePeople = session
    ? canSeeItem(findNavItem("/app/company/people") ?? { href: "/app/company/people", permission: "people.read" }, session)
    : false;
  const canSeeDepts = session
    ? canSeeItem(findNavItem("/app/company/departments") ?? { href: "/app/company/departments", permission: "roles.assign" }, session)
    : false;

  const columns: Column<EntityRow>[] = [
    {
      key: "name",
      header: "Entity",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Legal entity"}</strong>
          <small>{row.country || "Country TBD"} · {row.currency || "—"}</small>
        </span>
      ),
    },
    {
      key: "country",
      header: "Country",
      render: (row) => row.country || "—",
    },
    {
      key: "currency",
      header: "Currency",
      render: (row) => row.currency || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (row.status ? <StatusBadge status={row.status} /> : <StatusBadge status="ACTIVE" />),
    },
  ];

  return (
    <div className="company-structure-page linked-dest-page">
      <ResourcePage
        title="Legal entities"
        path="entities"
        columns={columns}
        pageSize={20}
        actions={[
          { label: "Edit", name: "update" },
          { label: "Archive", name: "archive" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Entities set the accounting currency and country for funds, bills, and cards.{" "}
        {canSeeDepts && (
          <Link className="detail-link" href="/app/company/departments">
            Departments →
          </Link>
        )}{" "}
        {canSeePeople && (
          <Link className="detail-link" href="/app/company/people">
            People →
          </Link>
        )}{" "}
        {canSeeSettings && (
          <Link className="detail-link" href="/app/company/settings">
            Settings →
          </Link>
        )}
      </p>
    </div>
  );
}
