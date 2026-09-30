"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Integration = {
  id: string;
  family: string;
  provider: string;
  status: string;
  health: string;
  cursor: string | null;
  lastSyncAt: string | null;
  lastError: string;
  updatedAt?: string;
};

export default function Page() {
  const session = useSession();
  const queryClient = useQueryClient();
  const canPing = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("accounting.sync"),
  );
  const canSeeAccountingIntegrations = session
    ? canSeeItem(
        findNavItem("/app/accounting/integrations") ?? {
          href: "/app/accounting/integrations",
          permission: "accounting.read",
        },
        session,
      )
    : false;
  const canSeeAudit = session
    ? canSeeItem(findNavItem("/app/company/audit") ?? { href: "/app/company/audit", permission: "audit.read" }, session)
    : false;
  const canSeeDimensions = session
    ? canSeeItem(
        findNavItem("/app/company/accounting-dimensions") ?? {
          href: "/app/company/accounting-dimensions",
          permission: "accounting.code",
        },
        session,
      )
    : false;

  const list = useQuery({
    queryKey: ["integrations-health"],
    queryFn: () => api.get<Integration[]>("/integrations"),
  });

  const ping = useMutation({
    mutationFn: (id: string) => api.post(`/integrations/${id}/ping`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["integrations-health"] }),
  });

  const rows = list.data ?? [];
  const healthy = rows.filter((row) => row.health === "HEALTHY" || row.status === "CONNECTED").length;
  const degraded = rows.filter((row) => row.health === "DEGRADED" || Boolean(row.lastError)).length;

  return (
    <div className="linked-dest-page stack-lg company-integrations-page">
      <div className="resource-heading">
        <PageHeader
          title="Integration health"
          subtitle="Provider connection status, sync cursors, and sandbox ping. Live sync requires a certified provider."
        />
        <div className="detail-actions-top">
          {canSeeAccountingIntegrations && (
            <Link className="btn btn-ghost" href="/app/accounting/integrations">
              Accounting integrations
            </Link>
          )}
          {canSeeDimensions && (
            <Link className="btn btn-ghost" href="/app/company/accounting-dimensions">
              Dimensions
            </Link>
          )}
          {canSeeAudit && (
            <Link className="btn btn-ghost" href="/app/company/audit">
              Audit log
            </Link>
          )}
        </div>
      </div>

      <div className="overview-stat-grid company">
        <article className="overview-stat">
          <span>Connections</span>
          <strong>{list.isPending ? "…" : rows.length}</strong>
          <small>Configured adapters</small>
        </article>
        <article className="overview-stat">
          <span>Healthy</span>
          <strong>{list.isPending ? "…" : healthy}</strong>
          <small>Ready for sync jobs</small>
        </article>
        <article className="overview-stat">
          <span>Attention</span>
          <strong>{list.isPending ? "…" : degraded}</strong>
          <small>Degraded or last-error set</small>
        </article>
      </div>

      {list.isError && (
        <p className="error-panel" role="alert">
          Could not load integrations.{" "}
          <button type="button" className="text-button" onClick={() => void list.refetch()}>
            Try again
          </button>
        </p>
      )}
      {ping.isError && (
        <p className="error" role="alert">
          {ping.error.message}
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <caption className="sr-only">Integration connections</caption>
          <thead>
            <tr>
              <th scope="col">Family</th>
              <th scope="col">Provider</th>
              <th scope="col">Status</th>
              <th scope="col">Health</th>
              <th scope="col">Cursor</th>
              <th scope="col">Last sync</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.lastError || row.health === "DEGRADED" ? "is-attention" : undefined}>
                <td>{row.family}</td>
                <td>{row.provider}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <StatusBadge status={row.health} />
                </td>
                <td>{row.cursor ?? "—"}</td>
                <td>{row.lastSyncAt ? new Date(row.lastSyncAt).toLocaleString() : "—"}</td>
                <td>
                  {canPing && (
                    <button className="btn btn-ghost" type="button" disabled={ping.isPending} onClick={() => ping.mutate(row.id)}>
                      Sandbox ping
                    </button>
                  )}
                  {row.lastError && <div className="muted">{row.lastError}</div>}
                </td>
              </tr>
            ))}
            {!list.isPending && !rows.length && (
              <tr>
                <td colSpan={7} className="muted">
                  No integrations configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
