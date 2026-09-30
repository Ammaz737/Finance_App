"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  role: { name: string; description: string };
  permissions: Array<{ id: string; key: string; label: string; scope: string }>;
  entityRestrictions: string[];
};

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const detail = useQuery({
    queryKey: ["role", id],
    queryFn: () => api.get<Detail>(`/rbac/${id}`),
  });

  const canSeePeople = session
    ? canSeeItem(findNavItem("/app/company/people") ?? { href: "/app/company/people", permission: "people.read" }, session)
    : false;

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load this role.{" "}
        <button type="button" className="text-button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading role…</p>;

  const { role, permissions, entityRestrictions } = detail.data;
  const byScope = permissions.reduce<Record<string, typeof permissions>>((acc, permission) => {
    const key = permission.scope || "ORG";
    (acc[key] ??= []).push(permission);
    return acc;
  }, {});

  return (
    <div className="stack-lg company-role-detail linked-dest-page">
      <div className="resource-heading">
        <PageHeader title={role.name} subtitle={role.description || "Role permissions and scope"} />
        <Link className="btn btn-ghost" href="/app/company/roles">
          Back to roles
        </Link>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <article className="kpi-card">
          <span>Permissions</span>
          <strong>{permissions.length}</strong>
          <small>Keys granted by this role</small>
        </article>
        <article className="kpi-card">
          <span>Entity restrictions</span>
          <strong>{entityRestrictions.length || "Org-wide"}</strong>
          <small>{entityRestrictions.length ? "Limited to listed entities" : "No entity lock on this role"}</small>
        </article>
      </div>

      <section className="work-panel">
        <h2>Permissions</h2>
        {Object.entries(byScope).map(([scope, items]) => (
          <div key={scope} className="role-perm-group">
            <h3>{scope}</h3>
            <ul className="plain-list">
              {items.map((permission) => (
                <li key={permission.id}>
                  <code>{permission.key}</code>
                  <span className="muted"> · {permission.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!permissions.length && <p className="muted">No permissions on this role.</p>}
      </section>

      <section className="work-panel">
        <h2>Entity restrictions</h2>
        <p>
          {entityRestrictions.length
            ? entityRestrictions.join(", ")
            : "Organization-wide or not currently assigned with entity scope."}
        </p>
        <p className="muted">
          Advanced custom-role authoring remains outside this release. Assign or remove existing roles from People.
        </p>
        {canSeePeople && (
          <p className="muted" style={{ marginTop: 12 }}>
            <Link className="detail-link" href="/app/company/people">
              Manage people →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
