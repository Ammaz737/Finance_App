"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { useSession } from "@/providers/session-provider";
import { api } from "@/lib/api";

type IntegrationRow = {
  id: string;
  name?: string;
  provider?: string;
  status?: string;
  type?: string;
  lastSyncAt?: string;
  createdAt?: string;
};

type QuickBooksStatus = {
  configured: boolean;
  connected: boolean;
  companyName?: string;
  realmId?: string;
  environment?: string;
  accessTokenExpiresAt?: string;
  lastCatalogSyncAt?: string;
  health?: string;
  lastError?: string;
  mappings?: Record<MappingKey, string>;
  accounts?: Array<{ id: string; name: string; accountType: string }>;
};

type MappingKey = "expenseAccountId" | "cardAccountId" | "apAccountId" | "bankAccountId";

const mappingFields: Array<{ key: MappingKey; label: string; hint: string }> = [
  { key: "expenseAccountId", label: "Default expense account", hint: "Used when a transaction line has no explicit GL account." },
  { key: "cardAccountId", label: "Card liability account", hint: "Credit card account used for card purchases." },
  { key: "apAccountId", label: "Accounts payable account", hint: "A/P account used for vendor bills." },
  { key: "bankAccountId", label: "Payment bank account", hint: "Bank account used for bill and reimbursement payments." },
];

export default function Page() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<Record<MappingKey, string>>({ expenseAccountId: "", cardAccountId: "", apAccountId: "", bankAccountId: "" });
  const canSeeCompany = session
    ? canSeeItem(
        findNavItem("/app/company/integrations") ?? {
          href: "/app/company/integrations",
          permission: "report.read",
        },
        session,
      )
    : false;

  const columns: Column<IntegrationRow>[] = [
    {
      key: "name",
      header: "Integration",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || row.provider || "Integration"}</strong>
          <small>{row.type || row.provider || "Accounting connector"}</small>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "lastSyncAt",
      header: "Last sync",
      render: (row) =>
        row.lastSyncAt
          ? new Date(row.lastSyncAt).toLocaleString()
          : row.createdAt
            ? new Date(row.createdAt).toLocaleDateString()
            : "—",
    },
  ];

  const status = useQuery({
    queryKey: ["quickbooks-status"],
    queryFn: () => api.get<QuickBooksStatus>("/integrations/quickbooks/status"),
  });
  useEffect(() => {
    if (status.data?.mappings) setMappings(status.data.mappings);
  }, [status.data?.mappings]);

  const connect = useMutation({
    mutationFn: () => api.post<{ authorizationUrl: string }>("/integrations/quickbooks/connect", { returnPath: "/app/accounting/integrations" }),
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
  });
  const refresh = useMutation({
    mutationFn: () => api.post("/integrations/quickbooks/refresh", {}),
    onSuccess: () => void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quickbooks-status"] }),
      queryClient.invalidateQueries({ queryKey: ["resource", "integrations"] }),
    ]),
  });
  const saveMappings = useMutation({
    mutationFn: () => api.post("/integrations/quickbooks/mappings", mappings),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["quickbooks-status"] }),
  });
  const disconnect = useMutation({
    mutationFn: () => api.post("/integrations/quickbooks/disconnect", {}),
    onSuccess: () => void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quickbooks-status"] }),
      queryClient.invalidateQueries({ queryKey: ["resource", "integrations"] }),
    ]),
  });
  const operationError = connect.error ?? refresh.error ?? saveMappings.error ?? disconnect.error;
  const callbackMessage = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("message") : null;

  return (
    <div className="accounting-queue-page">
      <div className="stack-lg">
        <PageHeader title="QuickBooks Online" subtitle="Secure OAuth connection, accounting mappings, and sync health for this workspace." />
        {callbackMessage && <p className="error-panel" role="alert">{callbackMessage}</p>}
        {operationError && <p className="error-panel" role="alert">{operationError.message}</p>}
        <section className="detail-card stack-md" aria-label="QuickBooks connection">
          <div className="resource-heading">
            <div>
              <strong>{status.data?.connected ? status.data.companyName || "QuickBooks company" : "QuickBooks Online"}</strong>
              <p className="muted">
                {status.isPending
                  ? "Checking connection…"
                  : status.data?.connected
                    ? `${status.data.environment ?? "sandbox"} · company ${status.data.realmId ?? ""}`
                    : status.data?.configured
                      ? "Ready to connect through Intuit OAuth."
                      : "Add QuickBooks client credentials to the API environment first."}
              </p>
            </div>
            <StatusBadge status={status.data?.connected ? status.data.health || "CONNECTED" : "DISCONNECTED"} />
          </div>
          {status.data?.lastError && <p className="error-panel" role="alert">{status.data.lastError}</p>}
          {!status.data?.connected ? (
            <div className="detail-actions-top">
              <button className="btn btn-primary" type="button" disabled={!status.data?.configured || connect.isPending} onClick={() => connect.mutate()}>
                {connect.isPending ? "Opening QuickBooks…" : "Connect QuickBooks"}
              </button>
            </div>
          ) : (
            <>
              <div className="form-grid">
                {mappingFields.map((field) => (
                  <label key={field.key} className="field">
                    <span>{field.label}</span>
                    <select value={mappings[field.key]} onChange={(event) => setMappings((current) => ({ ...current, [field.key]: event.target.value }))}>
                      <option value="">Select an account</option>
                      {(status.data?.accounts ?? []).map((account) => (
                        <option key={account.id} value={account.id}>{account.name} · {account.accountType}</option>
                      ))}
                    </select>
                    <small className="muted">{field.hint}</small>
                  </label>
                ))}
              </div>
              <div className="detail-actions-top">
                <button className="btn btn-primary" type="button" disabled={saveMappings.isPending || Object.values(mappings).some((value) => !value)} onClick={() => saveMappings.mutate()}>
                  {saveMappings.isPending ? "Saving…" : "Save mappings"}
                </button>
                <button className="btn btn-ghost" type="button" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
                  {refresh.isPending ? "Refreshing…" : "Refresh QuickBooks data"}
                </button>
                <button className="btn btn-ghost" type="button" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                  {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
              <p className="muted">Last catalog sync: {status.data.lastCatalogSyncAt ? new Date(status.data.lastCatalogSyncAt).toLocaleString() : "Not completed"}</p>
            </>
          )}
        </section>
      </div>
      <ResourcePage
        title="Accounting integrations"
        path="integrations"
        columns={columns}
        pageSize={20}
        actions={[{ label: "Ping", name: "ping" }]}
      />
      <p className="muted my-expenses-hint">
        Sync ready entries from{" "}
        <Link className="detail-link" href="/app/accounting/ready-to-sync">
          Ready to sync
        </Link>
        {canSeeCompany ? (
          <>
            . Org-wide connector health is under{" "}
            <Link className="detail-link" href="/app/company/integrations">
              Company integrations
            </Link>
            .
          </>
        ) : (
          "."
        )}
      </p>
    </div>
  );
}
