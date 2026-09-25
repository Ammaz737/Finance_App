"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";

type Dimension = { id: string; key: string; label: string; values: Array<{ id: string; label: string; active?: boolean }>; providerSynced: boolean; source: string };
export default function AccountingDimensionsPage() {
  const client = useQueryClient(); const [editing, setEditing] = useState<Dimension | null>(null); const [key, setKey] = useState("gl_account"); const [label, setLabel] = useState("GL Accounts"); const [values, setValues] = useState(""); const [message, setMessage] = useState("");
  const rows = useQuery({ queryKey: ["accounting-dimensions"], queryFn: () => api.get<Dimension[]>("/accounting-dimensions") });
  const save = useMutation({ mutationFn: () => { const parsed = values.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [id, ...name] = line.split("|"); return { id: id.trim(), label: (name.join("|") || id).trim(), active: true }; }); return api.post(editing ? `/accounting-dimensions/${editing.id}/update` : "/accounting-dimensions", editing ? { label, values: parsed } : { key, label, values: parsed }); }, onSuccess: () => { setMessage("Accounting dimension saved."); setEditing(null); setValues(""); void client.invalidateQueries({ queryKey: ["accounting-dimensions"] }); } });
  function submit(event: FormEvent) { event.preventDefault(); save.mutate(); }
  return <div className="stack-lg"><PageHeader title="Accounting dimensions" subtitle="Controlled local values for coding. Provider source metadata is preserved for future ERP sync." />{message && <p className="notice">{message}</p>}<section className="panel"><h2>{editing ? `Edit ${editing.label}` : "Add local dimension"}</h2><form className="record-form" onSubmit={submit}>
    <label>Key<input className="input" disabled={Boolean(editing)} value={key} onChange={(e) => setKey(e.target.value)} required /></label><label>Label<input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required /></label>
    <label>Values <span className="muted">(one per line: code|label)</span><textarea className="input" rows={8} value={values} onChange={(e) => setValues(e.target.value)} required /></label>{save.error && <p className="error">{save.error.message}</p>}<button className="btn btn-primary">Save dimension</button>
  </form></section><section className="panel"><h2>Configured dimensions</h2><ul className="plain-list">{(rows.data ?? []).map((row) => <li key={row.id}><strong>{row.label}</strong> ({row.key}) · {row.values.length} values · <StatusBadge status={row.providerSynced ? "PROVIDER" : "LOCAL"} /> {!row.providerSynced && <button className="btn btn-ghost" onClick={() => { setEditing(row); setKey(row.key); setLabel(row.label); setValues(row.values.map((value) => `${value.id}|${value.label}`).join("\n")); }}>Edit</button>}</li>)}</ul></section></div>;
}
