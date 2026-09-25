"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";

type Step = { type: string; mode: "sequential" | "parallel"; parallelGroup?: string; minAmount?: number; maxAmount?: number; departmentId?: string; legalEntityId?: string };
type Workflow = { id: string; name: string; objectType: string; version: number; enabled: boolean; steps: Step[] };
const blank = { name: "", objectType: "spend_request", enabled: false, steps: [{ type: "manager", mode: "sequential" }] as Step[] };

export default function ApprovalBuilderPage() {
  const client = useQueryClient(); const [form, setForm] = useState(blank); const [editing, setEditing] = useState<Workflow | null>(null); const [message, setMessage] = useState("");
  const rows = useQuery({ queryKey: ["approval-workflows"], queryFn: () => api.get<Workflow[]>("/approvals") });
  const save = useMutation({ mutationFn: () => api.post(editing ? `/approvals/${editing.id}/version` : "/approvals", form), onSuccess: () => { setMessage(editing ? "New workflow version saved." : "Workflow created."); setEditing(null); setForm(blank); void client.invalidateQueries({ queryKey: ["approval-workflows"] }); } });
  const toggle = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.post(`/approvals/${id}/${enabled ? "enable" : "disable"}`, {}), onSuccess: () => void client.invalidateQueries({ queryKey: ["approval-workflows"] }) });
  const preview = useMutation({ mutationFn: () => api.post<{ steps: Step[]; selfApprovalProtected: boolean; separationOfDuties: boolean }>("/approvals/preview", { steps: form.steps, amount: 10000 }) });
  function updateStep(index: number, patch: Partial<Step>) { setForm({ ...form, steps: form.steps.map((step, i) => i === index ? { ...step, ...patch } : step) }); }
  function submit(event: FormEvent) { event.preventDefault(); save.mutate(); }
  return <div className="stack-lg"><PageHeader title="Approval workflow builder" subtitle="Configure serial and parallel routing over the shared approval engine." />{message && <p className="notice">{message}</p>}
    <section className="panel"><h2>{editing ? `Edit ${editing.name} as version ${editing.version + 1}` : "Create workflow"}</h2><form className="record-form" onSubmit={submit}>
      <label>Workflow name<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Object type<select className="input" value={form.objectType} onChange={(e) => setForm({ ...form, objectType: e.target.value })}>{["spend_request","bill","expense","reimbursement","procurement","travel"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="checkbox"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enable after save</label>
      <fieldset><legend>Approval steps</legend>{form.steps.map((step, index) => <div className="form-grid" key={index}>
        <select className="input" aria-label={`Approver ${index + 1}`} value={step.type} onChange={(e) => updateStep(index, { type: e.target.value })}>{["manager","budget","finance","ap","controller","department_head","legal","cfo","entity"].map((value) => <option key={value}>{value}</option>)}</select>
        <select className="input" aria-label="Step mode" value={step.mode} onChange={(e) => updateStep(index, { mode: e.target.value as Step["mode"] })}><option value="sequential">Serial</option><option value="parallel">Parallel</option></select>
        {step.mode === "parallel" && <input className="input" placeholder="Parallel group" value={step.parallelGroup ?? ""} onChange={(e) => updateStep(index, { parallelGroup: e.target.value })} />}
        <input className="input" type="number" placeholder="Minimum amount" value={step.minAmount ?? ""} onChange={(e) => updateStep(index, { minAmount: e.target.value ? Number(e.target.value) : undefined })} />
        <input className="input" type="number" placeholder="Maximum amount" value={step.maxAmount ?? ""} onChange={(e) => updateStep(index, { maxAmount: e.target.value ? Number(e.target.value) : undefined })} />
        <button className="btn btn-ghost" type="button" disabled={form.steps.length === 1} onClick={() => setForm({ ...form, steps: form.steps.filter((_, i) => i !== index) })}>Remove</button>
      </div>)}<button className="btn btn-ghost" type="button" onClick={() => setForm({ ...form, steps: [...form.steps, { type: "finance", mode: "sequential" }] })}>Add step</button></fieldset>
      {(save.error || preview.error) && <p className="error">{(save.error ?? preview.error)?.message}</p>}<div className="detail-actions"><button className="btn btn-primary" disabled={save.isPending}>Save {editing ? "new version" : "workflow"}</button><button className="btn btn-ghost" type="button" onClick={() => preview.mutate()}>Preview / simulate</button></div>
    </form>{preview.data && <div className="policy-box"><strong>{preview.data.steps.length} applicable steps</strong><p>Self-approval protection: on · separation of duties: on</p><ol>{preview.data.steps.map((step, i) => <li key={i}>{step.type} · {step.mode}</li>)}</ol></div>}</section>
    <section className="panel"><h2>Workflow versions</h2><ul className="plain-list">{(rows.data ?? []).map((row) => <li key={row.id}><strong>{row.name}</strong> v{row.version} · {row.objectType} · <StatusBadge status={row.enabled ? "ENABLED" : "DISABLED"} /> <button className="btn btn-ghost" onClick={() => { setEditing(row); setForm({ name: row.name, objectType: row.objectType, enabled: row.enabled, steps: row.steps }); }}>Edit / version</button><button className="btn btn-ghost" onClick={() => toggle.mutate({ id: row.id, enabled: !row.enabled })}>{row.enabled ? "Disable" : "Enable"}</button></li>)}</ul></section>
  </div>;
}
