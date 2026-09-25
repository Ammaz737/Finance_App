"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";

type Rule = { type: string; threshold?: number; category?: string; action?: string };
type Policy = { id: string; name: string; objectType: string; enabled: boolean; version: number; priority: number; effectiveFrom: string; rules: Rule[] };
const blank = { name: "", objectType: "expense", priority: "100", effectiveFrom: "", enabled: false, rules: [{ type: "receipt_required", threshold: 75, action: "block" }] as Rule[] };

export default function PolicyPage() {
  const client = useQueryClient(); const [form, setForm] = useState(blank); const [editing, setEditing] = useState<Policy | null>(null); const [message, setMessage] = useState("");
  const rows = useQuery({ queryKey: ["policies"], queryFn: () => api.get<Policy[]>("/policies") });
  const save = useMutation({ mutationFn: () => api.post(editing ? `/policies/${editing.id}/version` : "/policies", { ...form, priority: Number(form.priority) }), onSuccess: () => { setMessage(editing ? "New policy version saved." : "Policy created."); setEditing(null); setForm(blank); void client.invalidateQueries({ queryKey: ["policies"] }); } });
  const disable = useMutation({ mutationFn: (id: string) => api.post(`/policies/${id}/disable`, {}), onSuccess: () => { setMessage("Policy disabled."); void client.invalidateQueries({ queryKey: ["policies"] }); } });
  const simulate = useMutation({ mutationFn: () => api.post<{ evaluation: { result: string; explanation: string; matchedRules: string[] } }>("/policies/simulate", { objectType: form.objectType, amount: 100, hasReceipt: false, hasMemo: false }) });
  function edit(row: Policy) { setEditing(row); setForm({ name: row.name, objectType: row.objectType, priority: String(row.priority), effectiveFrom: row.effectiveFrom?.slice(0, 10) ?? "", enabled: row.enabled, rules: row.rules }); }
  function submit(event: FormEvent) { event.preventDefault(); setMessage(""); save.mutate(); }
  function updateRule(index: number, patch: Partial<Rule>) { setForm({ ...form, rules: form.rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) }); }
  return <div className="stack-lg"><PageHeader title="Policy builder" subtitle="Create, version, disable, and simulate rules used by the existing policy engine." />{message && <p className="notice">{message}</p>}
    <section className="panel"><h2>{editing ? `Edit ${editing.name} as version ${editing.version + 1}` : "Create policy"}</h2><form className="record-form" onSubmit={submit}>
      <label>Policy name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label>Object type<select className="input" value={form.objectType} onChange={(e) => setForm({ ...form, objectType: e.target.value })}>{["expense","reimbursement","spend_request","procurement","bill","travel"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Priority<input className="input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></label>
      <label>Effective date<input className="input" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></label>
      <label className="checkbox"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
      <fieldset><legend>Conditions and actions</legend>{form.rules.map((rule, index) => <div className="form-grid" key={index}>
        <select className="input" aria-label={`Rule ${index + 1}`} value={rule.type} onChange={(e) => updateRule(index, { type: e.target.value })}>{["receipt_required","memo_required","vendor_required","quote_required","high_value","category_amount","manager_approval","hard_policy_block","travel_max_amount","travel_out_of_policy"].map((value) => <option key={value}>{value}</option>)}</select>
        <input className="input" aria-label="Amount threshold" type="number" placeholder="Amount threshold" value={rule.threshold ?? ""} onChange={(e) => updateRule(index, { threshold: e.target.value ? Number(e.target.value) : undefined })} />
        <input className="input" aria-label="Category" placeholder="Category" value={rule.category ?? ""} onChange={(e) => updateRule(index, { category: e.target.value || undefined })} />
        <select className="input" aria-label="Action" value={rule.action ?? "review"} onChange={(e) => updateRule(index, { action: e.target.value })}><option value="warn">WARN</option><option value="review">REVIEW / require approval</option><option value="block">BLOCK</option></select>
        <button className="btn btn-ghost" type="button" disabled={form.rules.length === 1} onClick={() => setForm({ ...form, rules: form.rules.filter((_, i) => i !== index) })}>Remove</button>
      </div>)}<button className="btn btn-ghost" type="button" onClick={() => setForm({ ...form, rules: [...form.rules, { type: "memo_required", action: "review" }] })}>Add rule</button></fieldset>
      {(save.error || simulate.error) && <p className="error">{(save.error ?? simulate.error)?.message}</p>}<div className="detail-actions"><button className="btn btn-primary" disabled={save.isPending}>Save {editing ? "new version" : "policy"}</button><button className="btn btn-ghost" type="button" onClick={() => simulate.mutate()}>Simulate</button>{editing && <button className="btn btn-ghost" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel edit</button>}</div>
    </form>{simulate.data && <div className="policy-box"><StatusBadge status={simulate.data.evaluation.result} /> {simulate.data.evaluation.explanation}</div>}</section>
    <section className="panel"><h2>Policy versions</h2><ul className="plain-list">{(rows.data ?? []).map((row) => <li key={row.id}><strong>{row.name}</strong> v{row.version} · {row.objectType} · priority {row.priority} · <StatusBadge status={row.enabled ? "ENABLED" : "DISABLED"} /> <button className="btn btn-ghost" onClick={() => edit(row)}>Edit / version</button>{row.enabled && <button className="btn btn-ghost" onClick={() => disable.mutate(row.id)}>Disable</button>}</li>)}</ul></section>
  </div>;
}
