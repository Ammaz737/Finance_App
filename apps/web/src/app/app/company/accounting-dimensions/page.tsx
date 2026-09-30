"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Dimension = {
  id: string;
  key: string;
  label: string;
  values: Array<{ id: string; label: string; active?: boolean }>;
  providerSynced: boolean;
  source: string;
};

export default function AccountingDimensionsPage() {
  const session = useSession();
  const client = useQueryClient();
  const [editing, setEditing] = useState<Dimension | null>(null);
  const [key, setKey] = useState("gl_account");
  const [label, setLabel] = useState("GL Accounts");
  const [values, setValues] = useState("");
  const [message, setMessage] = useState("");

  const canSeeAccounting = session
    ? canSeeItem(
        findNavItem("/app/accounting/overview") ?? { href: "/app/accounting/overview", permission: "accounting.read" },
        session,
      )
    : false;
  const canSeeIntegrations = session
    ? canSeeItem(
        findNavItem("/app/company/integrations") ?? { href: "/app/company/integrations", permission: "report.read" },
        session,
      )
    : false;
  const canCode = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("accounting.code"),
  );

  const rows = useQuery({
    queryKey: ["accounting-dimensions"],
    queryFn: () => api.get<Dimension[]>("/accounting-dimensions"),
  });
  const save = useMutation({
    mutationFn: () => {
      const parsed = values
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [id, ...name] = line.split("|");
          return { id: id.trim(), label: (name.join("|") || id).trim(), active: true };
        });
      return api.post(editing ? `/accounting-dimensions/${editing.id}/update` : "/accounting-dimensions", editing ? { label, values: parsed } : { key, label, values: parsed });
    },
    onSuccess: () => {
      setMessage("Accounting dimension saved.");
      setEditing(null);
      setValues("");
      void client.invalidateQueries({ queryKey: ["accounting-dimensions"] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canCode) return;
    save.mutate();
  }

  return (
    <div className="stack-lg company-builder-page linked-dest-page">
      <div className="resource-heading">
        <PageHeader
          title="Accounting dimensions"
          subtitle="Controlled local values for coding. Provider source metadata is preserved for future ERP sync."
        />
        <div className="detail-actions-top">
          {canSeeAccounting && (
            <Link className="btn btn-ghost" href="/app/accounting/overview">
              Accounting
            </Link>
          )}
          {canSeeIntegrations && (
            <Link className="btn btn-ghost" href="/app/company/integrations">
              Integrations
            </Link>
          )}
        </div>
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {rows.isError && (
        <p className="error-panel" role="alert">
          Could not load dimensions.{" "}
          <button type="button" className="text-button" onClick={() => void rows.refetch()}>
            Try again
          </button>
        </p>
      )}

      {canCode ? (
        <section className="work-panel">
          <h2>{editing ? `Edit ${editing.label}` : "Add local dimension"}</h2>
          <form className="record-form" onSubmit={submit}>
            <label>
              Key
              <input className="input" disabled={Boolean(editing)} value={key} onChange={(e) => setKey(e.target.value)} required />
            </label>
            <label>
              Label
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required />
            </label>
            <label>
              Values <span className="muted">(one per line: code|label)</span>
              <textarea className="input" rows={8} value={values} onChange={(e) => setValues(e.target.value)} required />
            </label>
            {save.error && <p className="error">{save.error.message}</p>}
            <div className="detail-actions">
              <button className="btn btn-primary" disabled={save.isPending}>
                Save dimension
              </button>
              {editing && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setKey("gl_account");
                    setLabel("GL Accounts");
                    setValues("");
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      ) : (
        <p className="muted">You can view dimensions. Creating or editing requires accounting.code.</p>
      )}

      <section className="work-panel">
        <h2>Configured dimensions</h2>
        {rows.isPending && <p className="muted">Loading…</p>}
        <ul className="company-version-list">
          {(rows.data ?? []).map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.label}</strong>
                <small className="muted">
                  {" "}
                  ({row.key}) · {row.values.length} values · source {row.source || "local"}
                </small>
              </div>
              <div className="detail-actions-top">
                <StatusBadge status={row.providerSynced ? "PROVIDER" : "LOCAL"} />
                {canCode && !row.providerSynced && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      setEditing(row);
                      setKey(row.key);
                      setLabel(row.label);
                      setValues(row.values.map((value) => `${value.id}|${value.label}`).join("\n"));
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </li>
          ))}
          {!rows.isPending && !(rows.data ?? []).length && <li className="muted">No dimensions configured.</li>}
        </ul>
      </section>
    </div>
  );
}
