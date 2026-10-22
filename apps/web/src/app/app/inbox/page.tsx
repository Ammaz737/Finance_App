"use client";

import "./inbox.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DrawerReview, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { NavigationIcon } from "@/components/NavigationIcon";
import { ReceiptDocument } from "@/components/ReceiptDocument";
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
  document: { id: string; name: string; mimeType: string; malwareStatus: string; receiptStatus: string | null } | null;
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

const TASK_ICONS: Record<string, string> = {
  spend_request: "Cards", expense: "Receipts", reimbursement: "Reimbursements",
  bill: "Bills", procurement: "Procurement", travel: "Travel", payment: "Payments",
  accounting: "Accounting", match: "Receiving",
};

function InboxStatus({ value }: { value: string }) {
  return <span className="inbox-neutral-status"><i aria-hidden="true" />{value.toLowerCase().replaceAll("_", " ")}</span>;
}

function inboxDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function reviewDate(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

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
  const tableRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollTop = 0;
  }, [page, category, objectType, priority, search, sort]);

  const selected = detail.data ?? filtered.find((row) => row.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const columns: Column<Task>[] = [
    {
      key: "new",
      header: "Update",
      render: (row) => (isNewTask(row, seenSet, visitedAt) ? <span className="inbox-badge-new">New</span> : <span className="inbox-update-empty" aria-label="No new update">—</span>),
    },
    {
      key: "name",
      header: "Request",
      render: (row) => (
        <div className="inbox-table-request">
          <strong>{row.name}</strong>
          <small>
            <span className="inbox-requester-initial" aria-hidden="true">{row.requestedBy?.trim().charAt(0).toUpperCase() || "•"}</span>{row.requestedBy}
            {row.entity ? ` · ${row.entity}` : ""}
            {isApprovalType(row.type) ? ` · Step ${row.currentStep}/${row.totalSteps}` : ""}
          </small>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => <span className="inbox-task-type"><span className="inbox-task-symbol"><NavigationIcon label={TASK_ICONS[row.objectType] ?? "Requests"} /></span><span>{TYPE_LABELS[row.type] ?? row.type.replaceAll("_", " ")}</span></span>,
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => <span className="inbox-table-amount">{formatAmount(row)}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => <span className={`inbox-neutral-priority priority-${row.priority.toLowerCase()}`}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 13V9m5 4V6m5 7V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>{row.priority.toLowerCase()}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <InboxStatus value={row.status} />,
    },
    {
      key: "policySummary",
      header: "Summary",
      render: (row) => row.category || row.policySummary || "—",
    },
    {
      key: "createdAt",
      header: "Due / received",
      render: (row) => <span className="inbox-table-date">{row.dueAt ? <><strong>{inboxDate(row.dueAt)}</strong><small>Due date</small></> : <><strong>{inboxDate(row.createdAt)}</strong><small>{new Date(row.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></>}</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        row.type === "ACCOUNTING_EXCEPTION" ? (
          <Link
            className="inbox-table-action"
            href={sourceHref(row)}
            onClick={(event) => {
              event.stopPropagation();
              markSeen([row.id]);
            }}
          >
            Open in Accounting <span aria-hidden="true">↗</span>
          </Link>
        ) : row.type === "PROCUREMENT_MATCH_EXCEPTION" ? (
          <Link
            className="inbox-table-action"
            href={sourceHref(row)}
            onClick={(event) => {
              event.stopPropagation();
              markSeen([row.id]);
            }}
          >
            Resolve <span aria-hidden="true">↗</span>
          </Link>
        ) : (
          <button
            type="button"
            className="inbox-table-action"
            onClick={(event) => {
              event.stopPropagation();
              openTask(row.id);
            }}
          >
            Review <span aria-hidden="true">›</span>
          </button>
        )
      ),
    },
  ];

  function openTask(id: string) {
    setSelectedId(id);
    markSeen([id]);
  }

  const categoryChips: Array<{ key: CategoryFilter; label: string; icon: string; count: number }> = [
    { key: "ALL", label: "All tasks", icon: "Inbox", count: counts.all },
    { key: "APPROVALS", label: "Approvals", icon: "For approval", count: counts.approvals },
    { key: "PAYMENT_RELEASE", label: "Payments", icon: "Payments", count: counts.payments },
    { key: "ACCOUNTING_EXCEPTION", label: "Accounting", icon: "Accounting", count: counts.accounting },
    { key: "PROCUREMENT_MATCH_EXCEPTION", label: "Match exceptions", icon: "Receiving", count: counts.matches },
  ];

  const hasFilters = category !== "ALL" || objectType !== "ALL" || priority !== "ALL" || Boolean(search);
  function clearFilters() {
    setCategory("ALL");
    setObjectType("ALL");
    setPriority("ALL");
    setSearch("");
  }

  return (
    <div className="inbox-page">
      <nav className="inbox-breadcrumb" aria-label="Breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span>Inbox</span></nav>
      <div className="inbox-heading">
        <div className="inbox-heading-title"><div>
        <PageHeader
          title="Inbox"
          subtitle="Your next decisions, all in one place. Review requests and keep work moving."
        />
        </div></div>
        <span className="inbox-auto-refresh"><i aria-hidden="true" />Updates every 30 seconds</span>
      </div>

      <div className="inbox-summary" aria-label="Task summary">
        <div className="inbox-summary-card summary-open"><span className="inbox-summary-symbol"><NavigationIcon label="Inbox" /></span><div><span>Open tasks</span><strong>{tasks.isPending || tasks.isError ? "—" : counts.all}</strong><small>Assigned to you</small></div></div>
        <div className="inbox-summary-card summary-new"><span className="inbox-summary-symbol"><NavigationIcon label="Notifications" /></span><div><span>New tasks</span><strong>{tasks.isPending || tasks.isError ? "—" : counts.fresh}</strong><small>Ready for your first look</small></div></div>
        <div className="inbox-summary-card summary-priority"><span className="inbox-summary-symbol"><NavigationIcon label="Needs review" /></span><div><span>High priority</span><strong>{tasks.isPending || tasks.isError ? "—" : counts.high}</strong><small>High and urgent requests</small></div></div>
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

      <div className="inbox-workspace">
      <div className="inbox-workspace-head"><div><h2>Assigned to you</h2><span>{tasks.isPending || tasks.isError ? "—" : `${filtered.length} task${filtered.length === 1 ? "" : "s"}${filtered.length !== counts.all ? ` of ${counts.all}` : ""}`}</span></div><div className="inbox-workspace-actions">{counts.fresh > 0 && <button type="button" className="inbox-mark-seen" onClick={markAllVisibleSeen}>Mark new as seen</button>}<button type="button" className="inbox-refresh" disabled={tasks.isFetching} onClick={() => void tasks.refetch()}><NavigationIcon label="Synced" />{tasks.isFetching ? "Refreshing…" : "Refresh"}</button></div></div>
      <section className="inbox-toolbar" aria-label="Inbox filters">
        <div className="filter-row inbox-category-row">
          {categoryChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`chip ${category === chip.key ? "chip-active" : ""}`}
              aria-pressed={category === chip.key}
              onClick={() => { setCategory(chip.key); setObjectType("ALL"); }}
            >
              <NavigationIcon label={chip.icon} />{chip.label}
              <span className="chip-count">{chip.count}</span>
            </button>
          ))}
        </div>

        <div className="inbox-controls">
          <label className="inbox-search">
            <span className="sr-only">Search inbox</span>
            <NavigationIcon label="Search" />
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requester, vendor, amount, policy…"
            />
          </label>
          <label>
            <span className="inbox-filter-caption">Type</span>
            <select aria-label="Object type" className="input inbox-select" value={objectType} onChange={(event) => setObjectType(event.target.value)}>
              <option value="ALL">All types</option>
              {objectTypeOptions.map((key) => (
                <option key={key} value={key}>{OBJECT_TYPE_LABELS[key] ?? key}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="inbox-filter-caption">Priority</span>
            <select aria-label="Priority" className="input inbox-select" value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)}>
              <option value="ALL">All priorities</option>
              <option value="HIGH">High / urgent</option>
              <option value="NORMAL">Normal / low</option>
            </select>
          </label>
          <label>
            <span className="inbox-filter-caption">Sort by</span>
            <select aria-label="Sort" className="input inbox-select" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="priority">Priority</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount">Highest amount</option>
              <option value="due">Due soon</option>
            </select>
          </label>
        </div>
        {hasFilters && <div className="inbox-filter-feedback"><span>{filtered.length} matching task{filtered.length === 1 ? "" : "s"}</span><button type="button" onClick={clearFilters}>Clear filters <span aria-hidden="true">×</span></button></div>}
      </section>

      {tasks.isError ? (
        <p className="error-panel" role="alert">
          Could not load your tasks.{" "}
          <button className="text-button" type="button" onClick={() => void tasks.refetch()}>Try again</button>
        </p>
      ) : tasks.isPending ? (
        <div className="inbox-loading" role="status"><span className="inbox-state-icon"><NavigationIcon label="Synced" /></span><strong>Getting your tasks ready</strong><p>Loading your assigned requests and reviews…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-work inbox-empty">
          <span className="inbox-state-icon"><NavigationIcon label={(tasks.data ?? []).length ? "Search" : "For approval"} /></span>
          <strong>{(tasks.data ?? []).length ? "No tasks match these filters" : "You are all caught up"}</strong>
          <p>
            {(tasks.data ?? []).length
              ? "Clear search or change filters to see remaining work."
              : "No approvals or exceptions are waiting for you. New items appear here automatically."}
          </p>
          {hasFilters && <button className="btn btn-primary" type="button" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <>
          <div ref={tableRef} className="table-wrap inbox-unified-table" role="region" aria-label="Assigned tasks table" tabIndex={0}>
            <table className="data-table inbox-data-table">
              <caption className="sr-only">Assigned inbox tasks. Select a request to review it or use its action.</caption>
              <thead><tr>{columns.map((column) => <th key={column.key} scope="col" className={`inbox-col-${column.key}`}>{column.header}</th>)}</tr></thead>
              <tbody>{pageRows.map((row) => {
                const activate = () => {
                if (row.type === "ACCOUNTING_EXCEPTION" || row.type === "PROCUREMENT_MATCH_EXCEPTION") {
                  markSeen([row.id]);
                  router.push(sourceHref(row));
                  return;
                }
                openTask(row.id);
                };
                return <tr key={row.id} className={isNewTask(row, seenSet, visitedAt) ? "is-new" : undefined} tabIndex={0} aria-label={`Open ${row.name}`} onClick={activate} onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
                }}>{columns.map((column) => <td key={column.key} data-label={column.header} className={`inbox-col-${column.key}`}>{column.render ? column.render(row) : String(row[column.key as keyof Task] ?? "")}</td>)}</tr>;
              })}</tbody>
            </table>
          </div>
          <div className="inbox-pagination">
            <span className="muted">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              {filtered.length !== counts.all ? ` (filtered from ${counts.all})` : ""}
            </span>
            <div>
              <span className="inbox-page-number">Page {page + 1} of {pageCount}</span>
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
      </div>

      <DrawerReview open={Boolean(selectedId)} title="Review task" onClose={() => setSelectedId(null)}>
        {selected && (
          <div className="detail-panel">
            <div className="review-summary">
              <div className="inbox-review-type"><span className="inbox-review-icon"><NavigationIcon label={TASK_ICONS[selected.objectType] ?? "Requests"} /></span><span>{TYPE_LABELS[selected.type] ?? selected.type.replaceAll("_", " ")}</span></div>
              <h2>{selected.name}</h2>
              <div className="inbox-review-amount"><div><small>{selected.amount === "0" ? "Review summary" : "Requested amount"}</small><strong>{selected.amount === "0" ? selected.policySummary : formatAmount(selected)}</strong></div><InboxStatus value={selected.status} /></div>
            </div>

            <h3 className="inbox-review-section-title">Request details</h3>

            {selected.type === "ACCOUNTING_EXCEPTION" ? (
              <>
                <dl className="detail-list">
                  <div><dt>Source</dt><dd>{selected.sourceType ?? "—"}</dd></div>
                  {selected.entity && <div><dt>Legal entity</dt><dd>{selected.entity}</dd></div>}
                  <div><dt>Status</dt><dd><StatusBadge status={selected.status} /></dd></div>
                  <div><dt>Coding / issue</dt><dd>{selected.category || selected.policySummary || "Needs coding review"}</dd></div>
                  <div><dt>Updated</dt><dd>{reviewDate(selected.createdAt)}</dd></div>
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
                  {selected.dueAt && <div><dt>Due</dt><dd>{reviewDate(selected.dueAt)}</dd></div>}
                  <div><dt>Received</dt><dd>{reviewDate(selected.createdAt)}</dd></div>
                </dl>

                {detail.isPending && <p className="muted">Loading policy and activity…</p>}
                {detail.isError && <p className="error" role="alert">Could not load policy and activity. <button type="button" className="text-button" onClick={() => void detail.refetch()}>Try again</button></p>}

                {detail.data?.policy && (
                  <div className="policy-box inbox-review-policy" data-result={detail.data.policy.result.toUpperCase()}>
                    <span className="inbox-policy-icon"><NavigationIcon label="Policies" /></span>
                    <div><strong>Policy result: {detail.data.policy.result}</strong>
                    <p>{detail.data.policy.explanation}</p>
                    {detail.data.policy.matchedRules?.length > 0 && (
                      <p className="muted">Matched: {detail.data.policy.matchedRules.join(", ")}</p>
                    )}</div>
                  </div>
                )}

                {detail.data?.timeline?.length ? (
                  <div className="timeline">
                    <h3>Activity</h3>
                    {detail.data.timeline.map((item, index) => (
                      <div key={`${item.at}-${index}`} className="timeline-item">
                        <strong>{item.action}</strong> · {item.actor}
                        <div className="muted">{reviewDate(item.at)}</div>
                        {item.comment && <p>{item.comment}</p>}
                      </div>
                    ))}
                  </div>
                ) : null}

                {detail.data?.document && <ReceiptDocument key={detail.data.document.id} id={detail.data.document.id} name={detail.data.document.name} />}
                {detail.data && !detail.data.document && ["expense", "reimbursement", "bill"].includes(selected.objectType) && <p className="muted">No receipt / invoice attached.</p>}

                <Link className="detail-link" href={sourceHref(selected)}>View source record <span aria-hidden="true">↗</span></Link>

                {selected.status === "INFO_REQUESTED" ? (
                  <div className="policy-box">
                    <strong>Information has already been requested</strong>
                    <p>Approve to continue from this step if the request was sent by mistake, or reject the request with a comment.</p>
                  </div>
                ) : null}

                {selected.availableActions.some((action) => ["approve", "reject", "request_info", "release"].includes(action)) && (
                  <label className="review-comment">
                    <span>Comment</span>
                    <textarea
                      className="input"
                      aria-label="Comment"
                      aria-describedby="inbox-comment-help"
                      rows={3}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Add context for the requester…"
                    />
                    <small id="inbox-comment-help">Required when requesting information or rejecting. Optional for approval.</small>
                  </label>
                )}

                {decision.isError && <p className="error" role="alert">{decision.error.message}</p>}

                <div className="detail-actions">
                  {selected.availableActions.includes("approve") && (
                    <button className="btn btn-primary" disabled={decision.isPending} onClick={() => decision.mutate({ id: selected.id, action: "approve" })}>
                      <NavigationIcon label="For approval" />Approve
                    </button>
                  )}
                  {selected.availableActions.includes("release") && (
                    <button className="btn btn-primary" disabled={decision.isPending} onClick={() => decision.mutate({ id: selected.id, action: "release" })}>
                      <NavigationIcon label="Payments" />Release payment
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
