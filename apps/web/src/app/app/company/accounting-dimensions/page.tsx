"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type DimValue = { id: string; label: string; active?: boolean };
type Dimension = {
  id: string;
  key: string;
  label: string;
  values: DimValue[] | string[];
  providerSynced: boolean;
  source: string;
};

const PRESETS: Array<{ key: string; label: string; sample: string }> = [
  { key: "glAccount", label: "GL Account", sample: "6100|Office equipment\n6200|Software\n6300|Travel" },
  { key: "department", label: "Department", sample: "engineering|Engineering\nfinance|Finance" },
  { key: "location", label: "Location", sample: "austin|Austin\nremote|Remote" },
  { key: "class", label: "Class", sample: "opex|Operating\ncapex|Capital" },
  { key: "project", label: "Project", sample: "p100|Platform\np200|Customer success" },
  { key: "category", label: "Category", sample: "Software|Software\nTravel|Travel\nOffice|Office" },
  { key: "custom", label: "Custom", sample: "code|Label" },
];

function normalizeValues(values: Dimension["values"]): DimValue[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) =>
    typeof value === "string"
      ? { id: value, label: value, active: true }
      : { id: String(value.id), label: String(value.label || value.id), active: value.active !== false },
  );
}

export default function AccountingDimensionsPage() {
  const session = useSession();
  const client = useQueryClient();
  const [editing, setEditing] = useState<Dimension | null>(null);
  const [preset, setPreset] = useState(PRESETS[0].key);
  const [key, setKey] = useState(PRESETS[0].key);
  const [label, setLabel] = useState(PRESETS[0].label);
  const [values, setValues] = useState(PRESETS[0].sample);
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
      const dimensionKey = preset === "custom" ? key.trim() : preset;
      return api.post(
        editing ? `/accounting-dimensions/${editing.id}/update` : "/accounting-dimensions",
        editing ? { label, values: parsed } : { key: dimensionKey, label, values: parsed },
      );
    },
    onSuccess: () => {
      setMessage("Accounting dimension saved (LOCAL source).");
      setEditing(null);
      applyPreset(PRESETS[0].key);
      void client.invalidateQueries({ queryKey: ["accounting-dimensions"] });
    },
  });

  function applyPreset(next: string) {
    const found = PRESETS.find((item) => item.key === next) ?? PRESETS[0];
    setPreset(found.key);
    setKey(found.key === "custom" ? "" : found.key);
    setLabel(found.label === "Custom" ? "" : found.label);
    setValues(found.sample);
  }

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
          subtitle="Controlled local values for coding. Source stays LOCAL in sandbox; provider metadata is retained for future ERP sync."
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
            {!editing && (
              <label>
                Type
                <select
                  className="input"
                  value={preset}
                  onChange={(e) => applyPreset(e.target.value)}
                >
                  {PRESETS.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
            )}
            {(editing || preset === "custom") && (
              <label>
                Key
                <input
                  className="input"
                  disabled={Boolean(editing)}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  required
                  placeholder="custom_key"
                />
              </label>
            )}
            <label>
              Label
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required />
            </label>
            <label>
              Values <span className="muted">(one per line: code|label — e.g. 6100|Office equipment)</span>
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
                    applyPreset(PRESETS[0].key);
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
          {(rows.data ?? []).map((row) => {
            const vals = normalizeValues(row.values);
            return (
              <li key={row.id}>
                <div>
                  <strong>{row.label}</strong>
                  <small className="muted">
                    {" "}
                    ({row.key}) · {vals.length} values · source {row.source || "LOCAL"}
                  </small>
                  {vals.length > 0 && (
                    <div className="muted" style={{ marginTop: 4 }}>
                      {vals.slice(0, 4).map((v) => `${v.id} · ${v.label}`).join(" · ")}
                      {vals.length > 4 ? ` · +${vals.length - 4} more` : ""}
                    </div>
                  )}
                </div>
                <div className="detail-actions-top">
                  <StatusBadge status={row.providerSynced ? "PROVIDER" : "LOCAL"} />
                  {canCode && !row.providerSynced && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        setEditing(row);
                        setPreset("custom");
                        setKey(row.key);
                        setLabel(row.label);
                        setValues(normalizeValues(row.values).map((value) => `${value.id}|${value.label}`).join("\n"));
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {!rows.isPending && !(rows.data ?? []).length && <li className="muted">No dimensions configured.</li>}
        </ul>
      </section>
    </div>
  );
}
