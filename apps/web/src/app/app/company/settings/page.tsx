"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Organization = { id: string; name: string; slug: string; createdAt: string };

function navOk(
  session: { roles: string[]; permissions: string[]; entitlements: string[] } | null | undefined,
  href: string,
  fallbackPermission?: string,
) {
  if (!session) return false;
  const item = findNavItem(href) ?? (fallbackPermission ? { href, permission: fallbackPermission } : { href });
  return canSeeItem(item, session);
}

export default function Page() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: () => api.get<Organization[]>("/organizations") });
  const organization = organizations.data?.[0];
  const save = useMutation({
    mutationFn: (nextName: string) =>
      api.request<Organization>(`/organizations/${organization?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      }),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
  const editable = Boolean(session?.roles.includes("Owner") || session?.permissions.includes("*"));

  const structure = [
    navOk(session, "/app/company/entities", "roles.assign") && { href: "/app/company/entities", label: "Legal entities", detail: "Currency and country controls" },
    navOk(session, "/app/company/departments", "roles.assign") && { href: "/app/company/departments", label: "Departments", detail: "People and reporting" },
    navOk(session, "/app/company/locations", "roles.assign") && { href: "/app/company/locations", label: "Locations", detail: "Office and region assignment" },
    navOk(session, "/app/company/people", "people.read") && { href: "/app/company/people", label: "People", detail: "Invite, activate, and assign roles" },
  ].filter(Boolean) as Array<{ href: string; label: string; detail: string }>;

  const access = [
    navOk(session, "/app/company/roles", "roles.assign") && { href: "/app/company/roles", label: "Roles", detail: "Permissions and scopes" },
    navOk(session, "/app/company/policy", "roles.assign") && { href: "/app/company/policy", label: "Policies", detail: "Spend and travel rules" },
    navOk(session, "/app/company/approvals", "roles.assign") && { href: "/app/company/approvals", label: "Approval rules", detail: "Routing workflows" },
  ].filter(Boolean) as Array<{ href: string; label: string; detail: string }>;

  const ops = [
    navOk(session, "/app/company/accounting-dimensions", "accounting.code") && {
      href: "/app/company/accounting-dimensions",
      label: "Accounting dimensions",
      detail: "Local coding values",
    },
    navOk(session, "/app/company/integrations", "report.read") && {
      href: "/app/company/integrations",
      label: "Integrations",
      detail: "Provider health and sync",
    },
    navOk(session, "/app/company/audit", "audit.read") && {
      href: "/app/company/audit",
      label: "Audit log",
      detail: "Material change history",
    },
  ].filter(Boolean) as Array<{ href: string; label: string; detail: string }>;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (organization && name.trim().length >= 2) save.mutate(name.trim());
  }

  return (
    <div className="settings-page company-settings-page linked-dest-page">
      <PageHeader
        title="Company settings"
        subtitle="Organization identity and the structure used across spend, approvals, and accounting."
      />
      {organizations.isError && (
        <p className="error-panel" role="alert">
          Could not load company settings.{" "}
          <button type="button" className="text-button" onClick={() => void organizations.refetch()}>
            Try again
          </button>
        </p>
      )}
      {organizations.isPending && <p className="muted">Loading company settings…</p>}
      {organization && (
        <>
          <section className="settings-card">
            <h2>Organization</h2>
            <dl className="detail-list">
              <div>
                <dt>Name</dt>
                <dd>{organization.name}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{organization.slug}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{new Date(organization.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
            {editable ? (
              <form className="record-form" onSubmit={submit}>
                <label>
                  Update organization name
                  <input
                    className="input"
                    minLength={2}
                    maxLength={120}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={organization.name}
                    required
                  />
                </label>
                {save.isError && (
                  <p className="error" role="alert">
                    {save.error.message}
                  </p>
                )}
                {save.isSuccess && (
                  <p className="notice" role="status">
                    Company name saved.
                  </p>
                )}
                <button className="btn btn-primary" disabled={save.isPending} type="submit">
                  {save.isPending ? "Saving…" : "Save name"}
                </button>
              </form>
            ) : (
              <p className="muted">Only organization owners can rename this workspace.</p>
            )}
          </section>

          {structure.length > 0 && (
            <section className="settings-card">
              <h2>Company structure</h2>
              <p className="muted">
                Legal entities determine currency and country controls. Departments and locations organize people and reporting.
              </p>
              <div className="settings-links">
                {structure.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {access.length > 0 && (
            <section className="settings-card">
              <h2>Access & controls</h2>
              <p className="muted">Roles, policies, and approval routing that gate spend across the company.</p>
              <div className="settings-links">
                {access.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {ops.length > 0 && (
            <section className="settings-card">
              <h2>Operations</h2>
              <p className="muted">Coding dimensions, provider health, and the audit trail.</p>
              <div className="settings-links">
                {ops.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
