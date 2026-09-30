"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DrawerReview, PageHeader, StatusBadge, DataTable, type Column } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Task = {
  id: string;
  type: string;
  objectType: string;
  objectId: string;
  name: string;
  amount: string;
  currency: string;
  entity?: string;
  requestedBy: string;
  priority: string;
  status: string;
  policySummary: string;
  policyResult?: string;
  currentStep: number;
  totalSteps: number;
  dueAt: string | null;
  availableActions: string[];
  createdAt: string;
  approvalInstanceId?: string;
  invoiceNumber?: string;
  duplicateStatus?: string;
  sourceType?: string;
  sourceId?: string;
  category?: string;
};

type TaskDetail = Task & {
  timeline: Array<{ at: string; actor: string; action: string; comment: string }>;
  policy: { result: string; explanation: string; evidence: string[]; requiredAction?: string; matchedRules: string[] } | null;
};

type CategoryFilter = "ALL" | "APPROVALS" | "PAYMENT_RELEASE" | "ACCOUNTING_EXCEPTION" | "PROCUREMENT_MATCH_EXCEPTION";
type PriorityFilter = "ALL" | "HIGH" | "NORMAL";
type SortKey = "priority" | "newest" | "oldest" | "amount" | "due";

const PAGE_SIZE = 25;
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const SEEN_STORAGE_PREFIX = "finance.inbox.seen.";

const routes: Record<string, string> = {
  spend_request: "/app/spend/requests",
  expense: "/app/expenses",
  reimbursement: "/app/expenses/reimbursements",
  bill: "/app/bill-pay/bills",
  procurement: "/app/procurement/requests",
  payment: "/app/bill-pay/payments",
  accounting: "/app/accounting/review",
  travel: "/app/travel/trips",
  match: "/app/procurement/match-exceptions",
};

const TYPE_LABELS: Record<string, string> = {
  APPROVAL: "Spend / expense",
  BILL_APPROVAL: "Bill approval",
  PROCUREMENT_REQUEST: "Procurement",
  REIMBURSEMENT_APPROVAL: "Reimbursement",
  TRAVEL_REQUEST: "Travel",
  PAYMENT_RELEASE: "Payment release",
  ACCOUNTING_EXCEPTION: "Accounting",
  PROCUREMENT_MATCH_EXCEPTION: "Match exception",
};

const OBJECT_TYPE_LABELS: Record<string, string> = {
  spend_request: "Spend request",
  expense: "Expense",
  reimbursement: "Reimbursement",
  bill: "Bill",
  procurement: "Procurement",
  travel: "Travel",
  payment: "Payment",
  accounting: "Accounting",
  match: "Match",
};

function sourceHref(task: Task) {
  const base = routes[task.objectType];
  if (!base) return "/app/home";
  if (task.objectType === "accounting") {
    const dest = task.status === "SYNC_ERROR" ? "/app/accounting/errors" : "/app/accounting/review";
    return `${dest}?entry=${encodeURIComponent(task.objectId)}`;
  }
  if (task.objectType === "match") return `${base}?match=${encodeURIComponent(task.objectId)}`;
  return `${base}/${task.objectId}`;
}

function isApprovalType(type: string) {
  return ["APPROVAL", "BILL_APPROVAL", "PROCUREMENT_REQUEST", "REIMBURSEMENT_APPROVAL", "TRAVEL_REQUEST"].includes(type);
}

function matchesCategory(task: Task, category: CategoryFilter) {
  if (category === "ALL") return true;
  if (category === "APPROVALS") return isApprovalType(task.type);
  return task.type === category;
}

function priorityRank(priority: string) {
  return ({ URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as Record<string, number>)[priority] ?? 9;
}

function formatAmount(task: Task) {
  if (task.amount === "0") return "—";
  return `${task.currency} ${Number(task.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function loadSeen(userId: string): { ids: string[]; visitedAt: string | null } {
  if (typeof window === "undefined") return { ids: [], visitedAt: null };
  try {
    const raw = window.localStorage.getItem(`${SEEN_STORAGE_PREFIX}${userId}`);
    if (!raw) return { ids: [], visitedAt: null };
    const parsed = JSON.parse(raw) as { ids?: string[]; visitedAt?: string };
    return { ids: Array.isArray(parsed.ids) ? parsed.ids.slice(-500) : [], visitedAt: parsed.visitedAt ?? null };
  } catch {
    return { ids: [], visitedAt: null };
  }
}

function saveSeen(userId: string, ids: string[], visitedAt: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${SEEN_STORAGE_PREFIX}${userId}`, JSON.stringify({ ids: ids.slice(-500), visitedAt }));
}

function isNewTask(task: Task, seenIds: Set<string>, visitedAt: string | null) {
  if (seenIds.has(task.id)) return false;
  const created = new Date(task.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  if (visitedAt) {
    const visited = new Date(visitedAt).getTime();
    if (!Number.isNaN(visited) && created > visited) return true;
  }
  return Date.now() - created < NEW_WINDOW_MS;
}

export default function Page() {
  const session = useSession();
  const router = useRouter();
  const userId = session?.userId ?? "anon";
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [objectType, setObjectType] = useState("ALL");
  const [priority, setPriority] = useState<PriorityFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("priority");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [visitedAt, setVisitedAt] = useState<string | null>(null);
  const [newSinceOpen, setNewSinceOpen] = useState(0);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  const tasks = useQuery({
    queryKey: ["inbox"],
    queryFn: () => api.get<Task[]>("/inbox"),
    refetchInterval: 30_000,
  });
  const detail = useQuery({
    queryKey: ["inbox-detail", selectedId],
    queryFn: () => api.get<TaskDetail>(`/inbox/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    const stored = loadSeen(userId);
    setSeenIds(stored.ids);
    setVisitedAt(stored.visitedAt);
  }, [userId]);

  useEffect(() => {
    const rows = tasks.data ?? [];
    if (!rows.length) return;
    const ids = new Set(rows.map((row) => row.id));
    if (!bootstrappedRef.current) {
      knownIdsRef.current = ids;
      bootstrappedRef.current = true;
      return;
    }
    let added = 0;
    for (const id of ids) {
      if (!knownIdsRef.current.has(id)) added += 1;
    }
    if (added > 0) setNewSinceOpen((count) => count + added);
    knownIdsRef.current = ids;
  }, [tasks.data]);

  const markSeen = useCallback((ids: string[]) => {
    setSeenIds((prev) => {
      const next = Array.from(new Set([...prev, ...ids])).slice(-500);
      const now = new Date().toISOString();
      setVisitedAt(now);
      saveSeen(userId, next, now);
      return next;
    });
    setNewSinceOpen(0);
  }, [userId]);

  const markAllVisibleSeen = useCallback(() => {
    markSeen((tasks.data ?? []).map((row) => row.id));
  }, [markSeen, tasks.data]);

  const decision = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post<{ nextTaskId: string | null }>(`/inbox/${id}/${action}`, { comment }),
    onSuccess: (payload, variables) => {
      setComment("");
      markSeen([variables.id]);
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["resource"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["my-overview"] });
      if (payload.nextTaskId) {
        setSelectedId(payload.nextTaskId);
        markSeen([payload.nextTaskId]);
        void queryClient.invalidateQueries({ queryKey: ["inbox-detail", payload.nextTaskId] });
      } else {
        setSelectedId(null);
      }
    },
  });

  const seenSet = useMemo(() => new Set(seenIds), [seenIds]);

  const counts = useMemo(() => {
    const rows = tasks.data ?? [];
    return {
      all: rows.length,
      approvals: rows.filter((row) => isApprovalType(row.type)).length,
      payments: rows.filter((row) => row.type === "PAYMENT_RELEASE").length,
      accounting: rows.filter((row) => row.type === "ACCOUNTING_EXCEPTION").length,
      matches: rows.filter((row) => row.type === "PROCUREMENT_MATCH_EXCEPTION").length,
      high: rows.filter((row) => row.priority === "HIGH" || row.priority === "URGENT").length,
      fresh: rows.filter((row) => isNewTask(row, seenSet, visitedAt)).length,
    };
  }, [tasks.data, seenSet, visitedAt]);

  const objectTypeOptions = useMemo(() => {
    const rows = (tasks.data ?? []).filter((row) => matchesCategory(row, category));
    const keys = Array.from(new Set(rows.map((row) => row.objectType))).sort();
    return keys;
  }, [tasks.data, category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = (tasks.data ?? []).filter((row) => matchesCategory(row, category));
    if (objectType !== "ALL") rows = rows.filter((row) => row.objectType === objectType);
    if (priority === "HIGH") rows = rows.filter((row) => row.priority === "HIGH" || row.priority === "URGENT");
    if (priority === "NORMAL") rows = rows.filter((row) => row.priority === "NORMAL" || row.priority === "LOW");
    if (q) {
      rows = rows.filter((row) => {
        const haystack = [
          row.name,
          row.requestedBy,
          row.entity,
          row.type,
          row.objectType,
          row.policySummary,
          row.invoiceNumber,
          row.amount,
          row.currency,
          TYPE_LABELS[row.type],
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "amount") return Number(b.amount) - Number(a.amount);
      if (sort === "due") {
        if (!a.dueAt && !b.dueAt) return priorityRank(a.priority) - priorityRank(b.priority);
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return a.dueAt.localeCompare(b.dueAt);
      }
      return priorityRank(a.priority) - priorityRank(b.priority) || b.createdAt.localeCompare(a.createdAt);
    });
    return rows;
  }, [tasks.data, category, objectType, priority, search, sort]);

  useEffect(() => {
    setPage(0);
  }, [category, objectType, priority, search, sort]);

  const selected = detail.data ?? filtered.find((row) => row.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const columns: Column<Task>[] = [
    {
      key: "new",
      header: "",
      render: (row) => (isNewTask(row, seenSet, visitedAt) ? <span className="inbox-badge-new">New</span> : null),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => TYPE_LABELS[row.type] ?? row.type.replaceAll("_", " "),
    },
    {
      key: "name",
      header: "Request",
      render: (row) => (
        <div className="inbox-table-request">
          <strong>{row.name}</strong>
          <small>
            {row.requestedBy}
            {row.entity ? ` · ${row.entity}` : ""}
            {isApprovalType(row.type) ? ` · Step ${row.currentStep}/${row.totalSteps}` : ""}
          </small>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => formatAmount(row),
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => <StatusBadge status={row.priority} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "policySummary",
      header: "Summary",
      render: (row) => row.category || row.policySummary || "—",
    },
    {
      key: "createdAt",
      header: "Received",
      render: (row) => (row.dueAt ? `Due ${new Date(row.dueAt).toLocaleDateString()}` : new Date(row.createdAt).toLocaleString()),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        row.type === "ACCOUNTING_EXCEPTION" ? (
          <Link
            className="btn btn-primary"
            href={sourceHref(row)}
            onClick={(event) => {
              event.stopPropagation();
              markSeen([row.id]);
            }}
          >
            Open in Accounting
          </Link>
        ) : row.type === "PROCUREMENT_MATCH_EXCEPTION" ? (
          <Link
            className="btn btn-primary"
            href={sourceHref(row)}
            onClick={(event) => {
              event.stopPropagation();
              markSeen([row.id]);
            }}
          >
            Resolve
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={(event) => {
              event.stopPropagation();
              openTask(row.id);
            }}
          >
            Review
          </button>
        )
      ),
    },
  ];

  function openTask(id: string) {
    setSelectedId(id);
    markSeen([id]);
  }

  const categoryChips: Array<{ key: CategoryFilter; label: string; count: number }> = [
    { key: "ALL", label: "All", count: counts.all },
    { key: "APPROVALS", label: "Approvals", count: counts.approvals },
    { key: "PAYMENT_RELEASE", label: "Payments", count: counts.payments },
    { key: "ACCOUNTING_EXCEPTION", label: "Accounting", count: counts.accounting },
    { key: "PROCUREMENT_MATCH_EXCEPTION", label: "Match exceptions", count: counts.matches },
  ];

  return (
    <div className="inbox-page">
      <div className="inbox-heading">
        <PageHeader
          title="Inbox"
          subtitle="Only tasks assigned to you — approvals, payment release, accounting, and match exceptions"
        />
        <div className="inbox-heading-meta">
          <span className="inbox-count-pill">{counts.all} open</span>
          {counts.fresh > 0 && <span className="inbox-new-pill">{counts.fresh} new</span>}
          {counts.high > 0 && <span className="inbox-high-pill">{counts.high} high priority</span>}
        </div>
      </div>

      {newSinceOpen > 0 && (
        <div className="inbox-banner" role="status">
          <strong>{newSinceOpen} new task{newSinceOpen === 1 ? "" : "s"} arrived</strong>
          <span>while you were on this page.</span>
          <button type="button" className="btn btn-ghost" onClick={() => { void tasks.refetch(); setNewSinceOpen(0); }}>
            Refresh list
          </button>
          <button type="button" className="btn btn-ghost" onClick={markAllVisibleSeen}>
            Mark all seen
          </button>
        </div>
      )}

      <section className="inbox-toolbar" aria-label="Inbox filters">
        <div className="filter-row inbox-category-row">
          {categoryChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`chip ${category === chip.key ? "chip-active" : ""}`}
              onClick={() => { setCategory(chip.key); setObjectType("ALL"); }}
            >
              {chip.label}
              <span className="chip-count">{chip.count}</span>
            </button>
          ))}
        </div>

        <div className="inbox-controls">
          <label className="inbox-search">
            <span className="sr-only">Search inbox</span>
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requester, vendor, amount, policy…"
            />
          </label>
          <label>
            <span className="sr-only">Object type</span>
            <select className="input inbox-select" value={objectType} onChange={(event) => setObjectType(event.target.value)}>
              <option value="ALL">All types</option>
              {objectTypeOptions.map((key) => (
                <option key={key} value={key}>{OBJECT_TYPE_LABELS[key] ?? key}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Priority</span>
            <select className="input inbox-select" value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)}>
              <option value="ALL">All priorities</option>
              <option value="HIGH">High / urgent</option>
              <option value="NORMAL">Normal / low</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sort</span>
            <select className="input inbox-select" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="priority">Sort: priority</option>
              <option value="newest">Sort: newest</option>
              <option value="oldest">Sort: oldest</option>
              <option value="amount">Sort: amount</option>
              <option value="due">Sort: due soon</option>
            </select>
          </label>
          {counts.fresh > 0 && (
            <button type="button" className="btn btn-ghost" onClick={markAllVisibleSeen}>
              Mark new as seen
            </button>
          )}
        </div>
      </section>

      {tasks.isError ? (
        <p className="error-panel" role="alert">
          Could not load your tasks.{" "}
          <button className="text-button" type="button" onClick={() => void tasks.refetch()}>Try again</button>
        </p>
      ) : tasks.isPending ? (
        <p className="muted">Loading tasks…</p>
      ) : filtered.length === 0 ? (
        <div className="empty-work">
          <strong>{(tasks.data ?? []).length ? "No tasks match these filters" : "You are all caught up"}</strong>
          <p>
            {(tasks.data ?? []).length
              ? "Clear search or change filters to see remaining work."
              : "No approvals or exceptions are waiting for you. New items appear here automatically."}
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrap inbox-unified-table">
            <DataTable
              rows={pageRows}
              columns={columns}
              onRowClick={(row) => {
                if (row.type === "ACCOUNTING_EXCEPTION" || row.type === "PROCUREMENT_MATCH_EXCEPTION") {
                  markSeen([row.id]);
                  router.push(sourceHref(row));
                  return;
                }
                openTask(row.id);
              }}
            />
          </div>
          <div className="inbox-pagination">
            <span className="muted">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              {filtered.length !== counts.all ? ` (filtered from ${counts.all})` : ""}
            </span>
            <div>
              <button className="btn btn-ghost" type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                Previous
              </button>
              <button className="btn btn-ghost" type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <DrawerReview open={Boolean(selectedId)} title="Review task" onClose={() => setSelectedId(null)}>
        {selected && (
          <div className="detail-panel">
            <div className="review-summary">
              <span>{TYPE_LABELS[selected.type] ?? selected.type.replaceAll("_", " ")}</span>
              <h2>{selected.name}</h2>
              <strong>{selected.amount === "0" ? selected.policySummary : formatAmount(selected)}</strong>
            </div>

            {selected.type === "ACCOUNTING_EXCEPTION" ? (
              <>
                <dl className="detail-list">
                  <div><dt>Source</dt><dd>{selected.sourceType ?? "—"}</dd></div>
                  {selected.entity && <div><dt>Legal entity</dt><dd>{selected.entity}</dd></div>}
                  <div><dt>Status</dt><dd><StatusBadge status={selected.status} /></dd></div>
                  <div><dt>Coding / issue</dt><dd>{selected.category || selected.policySummary || "Needs coding review"}</dd></div>
                  <div><dt>Updated</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div>
                </dl>
                <div className="detail-actions">
                  <Link
                    className="btn btn-primary"
                    href={sourceHref(selected)}
                    onClick={() => markSeen([selected.id])}
                  >
                    Open in Accounting
                  </Link>
                </div>
                <p className="muted">This opens the exact accounting entry so you can code it and mark it ready.</p>
              </>
            ) : (
              <>
                <dl className="detail-list">
                  <div><dt>Requested by</dt><dd>{selected.requestedBy}</dd></div>
                  {selected.entity && <div><dt>Legal entity</dt><dd>{selected.entity}</dd></div>}
                  <div><dt>Priority</dt><dd><StatusBadge status={selected.priority} /></dd></div>
                  {isApprovalType(selected.type) && <div><dt>Approval step</dt><dd>{selected.currentStep} of {selected.totalSteps}</dd></div>}
                  <div><dt>Policy</dt><dd>{selected.policySummary || "—"}</dd></div>
                  {selected.dueAt && <div><dt>Due</dt><dd>{new Date(selected.dueAt).toLocaleString()}</dd></div>}
                  <div><dt>Received</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div>
                </dl>

                {detail.isPending && <p className="muted">Loading policy and activity…</p>}

                {detail.data?.policy && (
                  <div className="policy-box">
                    <strong>Policy result: {detail.data.policy.result}</strong>
                    <p>{detail.data.policy.explanation}</p>
                    {detail.data.policy.matchedRules?.length > 0 && (
                      <p className="muted">Matched: {detail.data.policy.matchedRules.join(", ")}</p>
                    )}
                  </div>
                )}

                {detail.data?.timeline?.length ? (
                  <div className="timeline">
                    <h3>Activity</h3>
                    {detail.data.timeline.map((item, index) => (
                      <div key={`${item.at}-${index}`} className="timeline-item">
                        <strong>{item.action}</strong> · {item.actor}
                        <div className="muted">{new Date(item.at).toLocaleString()}</div>
                        {item.comment && <p>{item.comment}</p>}
                      </div>
                    ))}
                  </div>
                ) : null}

                <Link className="detail-link" href={sourceHref(selected)}>View source record →</Link>

                {selected.status === "INFO_REQUESTED" ? (
                  <div className="policy-box">
                    <strong>Information has already been requested</strong>
                    <p>Approve to continue from this step if the request was sent by mistake, or reject the request with a comment.</p>
                  </div>
                ) : null}

                {selected.availableActions.some((action) => ["approve", "reject", "request_info", "release"].includes(action)) && (
                  <label className="review-comment">
                    Comment
                    <textarea
                      className="input"
                      rows={3}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Required for reject / request info"
                    />
                  </label>
                )}

                {decision.isError && <p className="error" role="alert">{decision.error.message}</p>}

                <div className="detail-actions">
                  {selected.availableActions.includes("approve") && (
                    <button className="btn btn-primary" disabled={decision.isPending} onClick={() => decision.mutate({ id: selected.id, action: "approve" })}>
                      Approve
                    </button>
                  )}
                  {selected.availableActions.includes("release") && (
                    <button className="btn btn-primary" disabled={decision.isPending} onClick={() => decision.mutate({ id: selected.id, action: "release" })}>
                      Release payment
                    </button>
                  )}
                  {selected.availableActions.includes("request_info") && (
                    <button className="btn btn-ghost" disabled={decision.isPending || !comment.trim()} onClick={() => decision.mutate({ id: selected.id, action: "request_info" })}>
                      Request info
                    </button>
                  )}
                  {selected.availableActions.includes("reject") && (
                    <button className="btn btn-ghost" disabled={decision.isPending || !comment.trim()} onClick={() => decision.mutate({ id: selected.id, action: "reject" })}>
                      Reject
                    </button>
                  )}
                  {(selected.availableActions.includes("resolve") || selected.availableActions.includes("open")) && selected.objectType === "match" && (
                    <Link className="btn btn-primary" href={sourceHref(selected)}>Resolve in Match exceptions</Link>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DrawerReview>
    </div>
  );
}
