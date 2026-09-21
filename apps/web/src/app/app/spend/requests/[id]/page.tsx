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
    id: string; name: string; purpose: string; amount: string | number; currency: string;
    status: string; fulfillmentType: string; recurrence: string; category: string; comments: string;
    policyResult: string; policyReason: string; createdAt: string;
  };
  program: { id: string; name: string } | null;
  requester: { firstName: string; lastName: string; email: string } | null;
  vendor: { id: string; name: string } | null;
  entity: { id: string; name: string } | null;
  fund: { id: string; name: string; availableAmount: string | number; limitAmount: string | number; currency: string } | null;
  card: { id: string; last4: string; status: string } | null;
  approvalProgress: Array<{ label: string; status: string }>;
  approvalLabel: string;
  policy: { result: string; reason: string; matchedRules: unknown; requiredActions: unknown; version: number };
  timeline: Array<{ id: string; action: string; createdAt: string }>;
  sandbox: boolean;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function SpendRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const canApprove = Boolean(session && (session.permissions.includes("*") || session.permissions.includes("spend_request.approve") || session.roles.includes("Owner")));

  const detail = useQuery({
    queryKey: ["spend-request", params.id],
    queryFn: () => api.get<Detail>(`/spend-requests/${params.id}`),
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/spend-requests/${params.id}/approve`, {}),
    onSuccess: () => {
      setMessage("Approval recorded.");
      void queryClient.invalidateQueries({ queryKey: ["spend-request", params.id] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  if (detail.isLoading) return <p>Loading request…</p>;
  if (detail.isError || !detail.data) return <p>Spend request not found.</p>;
  const data = detail.data;
  const req = data.request;

  return (
    <div className="stack gap-lg">
      <PageHeader
        title={req.name}
        subtitle={`${data.requester ? `${data.requester.firstName} ${data.requester.lastName}` : "Requester"} · ${money(req.currency, req.amount)}`}
        actions={canApprove && ["IN_REVIEW", "SUBMITTED"].includes(req.status) ? (
          <button type="button" className="button" onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</button>
        ) : undefined}
      />
      {message ? <p role="status">{message}</p> : null}

      <div className="grid-2">
        <section className="panel stack gap-md">
          <h2>Request</h2>
          <dl className="detail-list">
            <div><dt>Status</dt><dd><StatusBadge status={req.status} /></dd></div>
            <div><dt>Legal entity</dt><dd>{data.entity?.name ?? "—"}</dd></div>
            <div><dt>Spend program</dt><dd>{data.program?.name ?? "—"}</dd></div>
            <div><dt>Business purpose</dt><dd>{req.purpose || "—"}</dd></div>
            <div><dt>Category</dt><dd>{req.category || "—"}</dd></div>
            <div><dt>Vendor</dt><dd>{data.vendor?.name ?? "—"}</dd></div>
            <div><dt>Fulfillment</dt><dd>{req.fulfillmentType === "FUND_ONLY" ? "Fund only" : "Virtual card"}</dd></div>
            <div><dt>Recurrence</dt><dd>{req.recurrence}</dd></div>
            <div><dt>Comments</dt><dd>{req.comments || "—"}</dd></div>
          </dl>
        </section>

        <section className="panel stack gap-md">
          <h2>Policy</h2>
          <p><StatusBadge status={data.policy.result || "PASS"} /> {data.policy.reason || "No blocking policy matched."}</p>
          {Array.isArray(data.policy.matchedRules) && data.policy.matchedRules.length > 0 ? (
            <p className="muted">Matched rules: {(data.policy.matchedRules as string[]).join(", ")}</p>
          ) : null}
          {Array.isArray(data.policy.requiredActions) && (data.policy.requiredActions as string[]).length > 0 ? (
            <p className="muted">Required: {(data.policy.requiredActions as string[]).join(", ")}</p>
          ) : null}
        </section>
      </div>

      <section className="panel stack gap-md">
        <h2>Approval progress</h2>
        <p>{data.approvalLabel || "No approval started"}</p>
        <ul className="stack gap-sm">
          {data.approvalProgress.map((step) => (
            <li key={step.label} className="row between">
              <span>{step.label}</span>
              <StatusBadge status={step.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack gap-md">
        <h2>Fulfillment</h2>
        {data.fund ? (
          <p>
            Fund{" "}
            <Link href={`/app/spend/funds/${data.fund.id}`}>{data.fund.name}</Link>
            {" — "}
            {money(data.fund.currency, data.fund.availableAmount)} available of {money(data.fund.currency, data.fund.limitAmount)}
          </p>
        ) : <p className="muted">Fund not created yet.</p>}
        {data.card ? (
          <p>
            Virtual card{" "}
            <Link href={`/app/spend/cards/${data.card.id}`}>•••• {data.card.last4}</Link>
            {" "}
            <StatusBadge status={data.card.status} />
            {data.sandbox ? <span className="muted"> · SANDBOX / MOCK CARD</span> : null}
          </p>
        ) : <p className="muted">No card issued (fund-only or pending approval).</p>}
      </section>

      <section className="panel stack gap-md">
        <h2>Timeline</h2>
        <ul className="stack gap-sm">
          {data.timeline.map((event) => (
            <li key={event.id} className="row between">
              <span>{event.action}</span>
              <span className="muted">{new Date(event.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        <details>
          <summary>System information</summary>
          <p className="muted">Request ID: {req.id}</p>
        </details>
      </section>
    </div>
  );
}
