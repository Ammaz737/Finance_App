"use client";

import Link from "next/link";
import { type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { ResourcePage } from "@/components/ResourcePage";
import { useSession } from "@/providers/session-provider";

type LocationRow = { id: string; name?: string };

export default function Page() {
  const session = useSession();
  const canSeePeople = session
    ? canSeeItem(findNavItem("/app/company/people") ?? { href: "/app/company/people", permission: "people.read" }, session)
    : false;
  const canSeeDepts = session
    ? canSeeItem(findNavItem("/app/company/departments") ?? { href: "/app/company/departments", permission: "roles.assign" }, session)
    : false;

  const columns: Column<LocationRow>[] = [
    {
      key: "name",
      header: "Location",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Location"}</strong>
          <small>Office and regional assignment</small>
        </span>
      ),
    },
  ];

  return (
    <div className="company-structure-page linked-dest-page">
      <ResourcePage
        title="Locations"
        path="locations"
        columns={columns}
        pageSize={20}
        actions={[
          { label: "Edit", name: "update" },
          { label: "Archive", name: "archive" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Assign locations on people records for reporting and regional policy.{" "}
        {canSeeDepts && (
          <Link className="detail-link" href="/app/company/departments">
            Departments →
          </Link>
        )}{" "}
        {canSeePeople && (
          <Link className="detail-link" href="/app/company/people">
            People →
          </Link>
        )}
      </p>
    </div>
  );
}
