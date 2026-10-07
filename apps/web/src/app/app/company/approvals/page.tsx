"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Step = {
  type: string;
  mode: "sequential" | "parallel";
  parallelGroup?: string;
  minAmount?: number;
  maxAmount?: number;
  departmentId?: string;
  legalEntityId?: string;
};
type Workflow = {
  id: string;
  name: string;
  objectType: string;
  version: number;
  enabled: boolean;
  steps: Step[];
};
type Named = { id: string; name: string };

function normalizeSteps(steps: Array<Partial<Step> | Record<string, unknown>> | undefined): Step[] {
  if (!Array.isArray(steps) || !steps.length) {
    return [{ type: "manager", mode: "sequential" }];
  }
  return steps.map((raw) => {
    const step = raw as Partial<Step>;
    return {
      type: String(step.type ?? "manager"),
      mode: step.mode === "parallel" ? "parallel" : "sequential",
      parallelGroup: step.parallelGroup ? String(step.parallelGroup) : undefined,
      minAmount: step.minAmount != null ? Number(step.minAmount) : undefined,
      maxAmount: step.maxAmount != null ? Number(step.maxAmount) : undefined,
      departmentId: step.departmentId ? String(step.departmentId) : undefined,
      legalEntityId: step.legalEntityId ? String(step.legalEntityId) : undefined,
    };
  });
}

const blank = {
  name: "Spend two-step approval",
  objectType: "spend_request",
  enabled: false,
  steps: [
    { type: "manager", mode: "sequential" as const },
    { type: "finance", mode: "sequential" as const, minAmount: 500 },
  ] as Step[],
};

export default function ApprovalBuilderPage() {
  const session = useSession();
  const client = useQueryClient();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [message, setMessage] = useState("");
  const [previewAmount, setPreviewAmount] = useState("1000");
  const [previewDepartmentId, setPreviewDepartmentId] = useState("");
  const [previewEntityId, setPreviewEntityId] = useState("");

  const canSeePolicy = session
    ? canSeeItem(findNavItem("/app/company/policy") ?? { href: "/app/company/policy", permission: "roles.assign" }, session)
    : false;
  const canSeeInbox = session
    ? canSeeItem(findNavItem("/app/inbox") ?? { href: "/app/inbox" }, session)
    : true;

  const refs = useQuery({
    queryKey: ["approval-builder-refs"],
    queryFn: async () => ({
      departments: await api.get<Named[]>("/departments"),
      entities: await api.get<Named[]>("/entities"),
    }),
  });

  const rows = useQuery({ queryKey: ["approval-workflows"], queryFn: () => api.get<Workflow[]>("/approvals") });
  const save = useMutation({
    mutationFn: () => api.post(editing ? `/approvals/${editing.id}/version` : "/approvals", form),
    onSuccess: () => {
      setMessage(
        editing
          ? "New workflow version saved (prior version retired)."
          : form.enabled
            ? "Workflow created and enabled as the active version."
            : "Workflow created (disabled). Preview, then Enable when ready.",
      );
      setEditing(null);
      setForm(blank);
      void client.invalidateQueries({ queryKey: ["approval-workflows"] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.post(`/approvals/${id}/${enabled ? "enable" : "disable"}`, {}),
    onSuccess: (_data, vars) => {
      setMessage(vars.enabled ? "Workflow enabled as the active version for its object type." : "Workflow disabled.");
      void client.invalidateQueries({ queryKey: ["approval-workflows"] });
    },
  });
  const preview = useMutation({
    mutationFn: () =>
      api.post<{ steps: Step[]; selfApprovalProtected: boolean; separationOfDuties: boolean }>("/approvals/preview", {
        steps: form.steps,
        amount: Number(previewAmount) || 0,
        departmentId: previewDepartmentId || undefined,
        legalEntityId: previewEntityId || undefined,
      }),
  });

  function updateStep(index: number, patch: Partial<Step>) {
    setForm({ ...form, steps: form.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <div className="stack-lg company-builder-page linked-dest-page">
      <div className="resource-heading">
        <PageHeader
          title="Approval workflow builder"
          subtitle="Configure serial and parallel routing. Self-approval and separation of duties stay enforced by the shared engine."
        />
        <div className="detail-actions-top">
          {canSeePolicy && (
            <Link className="btn btn-ghost" href="/app/company/policy">
              Policies
            </Link>
          )}
          {canSeeInbox && (
            <Link className="btn btn-ghost" href="/app/inbox">
              Inbox
            </Link>
          )}
        </div>
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {rows.isError && (
        <p className="error-panel" role="alert">
          Could not load workflows.{" "}
          <button type="button" className="text-button" onClick={() => void rows.refetch()}>
            Try again
          </button>
        </p>
      )}

      <section className="work-panel">
        <h2>{editing ? `Edit ${editing.name} as version ${editing.version + 1}` : "Create workflow"}</h2>
        <form className="record-form" onSubmit={submit}>
          <label>
            Workflow name
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Object type
            <select className="input" value={form.objectType} onChange={(e) => setForm({ ...form, objectType: e.target.value })}>
              {["spend_request", "bill", "expense", "reimbursement", "procurement", "travel"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enable after
            save (creates the active version)
          </label>
          <fieldset>
            <legend>Approval steps</legend>
            {form.steps.map((step, index) => (
              <div className="form-grid" key={index}>
                <select className="input" aria-label={`Approver ${index + 1}`} value={step.type} onChange={(e) => updateStep(index, { type: e.target.value })}>
                  {["manager", "budget", "finance", "ap", "controller", "department_head", "legal", "cfo", "entity"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <select
                  className="input"
                  aria-label="Step mode"
                  value={step.mode}
                  onChange={(e) => updateStep(index, { mode: e.target.value as Step["mode"] })}
                >
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                </select>
                {step.mode === "parallel" && (
                  <input
                    className="input"
                    placeholder="Parallel group"
                    aria-label="Parallel group"
                    value={step.parallelGroup ?? ""}
                    onChange={(e) => updateStep(index, { parallelGroup: e.target.value || undefined })}
                  />
                )}
                <input
                  className="input"
                  type="number"
                  placeholder="Minimum amount"
                  aria-label="Minimum amount"
                  value={step.minAmount ?? ""}
                  onChange={(e) => updateStep(index, { minAmount: e.target.value ? Number(e.target.value) : undefined })}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Maximum amount"
                  aria-label="Maximum amount"
                  value={step.maxAmount ?? ""}
                  onChange={(e) => updateStep(index, { maxAmount: e.target.value ? Number(e.target.value) : undefined })}
                />
                <select
                  className="input"
                  aria-label="Department routing"
                  value={step.departmentId ?? ""}
                  onChange={(e) => updateStep(index, { departmentId: e.target.value || undefined })}
                >
                  <option value="">Any department</option>
                  {(refs.data?.departments ?? []).map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
                <select
                  className="input"
                  aria-label="Entity routing"
                  value={step.legalEntityId ?? ""}
                  onChange={(e) => updateStep(index, { legalEntityId: e.target.value || undefined })}
                >
                  <option value="">Any entity</option>
                  {(refs.data?.entities ?? []).map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={form.steps.length === 1}
                  onClick={() => setForm({ ...form, steps: form.steps.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setForm({ ...form, steps: [...form.steps, { type: "finance", mode: "sequential" }] })}
            >
              Add step
            </button>
          </fieldset>

          <fieldset>
            <legend>Preview / simulate</legend>
            <div className="form-grid">
              <label>
                Amount
                <input className="input" type="number" value={previewAmount} onChange={(e) => setPreviewAmount(e.target.value)} />
              </label>
              <label>
                Department
                <select className="input" value={previewDepartmentId} onChange={(e) => setPreviewDepartmentId(e.target.value)}>
                  <option value="">Any</option>
                  {(refs.data?.departments ?? []).map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Entity
                <select className="input" value={previewEntityId} onChange={(e) => setPreviewEntityId(e.target.value)}>
                  <option value="">Any</option>
                  {(refs.data?.entities ?? []).map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">Uses the shared workflow resolver on the draft steps above (amount / department / entity filters).</p>
          </fieldset>

          {(save.error || preview.error) && <p className="error">{(save.error ?? preview.error)?.message}</p>}
          <div className="detail-actions">
            <button className="btn btn-primary" disabled={save.isPending}>
              Save {editing ? "new version" : "workflow"}
            </button>
            <button className="btn btn-ghost" type="button" disabled={preview.isPending} onClick={() => preview.mutate()}>
              Preview / simulate
            </button>
            {editing && (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(blank);
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
        {preview.data && (
          <div className="policy-box">
            <strong>{preview.data.steps.length} applicable step{preview.data.steps.length === 1 ? "" : "s"}</strong>
            <p>
              Self-approval protection: {preview.data.selfApprovalProtected ? "on" : "off"} · separation of duties:{" "}
              {preview.data.separationOfDuties ? "on" : "off"}
            </p>
            <ol>
              {preview.data.steps.map((step, i) => (
                <li key={i}>
                  {step.type} · {step.mode}
                  {step.minAmount != null ? ` · min ${step.minAmount}` : ""}
                  {step.parallelGroup ? ` · group ${step.parallelGroup}` : ""}
                </li>
              ))}
            </ol>
            {!preview.data.steps.length && <p className="muted">No steps apply at this amount / routing — raise amount or clear filters.</p>}
          </div>
        )}
      </section>

      <section className="work-panel">
        <h2>Workflow versions</h2>
        {rows.isPending && <p className="muted">Loading workflows…</p>}
        <ul className="company-version-list">
          {(rows.data ?? []).map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <small className="muted">
                  {" "}
                  v{row.version} · {row.objectType} · {row.steps?.length ?? 0} steps
                </small>
              </div>
              <div className="detail-actions-top">
                <StatusBadge status={row.enabled ? "ENABLED" : "DISABLED"} />
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    setEditing(row);
                    setForm({
                      name: row.name,
                      objectType: row.objectType,
                      enabled: false,
                      steps: normalizeSteps(row.steps),
                    });
                  }}
                >
                  Edit / version
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => toggle.mutate({ id: row.id, enabled: !row.enabled })}>
                  {row.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </li>
          ))}
          {!rows.isPending && !(rows.data ?? []).length && <li className="muted">No approval workflows yet.</li>}
        </ul>
      </section>
    </div>
  );
}
