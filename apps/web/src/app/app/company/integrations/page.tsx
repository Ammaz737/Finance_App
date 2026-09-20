"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Integration = {
  id: string; family: string; provider: string; status: string; health: string;
  cursor: string | null; lastSyncAt: string | null; lastError: string; updatedAt?: string;
};

export default function Page() {
  const session = useSession();
  const queryClient = useQueryClient();
  const canPing = Boolean(session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("accounting.sync"));

  const list = useQuery({
    queryKey: ["integrations-health"],
    queryFn: () => api.get<Integration[]>("/integrations"),
  });

  const ping = useMutation({
    mutationFn: (id: string) => api.post(`/integrations/${id}/ping`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["integrations-health"] }),
  });

  return <div>
    <PageHeader title="Integration health" subtitle="Provider connection status, sync cursors, and sandbox ping. Live sync requires a real provider." />
    {list.isError && <p className="error-panel" role="alert">Could not load integrations.</p>}
    {list.isPending && <p className="muted">Loading…</p>}
    {ping.isError && <p className="error" role="alert">{ping.error.message}</p>}
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">Integration connections</caption>
        <thead>
          <tr><th scope="col">Family</th><th scope="col">Provider</th><th scope="col">Status</th><th scope="col">Health</th><th scope="col">Cursor</th><th scope="col">Last sync</th><th scope="col">Actions</th></tr>
        </thead>
        <tbody>
          {(list.data ?? []).map((row) => (
            <tr key={row.id}>
              <td>{row.family}</td>
              <td>{row.provider}</td>
              <td><StatusBadge status={row.status} /></td>
              <td><StatusBadge status={row.health} /></td>
              <td>{row.cursor ?? "—"}</td>
              <td>{row.lastSyncAt ? new Date(row.lastSyncAt).toLocaleString() : "—"}</td>
              <td>
                {canPing && <button className="btn btn-ghost" type="button" disabled={ping.isPending} onClick={() => ping.mutate(row.id)}>Sandbox ping</button>}
                {row.lastError && <div className="muted">{row.lastError}</div>}
              </td>
            </tr>
          ))}
          {!list.isPending && !(list.data ?? []).length && <tr><td colSpan={7} className="muted">No integrations configured.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
