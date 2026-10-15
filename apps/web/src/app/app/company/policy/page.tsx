"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Rule = { type: string; threshold?: number; category?: string; action?: string };
type Policy = {
  id: string;
  name: string;
  objectType: string;
  enabled: boolean;
  version: number;
  priority: number;
  effectiveFrom: string;
  rules: Rule[];
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const blank = {
  name: "Receipt over 75",
  objectType: "expense",
  priority: "10",
  effectiveFrom: todayIsoDate(),
  enabled: false,
  rules: [{ type: "receipt_required", threshold: 75, action: "block" }] as Rule[],
};

const RULE_LABELS: Record<string, string> = {
  receipt_required: "Receipt required",
  memo_required: "Business purpose / memo required",
  vendor_required: "Vendor required",
  quote_required: "Quote or supporting document required",
  high_value: "High-value warning",
  category_amount: "Category amount review",
  manager_approval: "Manager approval required",
  hard_policy_block: "Hard policy block",
  travel_max_amount: "Travel amount review",
  travel_out_of_policy: "Out-of-policy travel",
};

const RULES_WITH_THRESHOLD = new Set([
  "receipt_required", "memo_required", "quote_required", "high_value", "category_amount", "manager_approval", "travel_max_amount",
]);
const RULES_WITH_CATEGORY = new Set(["category_amount"]);
const RULES_WITH_CONFIGURABLE_ACTION = new Set(["receipt_required", "travel_out_of_policy"]);

function defaultAction(type: string) {
  return type === "receipt_required" ? "block" : "review";
}

function fixedOutcome(type: string) {
  if (type === "high_value") return "WARN";
  if (type === "hard_policy_block") return "BLOCK";
  return "REVIEW";
}

export default function PolicyPage() {
  const session = useSession();
  const client = useQueryClient();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [message, setMessage] = useState("");
  const [simAmount, setSimAmount] = useState("100");
  const [simHasReceipt, setSimHasReceipt] = useState(false);
  const [simHasMemo, setSimHasMemo] = useState(false);
  const [simHasVendor, setSimHasVendor] = useState(false);
  const [simHasAttachment, setSimHasAttachment] = useState(false);
  const [simCategory, setSimCategory] = useState("");
  const [simOutOfPolicy, setSimOutOfPolicy] = useState(false);

  const canSeeApprovals = session
    ? canSeeItem(findNavItem("/app/company/approvals") ?? { href: "/app/company/approvals", permission: "roles.assign" }, session)
    : false;
  const canSeeRoles = session
    ? canSeeItem(findNavItem("/app/company/roles") ?? { href: "/app/company/roles", permission: "roles.assign" }, session)
    : false;

  const rows = useQuery({ queryKey: ["policies"], queryFn: () => api.get<Policy[]>("/policies") });
  const save = useMutation({
    mutationFn: () =>
      api.post(editing ? `/policies/${editing.id}/version` : "/policies", {
        ...form,
        priority: Number(form.priority),
      }),
    onSuccess: () => {
      setMessage(editing ? "New policy version saved." : "Policy created (disabled until you enable after review).");
      setEditing(null);
      setForm({ ...blank, effectiveFrom: todayIsoDate() });
      void client.invalidateQueries({ queryKey: ["policies"] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.post(`/policies/${id}/${enabled ? "enable" : "disable"}`, {}),
    onSuccess: (_data, variables) => {
      setMessage(variables.enabled ? "Policy published and enabled." : "Policy disabled.");
      void client.invalidateQueries({ queryKey: ["policies"] });
    },
  });
  const simulate = useMutation({
    mutationFn: () =>
      api.post<{
        evaluation: { result: string; explanation: string; matchedRules: string[] };
        draft?: boolean;
        rulesApplied?: number;
      }>("/policies/simulate", {
        objectType: form.objectType,
        amount: Number(simAmount) || 0,
        hasReceipt: simHasReceipt,
        hasMemo: simHasMemo,
        hasVendor: simHasVendor,
        hasAttachment: simHasAttachment,
        category: simCategory || undefined,
        outOfPolicy: simOutOfPolicy,
        rules: form.rules,
      }),
  });

  function edit(row: Policy) {
    setEditing(row);
    setForm({
      name: row.name,
      objectType: row.objectType,
      priority: String(row.priority),
      effectiveFrom: row.effectiveFrom?.slice(0, 10) ?? "",
      enabled: row.enabled,
      rules: row.rules,
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    save.mutate();
  }

  function updateRule(index: number, patch: Partial<Rule>) {
    setForm({ ...form, rules: form.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)) });
  }

  return (
    <div className="stack-lg company-builder-page linked-dest-page company-ui-page spend-ui-page company-policy-ui">
      <div className="resource-heading">
        <PageHeader
          title="Policy builder"
          subtitle="Create, version, disable, and simulate rules used by the shared policy engine. Leave Enabled off until review."
        />
        <div className="detail-actions-top">
          {canSeeApprovals && (
            <Link className="btn btn-ghost" href="/app/company/approvals">
              Approval rules
            </Link>
          )}
          {canSeeRoles && (
            <Link className="btn btn-ghost" href="/app/company/roles">
              Roles
            </Link>
          )}
        </div>
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {rows.isError && (
        <p className="error-panel" role="alert">
          Could not load policies.{" "}
          <button type="button" className="text-button" onClick={() => void rows.refetch()}>
            Try again
          </button>
        </p>
      )}

      <section className="work-panel">
        <h2>{editing ? `Edit ${editing.name} as version ${editing.version + 1}` : "Create policy"}</h2>
        <form className="record-form" onSubmit={submit}>
          <label>
            Policy name
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Object type
            <select className="input" value={form.objectType} onChange={(e) => setForm({ ...form, objectType: e.target.value })}>
              {["expense", "reimbursement", "spend_request", "procurement", "bill", "travel"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <input className="input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          </label>
          <label>
            Effective date
            <input className="input" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled (turn on only after review)
          </label>
          <fieldset>
            <legend>Conditions and actions</legend>
            {form.rules.map((rule, index) => (
              <fieldset className="policy-box" key={index}>
                <legend>Rule {index + 1}</legend>
                <div className="form-grid">
                <label>
                  Rule type
                  <select className="input" value={rule.type} onChange={(e) => updateRule(index, {
                    type: e.target.value,
                    threshold: undefined,
                    category: undefined,
                    action: defaultAction(e.target.value),
                  })}>
                  {[
                    "receipt_required",
                    "memo_required",
                    "vendor_required",
                    "quote_required",
                    "high_value",
                    "category_amount",
                    "manager_approval",
                    "hard_policy_block",
                    "travel_max_amount",
                    "travel_out_of_policy",
                  ].map((value) => (
                    <option key={value} value={value}>{RULE_LABELS[value]}</option>
                  ))}
                  </select>
                </label>
                {RULES_WITH_THRESHOLD.has(rule.type) && <label>
                  Amount threshold
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="e.g. 75"
                    value={rule.threshold ?? ""}
                    onChange={(e) => updateRule(index, { threshold: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>}
                {RULES_WITH_CATEGORY.has(rule.type) && <label>
                  Category
                  <input
                    className="input"
                    placeholder="e.g. Software"
                    value={rule.category ?? ""}
                    onChange={(e) => updateRule(index, { category: e.target.value || undefined })}
                  />
                </label>}
                {RULES_WITH_CONFIGURABLE_ACTION.has(rule.type) ? <label>
                  Result when matched
                  <select className="input" value={rule.action ?? defaultAction(rule.type)} onChange={(e) => updateRule(index, { action: e.target.value })}>
                    <option value="review">REVIEW — require human approval</option>
                    <option value="block">BLOCK — stop submission</option>
                  </select>
                </label> : <label>
                  Result when matched
                  <input className="input" value={fixedOutcome(rule.type)} disabled />
                </label>}
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={form.rules.length === 1}
                  onClick={() => setForm({ ...form, rules: form.rules.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
                </div>
              </fieldset>
            ))}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setForm({ ...form, rules: [...form.rules, { type: "memo_required", action: "review" }] })}
            >
              Add rule
            </button>
          </fieldset>

          <fieldset>
            <legend>Simulate against form rules</legend>
            <div className="form-grid">
              <label>
                Amount
                <input className="input" type="number" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} />
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={simHasReceipt} onChange={(e) => setSimHasReceipt(e.target.checked)} /> Has receipt
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={simHasMemo} onChange={(e) => setSimHasMemo(e.target.checked)} /> Has memo
              </label>
              <label>
                Category
                <input className="input" value={simCategory} onChange={(e) => setSimCategory(e.target.value)} placeholder="e.g. Software" />
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={simHasVendor} onChange={(e) => setSimHasVendor(e.target.checked)} /> Has vendor
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={simHasAttachment} onChange={(e) => setSimHasAttachment(e.target.checked)} /> Has quote / attachment
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={simOutOfPolicy} onChange={(e) => setSimOutOfPolicy(e.target.checked)} /> Out of policy
              </label>
            </div>
            <p className="muted">Simulation uses the shared policy engine on the draft rules above (not saved DB JSON).</p>
          </fieldset>

          {(save.error || simulate.error) && <p className="error">{(save.error ?? simulate.error)?.message}</p>}
          <div className="detail-actions">
            <button className="btn btn-primary" disabled={save.isPending}>
              Save {editing ? "new version" : "policy"}
            </button>
            <button className="btn btn-ghost" type="button" disabled={simulate.isPending} onClick={() => simulate.mutate()}>
              Simulate
            </button>
            {editing && (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm({ ...blank, effectiveFrom: todayIsoDate() });
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
        {simulate.data && (
          <div className="policy-box">
            <StatusBadge status={simulate.data.evaluation.result} /> {simulate.data.evaluation.explanation}
            {simulate.data.draft ? " · draft rules" : ""}
            {simulate.data.evaluation.matchedRules?.length
              ? ` · matched: ${simulate.data.evaluation.matchedRules.join(", ")}`
              : ""}
          </div>
        )}
      </section>

      <section className="work-panel">
        <h2>Policy versions</h2>
        {rows.isPending && <p className="muted">Loading policies…</p>}
        <ul className="company-version-list">
          {(rows.data ?? []).map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <small className="muted">
                  {" "}
                  v{row.version} · {row.objectType} · priority {row.priority} · {row.rules?.length ?? 0} rules
                </small>
              </div>
              <div className="detail-actions-top">
                <StatusBadge status={row.enabled ? "ENABLED" : "DISABLED"} />
                <button className="btn btn-ghost" type="button" onClick={() => edit(row)}>
                  Edit / version
                </button>
                <button className="btn btn-ghost" type="button" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: row.id, enabled: !row.enabled })}>
                  {row.enabled ? "Disable" : "Publish / enable"}
                </button>
              </div>
            </li>
          ))}
          {!rows.isPending && !(rows.data ?? []).length && <li className="muted">No policies yet.</li>}
        </ul>
      </section>
    </div>
  );
}
