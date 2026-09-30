"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Row = { id: string; name?: string; email?: string; status?: string };
type Detail = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    managerId?: string;
    departmentId?: string;
    locationId?: string;
    legalEntityId?: string;
  };
  roles: Array<{ id: string; name: string; assignmentId: string; entityId?: string | null }>;
  audit: Array<{ id: string; action: string; createdAt: string }>;
};

function hasPerm(session: { roles: string[]; permissions: string[] } | null | undefined, permission: string) {
  if (!session) return false;
  return session.roles.includes("Owner") || session.permissions.includes("*") || session.permissions.includes(permission);
}

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const [assignment, setAssignment] = useState({
    managerId: "",
    departmentId: "",
    locationId: "",
    legalEntityId: "",
    roleId: "",
    entityId: "",
  });

  const canEdit = hasPerm(session, "people.edit");
  const canAssignRoles = hasPerm(session, "roles.assign");
  const canSeeRoles = session
    ? canSeeItem(findNavItem("/app/company/roles") ?? { href: "/app/company/roles", permission: "roles.assign" }, session)
    : false;
  const canSeeAudit = session
    ? canSeeItem(findNavItem("/app/company/audit") ?? { href: "/app/company/audit", permission: "audit.read" }, session)
    : false;

  const detail = useQuery({
    queryKey: ["person", id],
    queryFn: () => api.get<Detail>(`/people/${id}`),
  });
  const refs = useQuery({
    queryKey: ["people-refs"],
    queryFn: async () => ({
      people: await api.get<Row[]>("/people"),
      departments: await api.get<Row[]>("/departments"),
      locations: await api.get<Row[]>("/locations"),
      entities: await api.get<Row[]>("/entities"),
      roles: await api.get<Row[]>("/rbac"),
    }),
    enabled: canEdit || canAssignRoles,
  });

  useEffect(() => {
    if (!detail.data) return;
    const { user } = detail.data;
    setAssignment((current) => ({
      ...current,
      managerId: user.managerId ?? "",
      departmentId: user.departmentId ?? "",
      locationId: user.locationId ?? "",
      legalEntityId: user.legalEntityId ?? "",
    }));
  }, [detail.data]);

  const action = useMutation({
    mutationFn: ({ name, body = {} }: { name: string; body?: Record<string, unknown> }) =>
      api.post(`/people/${id}/${name}`, body),
    onSuccess: (result: unknown, input) => {
      const activationPath = (result as { activationPath?: string })?.activationPath;
      setMessage(
        activationPath
          ? `Sandbox activation link: ${window.location.origin}${activationPath}`
          : `${input.name.replaceAll("-", " ")} completed.`,
      );
      void client.invalidateQueries({ queryKey: ["person", id] });
      void client.invalidateQueries({ queryKey: ["resource", "people"] });
    },
  });

  function update(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    action.mutate({
      name: "update",
      body: {
        managerId: assignment.managerId || null,
        departmentId: assignment.departmentId || null,
        locationId: assignment.locationId || null,
        legalEntityId: assignment.legalEntityId || null,
      },
    });
  }

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load this person.{" "}
        <button type="button" className="text-button" onClick={() => void detail.refetch()}>Try again</button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading person…</p>;

  const { user, roles, audit } = detail.data;
  const entityName = (entityId?: string | null) =>
    refs.data?.entities.find((row) => row.id === entityId)?.name ?? (entityId ? entityId.slice(0, 8) : "Organization");

  return (
    <div className="stack-lg person-detail linked-dest-page">
      <div className="resource-heading">
        <PageHeader
          title={`${user.firstName} ${user.lastName}`}
          subtitle={`${user.email} · person record`}
        />
        <div className="detail-actions-top">
          <StatusBadge status={user.status} />
          <Link className="btn btn-ghost" href="/app/company/people">Back to people</Link>
        </div>
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {action.isError && <p className="error" role="alert">{action.error.message}</p>}

      <div className="work-panels">
        <section className="work-panel">
          <h2>Profile</h2>
          <dl className="detail-list">
            <div><dt>Name</dt><dd>{user.firstName} {user.lastName}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={user.status} /></dd></div>
          </dl>
        </section>

        <section className="work-panel">
          <h2>Employment assignments</h2>
          {canEdit ? (
            <form className="form-grid" onSubmit={update}>
              <label>
                Manager
                <select
                  className="input"
                  value={assignment.managerId}
                  onChange={(event) => setAssignment({ ...assignment, managerId: event.target.value })}
                >
                  <option value="">None</option>
                  {(refs.data?.people ?? []).filter((row) => row.id !== id).map((row) => (
                    <option value={row.id} key={row.id}>{row.name ?? row.email}</option>
                  ))}
                </select>
              </label>
              <label>
                Department
                <select
                  className="input"
                  value={assignment.departmentId}
                  onChange={(event) => setAssignment({ ...assignment, departmentId: event.target.value })}
                >
                  <option value="">None</option>
                  {(refs.data?.departments ?? []).map((row) => (
                    <option value={row.id} key={row.id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <select
                  className="input"
                  value={assignment.locationId}
                  onChange={(event) => setAssignment({ ...assignment, locationId: event.target.value })}
                >
                  <option value="">None</option>
                  {(refs.data?.locations ?? []).map((row) => (
                    <option value={row.id} key={row.id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Legal entity
                <select
                  className="input"
                  value={assignment.legalEntityId}
                  onChange={(event) => setAssignment({ ...assignment, legalEntityId: event.target.value })}
                >
                  <option value="">None</option>
                  {(refs.data?.entities ?? []).map((row) => (
                    <option value={row.id} key={row.id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" type="submit" disabled={action.isPending}>
                Save assignments
              </button>
            </form>
          ) : (
            <dl className="detail-list">
              <div><dt>Manager</dt><dd>{user.managerId ? user.managerId.slice(0, 8) : "—"}</dd></div>
              <div><dt>Department</dt><dd>{user.departmentId ? user.departmentId.slice(0, 8) : "—"}</dd></div>
              <div><dt>Location</dt><dd>{user.locationId ? user.locationId.slice(0, 8) : "—"}</dd></div>
              <div><dt>Legal entity</dt><dd>{user.legalEntityId ? user.legalEntityId.slice(0, 8) : "—"}</dd></div>
            </dl>
          )}
          {!canEdit && (
            <p className="muted" style={{ marginTop: 8 }}>You can view this person but need people edit access to change assignments.</p>
          )}
        </section>
      </div>

      <section className="work-panel">
        <h2>Roles</h2>
        <ul className="plain-list person-role-list">
          {roles.map((role) => (
            <li key={role.assignmentId} className="person-role-row">
              <div>
                {canSeeRoles ? (
                  <Link className="detail-link" href={`/app/company/roles/${role.id}`}>
                    <strong>{role.name}</strong>
                  </Link>
                ) : (
                  <strong>{role.name}</strong>
                )}
                <small className="muted"> · {role.entityId ? entityName(role.entityId) : "Organization scope"}</small>
              </div>
              {canAssignRoles && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ name: "remove-role", body: { assignmentId: role.assignmentId } })}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {!roles.length && <li className="muted">No roles assigned.</li>}
        </ul>
        {canAssignRoles && (
          <div className="form-grid" style={{ marginTop: 16 }}>
            <label>
              Role
              <select
                className="input"
                aria-label="Role"
                value={assignment.roleId}
                onChange={(event) => setAssignment({ ...assignment, roleId: event.target.value })}
              >
                <option value="">Select role</option>
                {(refs.data?.roles ?? []).map((role) => (
                  <option value={role.id} key={role.id}>{role.name}</option>
                ))}
              </select>
            </label>
            <label>
              Entity scope
              <select
                className="input"
                aria-label="Role entity scope"
                value={assignment.entityId}
                onChange={(event) => setAssignment({ ...assignment, entityId: event.target.value })}
              >
                <option value="">Organization scope</option>
                {(refs.data?.entities ?? []).map((entity) => (
                  <option value={entity.id} key={entity.id}>{entity.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!assignment.roleId || action.isPending}
              onClick={() => action.mutate({
                name: "assign-role",
                body: { roleId: assignment.roleId, entityId: assignment.entityId || null },
              })}
            >
              Assign role
            </button>
          </div>
        )}
        {!canAssignRoles && (
          <p className="muted" style={{ marginTop: 12 }}>Role assignment requires roles.assign.</p>
        )}
      </section>

      {canEdit && (
        <section className="work-panel">
          <h2>Account actions</h2>
          <div className="detail-actions">
            {user.status === "ACTIVE" && (
              <button type="button" className="btn btn-ghost" disabled={action.isPending} onClick={() => action.mutate({ name: "suspend" })}>
                Suspend
              </button>
            )}
            <button type="button" className="btn btn-ghost" disabled={action.isPending} onClick={() => action.mutate({ name: "reset-credentials" })}>
              Reset activation / credentials
            </button>
            {user.status !== "TERMINATED" && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={action.isPending}
                onClick={() => window.confirm("Terminate this person?") && action.mutate({ name: "terminate" })}
              >
                Terminate
              </button>
            )}
          </div>
        </section>
      )}

      <section className="work-panel">
        <h2>Activity</h2>
        <ul className="plain-list">
          {audit.map((event) => (
            <li key={event.id}>{event.action} · {new Date(event.createdAt).toLocaleString()}</li>
          ))}
          {!audit.length && <li className="muted">No recent activity.</li>}
        </ul>
        {canSeeAudit && (
          <p className="muted" style={{ marginTop: 12 }}>
            <Link className="detail-link" href="/app/company/audit">
              Full audit log →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
