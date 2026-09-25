"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  reimbursement: {
    id: string; type: string; amount: string | number; currency: string; memo: string; merchant: string;
    status: string; policyResult: string; distanceMiles: string | number | null; mileageRate: string | number | null;
    perDiemNights: number | null; perDiemRate: string | number | null; calcBreakdown: { formula?: string } | null;
    payoutRail: string | null; providerRef: string | null; scheduledAt: string | null; paidAt: string | null; userId: string;
    failureReason?: string; payoutStatus?: string; destination?: string; category?: string;
  };
  employee: { firstName: string; lastName: string; email: string } | null;
  receipt: { id: string; merchantGuess: string | null; matchStatus: string; ocrStatus: string } | null;
  attachment: { originalName: string; malwareStatus: string } | null;
  accounting: { id: string; status: string } | null;
  approvalProgress: Array<{ label: string; status: string }>;
  approvalLabel: string;
  requirements: { requirements: Array<{ label: string; status: string }>; complete: boolean };
  policy: { result: string | null; reason: string | null; version: number | null };
  duplicate: { status: string; ofId: string | null };
  timeline: Array<{ id: string; action: string; createdAt: string }>;
  sandboxLabel: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function ReimbursementDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const sandbox = process.env.NODE_ENV !== "production";

  const detail = useQuery({
    queryKey: ["reimbursement-detail", params.id],
    queryFn: () => api.get<Detail>(`/reimbursements/${params.id}`),
  });

  const run = useMutation({
    mutationFn: (action: string) => api.post(`/reimbursements/${params.id}/${action}`, action === "schedule" ? { rail: "ACH" } : {}),
    onSuccess: (_data, action) => {
      setMessage(`Action ${action} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["reimbursement-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "reimbursements"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load reimbursement. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading reimbursement…</p>;

  const data = detail.data.reimbursement;
  const canSubmit = data.status === "DRAFT" && (session?.userId === data.userId || session?.roles.includes("Owner") || session?.permissions.includes("*"));
  const canApprove = data.status === "IN_REVIEW"
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("reimbursement.approve"))
    && session?.userId !== data.userId;
  const canPay = session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("reimbursement.pay");
  const approvedSteps = detail.data.approvalProgress.filter((step) => step.status === "Approved").length;

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader
        title={data.memo || `${data.type} reimbursement`}
        subtitle={`${detail.data.employee ? `${detail.data.employee.firstName} ${detail.data.employee.lastName}` : "Employee"} · ${money(data.currency, data.amount)}`}
      />
      <Link className="btn btn-ghost" href="/app/expenses/reimbursements">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {run.isError && <p className="error" role="alert">{run.error.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={data.status} /></strong><small>{detail.data.approvalLabel || data.payoutStatus || "—"}</small></article>
      <article className="kpi-card"><span>Type</span><strong>{data.type}</strong><small>{data.calcBreakdown?.formula ?? "Server calculated"}</small></article>
      <article className="kpi-card"><span>Policy</span><strong>{detail.data.policy.result ?? data.policyResult}</strong><small>{detail.data.policy.reason || "—"}</small></article>
      <article className="kpi-card"><span>Accounting</span><strong>{detail.data.accounting ? <StatusBadge status={detail.data.accounting.status} /> : "Not yet"}</strong><small>Created only after payout</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Overview</h2>
        <dl className="detail-list">
          <div><dt>Merchant / destination</dt><dd>{data.merchant || data.destination || "—"}</dd></div>
          <div><dt>Category</dt><dd>{data.category || "—"}</dd></div>
          {data.distanceMiles != null && <div><dt>Distance</dt><dd>{String(data.distanceMiles)} mi @ {String(data.mileageRate)}</dd></div>}
          {data.perDiemNights != null && <div><dt>Per diem</dt><dd>{data.perDiemNights} days @ {String(data.perDiemRate)}</dd></div>}
          <div><dt>Duplicate check</dt><dd>{detail.data.duplicate.status}</dd></div>
        </dl>
        <div className="detail-actions">
          {canSubmit && <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("submit")}>Submit</button>}
          {canApprove && <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("approve")}>Approve</button>}
          {canPay && ["APPROVED", "FAILED"].includes(data.status) && <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("schedule")}>Schedule payout</button>}
          {canPay && sandbox && data.status === "SCHEDULED" && <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("confirm-payout")}>Confirm payout</button>}
        </div>
        <p className="muted">{detail.data.sandboxLabel}</p>
      </section>

      <section className="work-panel">
        <h2>Requirements</h2>
        <ul className="plain-list">
          {detail.data.requirements.requirements.map((row) => (
            <li key={row.label}>{row.label}{" "}<StatusBadge status={row.status} /></li>
          ))}
        </ul>
      </section>

      <section className="work-panel">
        <h2>Approvals</h2>
        <p className="muted">{approvedSteps} of {detail.data.approvalProgress.length || 0} approvals completed</p>
        <ul className="plain-list">
          {detail.data.approvalProgress.map((step) => (
            <li key={`${step.label}-${step.status}`}>{step.label}{" "}<StatusBadge status={step.status} /></li>
          ))}
          {!detail.data.approvalProgress.length && <li className="muted">No approval steps yet.</li>}
        </ul>
      </section>

      <section className="work-panel">
        <h2>Receipt / Evidence</h2>
        <p>{detail.data.receipt ? `${detail.data.receipt.matchStatus} · ${detail.data.attachment?.originalName ?? "linked"}` : "None"}</p>
        <h2>Payout</h2>
        <dl className="detail-list">
          <div><dt>Rail</dt><dd>{data.payoutRail ?? "—"}</dd></div>
          <div><dt>Provider</dt><dd>{data.providerRef ?? "—"}</dd></div>
          {data.scheduledAt && <div><dt>Scheduled</dt><dd>{new Date(data.scheduledAt).toLocaleString()}</dd></div>}
          {data.paidAt && <div><dt>Paid</dt><dd>{new Date(data.paidAt).toLocaleString()}</dd></div>}
          {data.failureReason && <div><dt>Failure</dt><dd>{data.failureReason}</dd></div>}
        </dl>
      </section>

      <section className="work-panel">
        <h2>Activity</h2>
        <ul className="plain-list">
          {detail.data.timeline.map((event) => (
            <li key={event.id}>{event.action} · {new Date(event.createdAt).toLocaleString()}</li>
          ))}
          {!detail.data.timeline.length && <li className="muted">No activity yet.</li>}
        </ul>
      </section>
    </div>
  </div>;
}
