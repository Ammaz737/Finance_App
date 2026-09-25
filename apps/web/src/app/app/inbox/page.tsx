"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, DrawerReview, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { api } from "@/lib/api";

type Task = {
  id: string; type: string; objectType: string; objectId: string; name: string; amount: string;
  currency: string; entity?: string; requestedBy: string; priority: string; status: string;
  policySummary: string; policyResult?: string; currentStep: number; totalSteps: number;
  dueAt: string | null; availableActions: string[]; createdAt: string; approvalInstanceId?: string;
};

type TaskDetail = Task & {
  timeline: Array<{ at: string; actor: string; action: string; comment: string }>;
  policy: { result: string; explanation: string; evidence: string[]; requiredAction?: string; matchedRules: string[] } | null;
};

const routes: Record<string, string> = {
  spend_request: "/app/spend/requests", expense: "/app/expenses/transactions",
  reimbursement: "/app/expenses/reimbursements", bill: "/app/bill-pay/bills",
  procurement: "/app/procurement/requests", payment: "/app/bill-pay/payments",
  accounting: "/app/accounting/review", travel: "/app/travel/trips",
};

function sourceHref(task: Task) {
  const base = routes[task.objectType];
  if (!base) return "/app/home";
  if (task.objectType === "accounting") return `${base}?entry=${encodeURIComponent(task.objectId)}`;
  return `${base}/${task.objectId}`;
}

export default function Page() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [filter, setFilter] = useState("ALL");
  const tasks = useQuery({ queryKey: ["inbox"], queryFn: () => api.get<Task[]>("/inbox") });
  const detail = useQuery({
    queryKey: ["inbox-detail", selectedId],
    queryFn: () => api.get<TaskDetail>(`/inbox/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const decision = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post<{ nextTaskId: string | null }>(`/inbox/${id}/${action}`, { comment }),
    onSuccess: (payload) => {
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["resource"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-overview"] });
      if (payload.nextTaskId) {
        setSelectedId(payload.nextTaskId);
        void queryClient.invalidateQueries({ queryKey: ["inbox-detail", payload.nextTaskId] });
      } else {
        setSelectedId(null);
      }
    },
  });

  useEffect(() => {
    if (!selectedId && tasks.data?.length) {
      // keep empty until user clicks
    }
  }, [selectedId, tasks.data]);

  const rows = (tasks.data ?? []).filter((row) => filter === "ALL" || row.type === filter);
  const columns: Column<Task>[] = [
    { key: "type", header: "Type", render: (row) => row.type.replaceAll("_", " ") },
    { key: "name", header: "Request", render: (row) => row.name },
    { key: "amount", header: "Amount", render: (row) => row.amount === "0" ? "—" : `${row.currency} ${Number(row.amount).toLocaleString()}` },
    { key: "entity", header: "Entity", render: (row) => row.entity ?? "—" },
    { key: "requestedBy", header: "Requested by", render: (row) => row.requestedBy },
    { key: "priority", header: "Priority", render: (row) => <StatusBadge status={row.priority} /> },
    { key: "currentStep", header: "Progress", render: (row) => row.type === "APPROVAL" ? `${row.currentStep} of ${row.totalSteps}` : row.status },
    { key: "dueAt", header: "Due", render: (row) => row.dueAt ? new Date(row.dueAt).toLocaleDateString() : "—" },
  ];

  const selected = detail.data ?? rows.find((row) => row.id === selectedId) ?? null;

  return <div>
    <PageHeader title="Inbox" subtitle="Approvals, payment release, and accounting exceptions assigned to you" />
    <div className="filter-row">
      {["ALL", "APPROVAL", "PAYMENT_RELEASE", "ACCOUNTING_EXCEPTION"].map((value) => (
        <button key={value} className={`chip ${filter === value ? "chip-active" : ""}`} onClick={() => setFilter(value)}>
          {value === "ALL" ? "All" : value.replaceAll("_", " ").toLowerCase()}
        </button>
      ))}
      <span className="muted">{rows.length} open</span>
    </div>
    {tasks.isError ? <p className="error-panel">Could not load your tasks. <button className="text-button" onClick={() => void tasks.refetch()}>Try again</button></p>
      : tasks.isPending ? <p className="muted">Loading tasks…</p>
      : rows.length === 0 ? <div className="empty-work"><strong>You are all caught up</strong><p>No approvals or exceptions are waiting for you.</p></div>
      : <div className="table-wrap"><DataTable rows={rows} columns={columns} onRowClick={(row) => setSelectedId(row.id)} /></div>}

    <DrawerReview open={Boolean(selectedId)} title="Review task" onClose={() => setSelectedId(null)}>
      {selected && <div className="detail-panel">
        <div className="review-summary">
          <span>{selected.type.replaceAll("_", " ")}</span>
          <h2>{selected.name}</h2>
          <strong>{selected.amount === "0" ? selected.policySummary : `${selected.currency} ${Number(selected.amount).toLocaleString()}`}</strong>
        </div>
        <dl className="detail-list">
          <div><dt>Requested by</dt><dd>{selected.requestedBy}</dd></div>
          {selected.entity && <div><dt>Legal entity</dt><dd>{selected.entity}</dd></div>}
          <div><dt>Priority</dt><dd><StatusBadge status={selected.priority} /></dd></div>
          {selected.type === "APPROVAL" && <div><dt>Approval step</dt><dd>{selected.currentStep} of {selected.totalSteps}</dd></div>}
          <div><dt>Policy</dt><dd>{selected.policySummary || "—"}</dd></div>
          {selected.dueAt && <div><dt>Due</dt><dd>{new Date(selected.dueAt).toLocaleString()}</dd></div>}
          <div><dt>Received</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div>
        </dl>

        {detail.data?.policy && <div className="policy-box">
          <strong>Policy result: {detail.data.policy.result}</strong>
          <p>{detail.data.policy.explanation}</p>
          {detail.data.policy.matchedRules?.length > 0 && <p className="muted">Matched: {detail.data.policy.matchedRules.join(", ")}</p>}
        </div>}

        {detail.data?.timeline?.length ? <div className="timeline">
          <h3>Activity</h3>
          {detail.data.timeline.map((item, index) => (
            <div key={`${item.at}-${index}`} className="timeline-item">
              <strong>{item.action}</strong> · {item.actor}
              <div className="muted">{new Date(item.at).toLocaleString()}</div>
              {item.comment && <p>{item.comment}</p>}
            </div>
          ))}
        </div> : null}

        <Link className="detail-link" href={sourceHref(selected)}>View source record →</Link>
        <label className="review-comment">Comment<textarea className="input" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Required for reject / request info" /></label>
        {decision.isError && <p className="error" role="alert">{decision.error.message}</p>}
        <div className="detail-actions">
          {selected.availableActions.includes("approve") && <button className="btn btn-primary" disabled={decision.isPending} onClick={() => decision.mutate({ id: selected.id, action: "approve" })}>Approve</button>}
          {selected.availableActions.includes("release") && <button className="btn btn-primary" disabled={decision.isPending} onClick={() => decision.mutate({ id: selected.id, action: "release" })}>Release payment</button>}
          {selected.availableActions.includes("request_info") && <button className="btn btn-ghost" disabled={decision.isPending || !comment.trim()} onClick={() => decision.mutate({ id: selected.id, action: "request_info" })}>Request info</button>}
          {selected.availableActions.includes("reject") && <button className="btn btn-ghost" disabled={decision.isPending || !comment.trim()} onClick={() => decision.mutate({ id: selected.id, action: "reject" })}>Reject</button>}
          {selected.availableActions.includes("open") && <Link className="btn btn-primary" href="/app/accounting/review">Open in Accounting</Link>}
        </div>
      </div>}
    </DrawerReview>
  </div>;
}
