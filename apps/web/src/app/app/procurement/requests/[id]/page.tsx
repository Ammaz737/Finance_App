"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  request: {
    id: string; name: string; amount: string | number; currency: string; status: string;
    outcomeType: string; outcomeId: string | null; approvalProgress: string; requesterId: string; memo: string;
    formAnswers: { lines?: Array<{ description: string; amount: string }> } | null;
  };
  program: { name: string } | null;
  vendor: { name: string } | null;
  requester: { firstName: string; lastName: string; email: string } | null;
  purchaseOrder: { id: string; number: string; status: string } | null;
  approval: { status: string; currentStep: number } | null;
  approvalProgress: Array<{ label: string; status: string }>;
  approvalLabel: string;
  policy: {
    result: string | null; reason: string | null; matchedRules: unknown;
    requiredActions: unknown; version: number | null; evaluatedAt: string | null;
  };
  timeline: Array<{ id: string; action: string; createdAt: string }>;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : String(value)}`;
}

export default function ProcurementRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const detail = useQuery({
    queryKey: ["procurement-detail", params.id],
    queryFn: () => api.get<Detail>(`/procurement/${params.id}`),
  });

  const run = useMutation({
    mutationFn: (action: string) => api.post(`/procurement/${params.id}/${action}`, {}),
    onSuccess: (_data, action) => {
      setMessage(`Action ${action} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["procurement-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "procurement"] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "purchase-orders"] });
    },
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load request. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading request…</p>;

  const { request, program, vendor, requester, purchaseOrder, approvalProgress, approvalLabel, policy, timeline } = detail.data;
  const canSubmit = request.status === "DRAFT"
    && (session?.userId === request.requesterId || session?.roles.includes("Owner") || session?.permissions.includes("*"));
  const canApprove = request.status === "IN_REVIEW"
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("procurement.review"))
    && session?.userId !== request.requesterId;
  const approvedSteps = approvalProgress.filter((step) => step.status === "Approved").length;

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader
        title={request.name}
        subtitle={`${requester ? `${requester.firstName} ${requester.lastName}` : "Requester"} · ${money(request.currency, request.amount)}`}
      />
      <Link className="btn btn-ghost" href="/app/procurement/requests">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {run.isError && <p className="error" role="alert">{run.error.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={request.status} /></strong><small>{approvalLabel}</small></article>
      <article className="kpi-card"><span>Outcome</span><strong>{request.outcomeType}</strong><small>{request.outcomeId ? `Ref ${request.outcomeId.slice(0, 12)}` : "After final approval only"}</small></article>
      <article className="kpi-card"><span>PO</span><strong>{purchaseOrder ? purchaseOrder.number : "None"}</strong><small>{purchaseOrder ? <StatusBadge status={purchaseOrder.status} /> : "Not before final approve"}</small></article>
      <article className="kpi-card"><span>Policy</span><strong>{policy.result ?? "—"}</strong><small>{policy.reason || "Evaluated on submit"}</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Overview</h2>
        <dl className="detail-list">
          <div><dt>Program</dt><dd>{program?.name ?? "—"}</dd></div>
          <div><dt>Vendor</dt><dd>{vendor?.name ?? "—"}</dd></div>
          <div><dt>Business purpose</dt><dd>{request.memo || "—"}</dd></div>
        </dl>
        <h3>Lines</h3>
        <ul className="plain-list">
          {(request.formAnswers?.lines ?? []).map((line, index) => (
            <li key={`${line.description}-${index}`}>{line.description} — {money(request.currency, line.amount)}</li>
          ))}
          {!request.formAnswers?.lines?.length && <li className="muted">Single-line request amount.</li>}
        </ul>
        <div className="detail-actions">
          {canSubmit && <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("submit")}>Submit</button>}
          {canApprove && <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("approve")}>Approve</button>}
          {purchaseOrder && <Link className="btn btn-ghost" href={`/app/procurement/purchase-orders/${purchaseOrder.id}`}>Open PO</Link>}
        </div>
      </section>

      <section className="work-panel">
        <h2>Approvals</h2>
        <p className="muted">{approvedSteps} of {approvalProgress.length || 0} approvals completed</p>
        <ul className="plain-list">
          {approvalProgress.map((step) => (
            <li key={`${step.label}-${step.status}`}>{step.label}{" "}<StatusBadge status={step.status} /></li>
          ))}
          {!approvalProgress.length && <li className="muted">No approval steps yet.</li>}
        </ul>
      </section>

      <section className="work-panel">
        <h2>Policy</h2>
        <dl className="detail-list">
          <div><dt>Result</dt><dd>{policy.result ?? "—"}</dd></div>
          <div><dt>Reason</dt><dd>{policy.reason || "—"}</dd></div>
          <div><dt>Version</dt><dd>{policy.version ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="work-panel">
        <h2>Activity</h2>
        <ul className="plain-list">
          {timeline.map((event) => (
            <li key={event.id}>{event.action} · {new Date(event.createdAt).toLocaleString()}</li>
          ))}
          {!timeline.length && <li className="muted">No activity yet.</li>}
        </ul>
      </section>
    </div>
  </div>;
}
