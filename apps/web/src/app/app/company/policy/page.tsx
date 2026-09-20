"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";

type PolicyRow = { id: string; name: string; objectType: string; enabled: boolean; version?: number; priority?: number; rules?: unknown };

export default function Page() {
  const [objectType, setObjectType] = useState("expense");
  const [amount, setAmount] = useState("80");
  const [hasReceipt, setHasReceipt] = useState(false);
  const [hasMemo, setHasMemo] = useState(true);
  const policies = useQuery({ queryKey: ["policies"], queryFn: () => api.get<PolicyRow[]>("/policies") });
  const simulate = useMutation({
    mutationFn: () => api.post<{ evaluation: { result: string; explanation: string; matchedRules: string[] }; policyNames: string[]; rulesApplied: number }>("/policies/simulate", {
      objectType, amount: Number(amount), hasReceipt, hasMemo,
    }),
  });

  function onSimulate(event: FormEvent) {
    event.preventDefault();
    simulate.mutate();
  }

  return <div className="stack-lg">
    <PageHeader title="Policies" subtitle="Rule definitions used by spend, expenses, and approvals. Simulate before changing production behavior." />
    <section className="panel">
      <h2>Simulate policy</h2>
      <form className="form-grid" onSubmit={onSimulate}>
        <label>Object type
          <select className="input" value={objectType} onChange={(event) => setObjectType(event.target.value)}>
            <option value="expense">expense</option>
            <option value="spend_request">spend_request</option>
            <option value="bill">bill</option>
            <option value="card">card</option>
          </select>
        </label>
        <label>Amount<input className="input" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label className="checkbox"><input type="checkbox" checked={hasReceipt} onChange={(event) => setHasReceipt(event.target.checked)} /> Has receipt</label>
        <label className="checkbox"><input type="checkbox" checked={hasMemo} onChange={(event) => setHasMemo(event.target.checked)} /> Has memo</label>
        <button className="btn btn-primary" type="submit" disabled={simulate.isPending}>Run simulation</button>
      </form>
      {simulate.data && <div className="policy-box">
        <StatusBadge status={simulate.data.evaluation.result} />
        <p>{simulate.data.evaluation.explanation}</p>
        <p className="muted">Rules applied: {simulate.data.rulesApplied}. Policies: {simulate.data.policyNames.join(", ") || "defaults"}</p>
        {simulate.data.evaluation.matchedRules?.length > 0 && <p>Matched: {simulate.data.evaluation.matchedRules.join(", ")}</p>}
      </div>}
      {simulate.isError && <p className="error">{simulate.error.message}</p>}
    </section>
    <ResourcePage title="Policy definitions" path="policies" />
    {policies.data && policies.data.length > 0 && <p className="muted">{policies.data.length} saved policies in this workspace.</p>}
  </div>;
}
