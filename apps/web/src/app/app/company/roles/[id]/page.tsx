"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import {
  selectionFromPermissionKeys,
  type RoleScope,
} from "@finance/permissions";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { RoleBuilderForm, type RoleBuilderValues } from "@/features/roles";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  role: { id: string; name: string; description: string };
  permissions: Array<{ id: string; key: string; label: string; scope: string }>;
  permissionKeys?: string[];
  defaultScope?: string;
  systemRole?: boolean;
  editable?: boolean;
  entityRestrictions: string[];
};

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const detail = useQuery({
    queryKey: ["role", id],
    queryFn: () => api.get<Detail>(`/rbac/${id}`),
  });
  const entities = useQuery({
    queryKey: ["role-entities"],
    queryFn: () => api.get<Array<{ id: string; name: string }>>("/entities"),
  });

  const canManage =
    Boolean(session?.roles.includes("Owner")) ||
    Boolean(session?.permissions.includes("*")) ||
    Boolean(session?.permissions.includes("roles.assign"));

  const canSeePeople = session
    ? canSeeItem(findNavItem("/app/company/people") ?? { href: "/app/company/people", permission: "people.read" }, session)
    : false;

  const save = useMutation({
    mutationFn: (values: RoleBuilderValues) =>
      api.post(`/rbac/${id}/update`, {
        name: values.name,
        description: values.description,
        scope: values.scope,
        selection: values.selection,
      }),
    onSuccess: () => {
      setMessage("Role updated.");
      setError("");
      setEditing(false);
      void client.invalidateQueries({ queryKey: ["role", id] });
      void client.invalidateQueries({ queryKey: ["rbac"] });
    },
    onError: (err: Error) => {
      setError(err.message || "Could not update role.");
    },
  });

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

  const { role, permissions, entityRestrictions, systemRole, editable } = detail.data;
  const permissionKeys = detail.data.permissionKeys ?? permissions.map((p) => p.key).filter(Boolean);
  const defaultScope = (detail.data.defaultScope ?? permissions[0]?.scope ?? "ORGANIZATION") as RoleScope;
  const byScope = permissions.reduce<Record<string, typeof permissions>>((acc, permission) => {
    const key = permission.scope || "ORG";
    (acc[key] ??= []).push(permission);
    return acc;
  }, {});

  const initial: RoleBuilderValues = {
    name: role.name,
    description: role.description ?? "",
    scope: defaultScope,
    selection: selectionFromPermissionKeys(permissionKeys),
  };

  return (
    <div className="stack-lg company-role-detail linked-dest-page">
      <div className="resource-heading">
        <PageHeader title={role.name} subtitle={role.description || "Role permissions and scope"} />
        <div className="detail-actions-top">
          <Link className="btn btn-ghost" href="/app/company/roles">
            Back to roles
          </Link>
          {canManage && editable && !editing ? (
            <button type="button" className="btn btn-primary" onClick={() => { setEditing(true); setMessage(""); setError(""); }}>
              Edit permissions
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="notice">{message}</p> : null}

      {editing ? (
        <RoleBuilderForm
          mode="edit"
          singlePage
          systemRole={systemRole}
          initial={initial}
          submitting={save.isPending}
          error={error}
          onCancel={() => { setEditing(false); setError(""); }}
          onSubmit={(values) => {
            setError("");
            save.mutate(values);
          }}
        />
      ) : (
        <>
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

          {!editable ? (
            <p className="notice">The Owner role always has full access and cannot be edited.</p>
          ) : null}

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
                ? entityRestrictions
                    .map((entityId) => entities.data?.find((row) => row.id === entityId)?.name ?? entityId.slice(0, 8))
                    .join(", ")
                : "Organization-wide or not currently assigned with entity scope."}
            </p>
            {canSeePeople && (
              <p className="muted" style={{ marginTop: 12 }}>
                Assign or remove this role from{" "}
                <Link className="detail-link" href="/app/company/people">
                  People →
                </Link>
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
