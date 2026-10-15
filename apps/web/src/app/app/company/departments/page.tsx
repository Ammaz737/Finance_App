"use client";

import Link from "next/link";
import { type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { CompanyOverview } from "@/components/CompanyPresentation";
import { SpendIntro } from "@/components/SpendPresentation";
import { ResourcePage } from "@/components/ResourcePage";
import { useSession } from "@/providers/session-provider";

type DeptRow = { id: string; name?: string };

export default function Page() {
  const session = useSession();
  const canSeePeople = session
    ? canSeeItem(findNavItem("/app/company/people") ?? { href: "/app/company/people", permission: "people.read" }, session)
    : false;
  const canSeeEntities = session
    ? canSeeItem(findNavItem("/app/company/entities") ?? { href: "/app/company/entities", permission: "roles.assign" }, session)
    : false;
  const canSeeLocations = session
    ? canSeeItem(findNavItem("/app/company/locations") ?? { href: "/app/company/locations", permission: "roles.assign" }, session)
    : false;

  const columns: Column<DeptRow>[] = [
    {
      key: "name",
      header: "Department",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Department"}</strong>
          <small>Used for people, policies, and reporting</small>
        </span>
      ),
    },
  ];

  return (
    <div className="company-structure-page linked-dest-page company-ui-page personal-work-page spend-ui-page company-departments-ui">
      <ResourcePage
        subtitle="Organize people, policies and reporting by department."
        overview={() => null}
        listIntro={<><SpendIntro title="Departments" description="Organize people, policies and reporting by department."></SpendIntro></>}
        title="Departments"
        path="departments"
        columns={columns}
        pageSize={20}
        actions={[
          { label: "Edit", name: "update" },
          { label: "Archive", name: "archive" },
        ]}
      />
      <p className="muted my-expenses-hint">
        Departments organize employees and can gate approval routing.{" "}
        {canSeeLocations && (
          <Link className="detail-link" href="/app/company/locations">
            Locations →
          </Link>
        )}{" "}
        {canSeePeople && (
          <Link className="detail-link" href="/app/company/people">
            People →
          </Link>
        )}{" "}
        {canSeeEntities && (
          <Link className="detail-link" href="/app/company/entities">
            Entities →
          </Link>
        )}
      </p>
    </div>
  );
}
