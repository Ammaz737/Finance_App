"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { ResourcePage } from "@/components/ResourcePage";
import { useSession } from "@/providers/session-provider";

type RoleRow = {
  id: string;
  name?: string;
  description?: string;
};

export default function RolesPage() {
  const router = useRouter();
  const session = useSession();
  const canSeePeople = session
    ? canSeeItem(findNavItem("/app/company/people") ?? { href: "/app/company/people", permission: "people.read" }, session)
    : false;
  const canSeePolicy = session
    ? canSeeItem(findNavItem("/app/company/policy") ?? { href: "/app/company/policy", permission: "roles.assign" }, session)
    : false;

  const columns: Column<RoleRow>[] = [
    {
      key: "name",
      header: "Role",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Role"}</strong>
          <small>{row.description?.trim() ? row.description.slice(0, 80) : "Additive finance access"}</small>
        </span>
      ),
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Permissions →</span>,
    },
  ];

  return (
    <div className="company-roles-page linked-dest-page">
      <ResourcePage
        title="Roles"
        path="rbac"
        columns={columns}
        pageSize={20}
        onRowNavigate={(row) => router.push(`/app/company/roles/${row.id}`)}
      />
      <p className="muted my-expenses-hint">
        Roles are additive. Assign or remove them from a person record — custom role authoring stays outside this surface.{" "}
        {canSeePeople && (
          <Link className="detail-link" href="/app/company/people">
            People →
          </Link>
        )}{" "}
        {canSeePolicy && (
          <Link className="detail-link" href="/app/company/policy">
            Policies →
          </Link>
        )}
      </p>
    </div>
  );
}
