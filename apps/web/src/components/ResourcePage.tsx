"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable, DrawerReview, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { api } from "@/lib/api";
import { actionPermissions, createPermissions, labelForKey, resourceConfig, type FieldConfig } from "@/config/resource-config";
import { useSession } from "@/providers/session-provider";
import { DEFAULT_NEW_WITHIN_DAYS, isNewRecord, MY_WORK_NEEDS_ACTION, type MyWorkFocus } from "@/lib/my-work-filters";

type Row = { id: string; status?: string; currency?: string; [key: string]: unknown };
type Action = { label: string; name: string };

const hiddenKeys = new Set(["passwordHash", "token", "clientSecretHash", "secret", "taxId"]);
const references: Record<string, { path: string; label: (row: Row) => string }> = {
  vendorId: { path: "vendors", label: (row) => String(row.name ?? row.id) },
  requesterId: { path: "people", label: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || String(row.email ?? row.id) },
  userId: { path: "people", label: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || String(row.email ?? row.id) },
  ownerId: { path: "people", label: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || String(row.email ?? row.id) },
  holderId: { path: "people", label: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || String(row.email ?? row.id) },
  travelerId: { path: "people", label: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || String(row.email ?? row.id) },
  actorId: { path: "people", label: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || String(row.email ?? row.id) },
  createdBy: { path: "people", label: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || String(row.email ?? row.id) },
  receivedBy: { path: "people", label: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || String(row.email ?? row.id) },
  legalEntityId: { path: "entities", label: (row) => String(row.name ?? row.id) },
  programId: { path: "spend-programs", label: (row) => String(row.name ?? row.id) },
  billId: { path: "bills", label: (row) => String(row.invoiceNumber ?? row.id) },
  purchaseOrderId: { path: "purchase-orders", label: (row) => String(row.number ?? row.id) },
  fromAccountId: { path: "banking", label: (row) => String(row.name ?? row.id) },
  toAccountId: { path: "banking", label: (row) => String(row.name ?? row.id) },
};

function displayValue(key: string, value: unknown, row: Row, labels: Record<string, Record<string, string>> = {}) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "status" || key === "policyResult") return <StatusBadge status={String(value)} />;
  if (value instanceof Date || (typeof value === "string" && /At$|Date$/.test(key))) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  if (typeof value === "object") return "View linked details";
  if (references[key] && typeof value === "string") return labels[key]?.[value] ?? value.slice(0, 8);
  if (key.endsWith("Id") && typeof value === "string") return value.slice(0, 8);
  if (/Amount$|^amount$|^available$|^balance$/.test(key) && row.currency) {
    const amount = Number(value);
    if (Number.isFinite(amount)) return `${row.currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return String(value);
}

function initialValues(fields: FieldConfig[]) {
  return Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? field.options?.[0]?.value ?? ""])) as Record<string, string>;
}

export function ResourcePage(props: {
  title: string;
  path: string;
  columns?: Column<Row>[];
  actions?: Action[];
  mineField?: string;
  filter?: Record<string, string[]>;
  predicate?: (row: Row) => boolean;
  onRowNavigate?: (row: Row) => void;
  pageSize?: number;
  /** Opt-in chips: All / New / Needs action + status filters for My work lists. */
  myWorkFilters?: boolean;
  needsActionStatuses?: string[];
  newWithinDays?: number;
}) {
  return (
    <Suspense fallback={<p className="muted">Loading {props.title.toLowerCase()}…</p>}>
      <ResourcePageInner {...props} />
    </Suspense>
  );
}

function ResourcePageInner({ title, path, columns, actions = [], mineField, filter, predicate, onRowNavigate, pageSize, myWorkFilters, needsActionStatuses, newWithinDays = DEFAULT_NEW_WITHIN_DAYS }: {
  title: string;
  path: string;
  columns?: Column<Row>[];
  actions?: Action[];
  mineField?: string;
  filter?: Record<string, string[]>;
  predicate?: (row: Row) => boolean;
  onRowNavigate?: (row: Row) => void;
  pageSize?: number;
  myWorkFilters?: boolean;
  needsActionStatuses?: string[];
  newWithinDays?: number;
}) {
  const session = useSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("entry") ?? searchParams.get("id");
  const urlFocus = searchParams.get("focus");
  const urlStatus = searchParams.get("status");
  const config = resourceConfig[path];
  const fields = config?.fields ?? [];
  const [selected, setSelected] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [accountingDraft, setAccountingDraft] = useState({ category: "", memo: "", glAccount: "", department: "" });
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
  const [createKey, setCreateKey] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [focus, setFocus] = useState<MyWorkFocus>(() => {
    if (urlFocus === "new") return "NEW";
    if (urlFocus === "needs") return "NEEDS_ACTION";
    if (urlStatus && urlStatus !== "ALL") return urlStatus;
    return "ALL";
  });
  const [status, setStatus] = useState(urlStatus && urlStatus !== "ALL" ? urlStatus : "ALL");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [sandboxLink, setSandboxLink] = useState("");
  const [viewName, setViewName] = useState("");
  const [deepLinkHandled, setDeepLinkHandled] = useState<string | null>(null);
  const actionStatuses = needsActionStatuses ?? MY_WORK_NEEDS_ACTION[path] ?? [];


  const query = useQuery({
    queryKey: ["resource", path, deferredSearch],
    queryFn: () => api.get<Row[]>(`/${path}${deferredSearch ? `?q=${encodeURIComponent(deferredSearch)}` : ""}`),
  });
  const savedViews = useQuery({
    queryKey: ["saved-views", path],
    queryFn: () => api.get<Array<{ id: string; name: string; filters: { status?: string } }>>(`/saved-views?resource=${encodeURIComponent(path)}`),
  });
  const saveView = useMutation({
    mutationFn: () => {
      const currentFocus = myWorkFilters ? focus : status;
      const savedStatus = myWorkFilters
        ? (currentFocus === "NEW" || currentFocus === "NEEDS_ACTION" || currentFocus === "ALL" ? "ALL" : String(currentFocus))
        : status;
      return api.post("/saved-views", {
        resource: path,
        name: viewName.trim() || `${title} ${savedStatus === "ALL" ? currentFocus : savedStatus}`,
        filters: { status: savedStatus, focus: myWorkFilters ? currentFocus : undefined },
        columns: config?.columns ?? [],
      });
    },
    onSuccess: () => {
      setViewName("");
      setMessage("Saved view created.");
      void queryClient.invalidateQueries({ queryKey: ["saved-views", path] });
    },
  });
  const referencedKeys = [...new Set((config?.columns ?? []).filter((key) => references[key]))];
  const referencedPaths = [...new Set(referencedKeys.map((key) => references[key].path))];
  const referenceQuery = useQuery({
    queryKey: ["reference-labels", path],
    queryFn: async () => {
      const lists = Object.fromEntries(await Promise.all(referencedPaths.map(async (source) => {
        try { return [source, await api.get<Row[]>(`/${source}`)] as const; }
        catch { return [source, [] as Row[]] as const; }
      })));
      return Object.fromEntries(referencedKeys.map((key) => [key, Object.fromEntries((lists[references[key].path] ?? []).map((row) => [row.id, references[key].label(row)]))]));
    },
    enabled: Boolean(query.data?.length) && referencedPaths.length > 0,
  });
  const labels = referenceQuery.data ?? {};

  const sourcePaths = [...new Set(fields.flatMap((field) => field.source ? [field.source.path] : []))];
  const optionsQuery = useQuery({
    queryKey: ["form-options", path],
    queryFn: async () => {
      // A user may be allowed to create a request while not being allowed to
      // read every optional reference (for example, vendors). Do not let one
      // forbidden reference make all of the form options unusable.
      const results = await Promise.all(sourcePaths.map(async (source) => {
        try {
          return [source, await api.get<Row[]>(`/${source}`)] as const;
        } catch {
          return [source, [] as Row[]] as const;
        }
      }));
      return Object.fromEntries(results);
    },
    enabled: creating && sourcePaths.length > 0,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, string>) => api.post<Row>(`/${path}`, path === "payments" ? { ...body, idempotencyKey: createKey } : body),
    onSuccess: (created) => {
      setCreating(false);
      setValues(initialValues(fields));
      setCreateKey("");
      const activationPath = typeof created?.activationPath === "string" ? created.activationPath : "";
      setSandboxLink(activationPath);
      setMessage(activationPath ? `${title} invited. Email is not configured; use the sandbox activation link below.` : `${title} record created.`);
      void queryClient.invalidateQueries({ queryKey: ["resource", path] });
    },
  });
  const action = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.post<Row>(`/${path}/${id}/${name}`, {}),
    onSuccess: (result, variables) => {
      const activationPath = typeof result?.activationPath === "string" ? result.activationPath : "";
      setSandboxLink(activationPath);
      setMessage(activationPath ? `${variables.name} completed. Email is not configured; copy the sandbox activation link below.` : `${variables.name} completed.`);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["resource", path] });
    },
  });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, string> }) => api.post<Row>(`/${path}/${id}/update`, body), onSuccess: () => { setMessage("Changes saved."); setEditing(null); setSelected(null); void queryClient.invalidateQueries({ queryKey: ["resource", path] }); } });
  const codeAccounting = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: typeof accountingDraft }) => api.post(`/accounting/${id}/code`, {
      category: draft.category,
      memo: draft.memo,
      coding: Object.fromEntries(Object.entries({ glAccount: draft.glAccount, department: draft.department }).filter(([, value]) => value.trim())),
    }),
    onSuccess: () => {
      setMessage("Accounting code saved. Review the entry, then mark it ready.");
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["resource", "accounting"] });
    },
  });

  const allRows = query.data ?? [];
  const filteredRows = filter ? allRows.filter((row) => Object.entries(filter).every(([field, values]) => values.includes(String(row[field])))) : allRows;
  const scopedRows = predicate ? filteredRows.filter(predicate) : filteredRows;
  const ownRows = mineField && session ? scopedRows.filter((row) => row[mineField] === session.userId) : scopedRows;
  const statuses = [...new Set(ownRows.map((row) => row.status).filter((item): item is string => Boolean(item)))];
  const searchedRows = deferredSearch ? ownRows.filter((row) => Object.values(row).some((value) => typeof value === "string" && value.toLowerCase().includes(deferredSearch.toLowerCase()))) : ownRows;
  const recordDate = (row: Row) => row.createdAt ?? row.authorizedAt;
  const newCount = searchedRows.filter((row) => isNewRecord(recordDate(row), newWithinDays)).length;
  const needsCount = searchedRows.filter((row) => actionStatuses.includes(String(row.status ?? ""))).length;
  const activeFocus = myWorkFilters ? focus : status;
  const rows = (() => {
    if (!myWorkFilters) {
      return status === "ALL" ? searchedRows : searchedRows.filter((row) => row.status === status);
    }
    if (activeFocus === "ALL") return searchedRows;
    if (activeFocus === "NEW") return searchedRows.filter((row) => isNewRecord(recordDate(row), newWithinDays));
    if (activeFocus === "NEEDS_ACTION") return searchedRows.filter((row) => actionStatuses.includes(String(row.status ?? "")));
    return searchedRows.filter((row) => row.status === activeFocus);
  })();
  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const visibleRows = pageSize ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;
  const permittedActions = actions.filter((item) => {
    const permission = actionPermissions[path]?.[item.name];
    return !permission || session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes(permission);
  });
  const keys = config?.columns ?? ["name", "status", "createdAt"];
  const baseCols: Column<Row>[] = columns ?? keys.map((key) => ({
    key,
    header: labelForKey(key),
    render: (row: Row) => displayValue(key, row[key], row, labels),
  }));
  const cols: Column<Row>[] = myWorkFilters
    ? baseCols.map((col) => {
        if (col.key !== "status") return col;
        const prior = col.render;
        return {
          ...col,
          render: (row: Row) => (
            <span className="status-with-new">
              {prior ? prior(row) : <StatusBadge status={String(row.status ?? "UNKNOWN")} />}
              {isNewRecord(row.createdAt, newWithinDays) ? <span className="badge-new">New</span> : null}
            </span>
          ),
        };
      })
    : baseCols;
  const createPermission = createPermissions[path];
  const canCreate = Boolean(config?.createLabel) && (!createPermission || session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes(createPermission)) && (path !== "people" || session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("roles.assign"));

  function setActiveFocus(next: MyWorkFocus) {
    setFocus(next);
    setStatus(next === "NEW" || next === "NEEDS_ACTION" || next === "ALL" ? "ALL" : next);
    setPage(1);
  }

  function fieldOptions(field: FieldConfig) {
    if (field.options) return field.options;
    const items = optionsQuery.data?.[field.source?.path ?? ""] ?? [];
    return items.filter((item) =>
      (!field.source?.entityField || !values.legalEntityId || item[field.source.entityField] === values.legalEntityId) &&
      (!field.source?.statuses || field.source.statuses.includes(String(item.status))),
    ).map((item) => {
      const base = String(item[field.source?.labelKey ?? "name"] ?? item.id);
      // Bank accounts: show masked last4 so payment-run source matches demo copy ("Operating ••••1111").
      if (field.source?.path === "banking" && item.last4) {
        return { value: item.id, label: `${base} ••••${String(item.last4)}` };
      }
      return { value: item.id, label: base };
    });
  }

  const formOptionsLoading = optionsQuery.isPending && sourcePaths.length > 0;

  function updateValue(key: string, value: string) {
    const normalized = key === "currency" || key === "country" ? value.toUpperCase() : value;
    const next = { ...values, [key]: normalized };
    if (key === "legalEntityId") {
      const entity = (optionsQuery.data?.entities ?? []).find((item) => item.id === value);
      if (entity?.currency && "currency" in next) next.currency = String(entity.currency);
      const vendor = (optionsQuery.data?.vendors ?? []).find((item) => item.id === values.vendorId);
      if (vendor?.legalEntityId && vendor.legalEntityId !== value) next.vendorId = "";
      const program = (optionsQuery.data?.["spend-programs"] ?? []).find((item) => item.id === values.programId);
      if (program?.legalEntityId && program.legalEntityId !== value) next.programId = "";
    }
    setValues(next);
  }

  function openCreate() {
    setSandboxLink("");
    setValues(initialValues(fields));
    setCreateKey(crypto.randomUUID());
    create.reset();
    setCreating(true);
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const missing = fields.find((field) => field.required && !values[field.key]?.trim());
    if (missing) {
      setMessage(`${missing.label} is required.`);
      return;
    }
    if (path === "reimbursements") {
      const type = values.type;
      if (type === "STANDARD" && !values.amount?.trim()) {
        setMessage("Amount is required for standard reimbursements.");
        return;
      }
      if (type === "MILEAGE" && !values.distanceMiles?.trim()) {
        setMessage("Distance (miles) is required for mileage reimbursements.");
        return;
      }
      if (type === "PER_DIEM" && !values.perDiemNights?.trim() && !values.eligibleDays?.trim()) {
        setMessage("Per-diem days (or eligible days) is required for per diem reimbursements.");
        return;
      }
    }
    // Only validate filled or required number fields — empty optional numbers must not block create.
    const invalidAmount = fields.find((field) => {
      if (field.type !== "number") return false;
      const raw = values[field.key]?.trim() ?? "";
      if (!raw) return Boolean(field.required);
      const amount = Number(raw);
      return !Number.isFinite(amount) || amount <= 0;
    });
    if (invalidAmount) {
      setMessage(`${invalidAmount.label} must be greater than zero.`);
      return;
    }
    // Omit blank optionals so API Zod optional/coerce fields do not receive "".
    const body = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim() !== ""),
    );
    create.mutate(body);
  }

  function runAction(item: Action, row: Row) {
    if (item.name === "update") {
      setEditing(row);
      setEditValues(Object.fromEntries(fields.map((field) => [field.key, String(row[field.key] ?? "")] )));
      return;
    }
    if (["release", "terminate", "freeze", "deactivate", "archive", "cancel"].includes(item.name) && !window.confirm(`Confirm ${item.label.toLowerCase()} for this record?`)) return;
    setMessage("");
    action.mutate({ id: row.id, name: item.name });
  }

  function selectRow(row: Row) {
    if (onRowNavigate) {
      onRowNavigate(row);
      return;
    }
    setSelected(row);
    if (path === "accounting") {
      const coding = typeof row.coding === "object" && row.coding !== null ? row.coding as Record<string, unknown> : {};
      setAccountingDraft({
        category: String(row.category ?? ""), memo: String(row.memo ?? ""),
        glAccount: String(coding.glAccount ?? ""), department: String(coding.department ?? ""),
      });
      codeAccounting.reset();
    }
  }

  useEffect(() => {
    if (!deepLinkId || !query.data?.length) return;
    if (deepLinkHandled === deepLinkId) return;
    const match = query.data.find((row) => row.id === deepLinkId);
    if (!match) {
      setMessage(`Record ${deepLinkId.slice(0, 8)}… was not found in this list.`);
      setDeepLinkHandled(deepLinkId);
      return;
    }
    setStatus("ALL");
    setFocus("ALL");
    selectRow(match);
    setDeepLinkHandled(deepLinkId);
    setMessage(path === "accounting" ? "Opened accounting entry from inbox." : `Opened ${title.toLowerCase()} from search.`);
  }, [deepLinkId, deepLinkHandled, path, query.data, title]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, activeFocus, status]);

  function actionApplies(name: string, row: Row) {
    const states: Record<string, string[]> = {
      "bills.submit": ["DRAFT"], "bills.approve": ["PENDING_APPROVAL"],
      "payments.release": ["SCHEDULED"], "payments.confirm-settlement": ["PROCESSING"],
      "payment-runs.release": ["OPEN"],
      "procurement.submit": ["DRAFT"], "procurement.approve": ["IN_REVIEW"],
      "purchase-orders.receive": ["OPEN", "PARTIALLY_RECEIVED"],
      "purchase-orders.match": ["OPEN", "PARTIALLY_RECEIVED", "RECEIVED"],
      "travel.submit": ["DRAFT"], "travel.approve": ["PENDING_APPROVAL"],
      "expenses.submit": ["DRAFT", "INCOMPLETE", "REJECTED"], "expenses.approve": ["SUBMITTED", "IN_REVIEW"],
      "spend-requests.approve": ["SUBMITTED", "IN_REVIEW"],
      "spend-programs.deactivate": ["ACTIVE"],
      "reimbursements.approve": ["IN_REVIEW"],
      "reimbursements.submit": ["DRAFT", "NEEDS_INFO"],
      "reimbursements.schedule": ["APPROVED", "FAILED", "READY_FOR_PAYOUT"],
      "reimbursements.confirm-payout": ["SCHEDULED"],
      "reimbursements.attach-receipt": ["DRAFT", "NEEDS_INFO"],
      "accounting.ready": ["NEEDS_REVIEW", "SYNC_ERROR"],
      "accounting.undo-ready": ["READY_TO_SYNC"],
      "accounting.retry": ["SYNC_ERROR"],
      "accounting.sync": ["READY_TO_SYNC"],
      "people.publish": ["DRAFT"], "people.terminate": ["ACTIVE", "DRAFT"], "people.reset-credentials": ["DRAFT", "ACTIVE"],
      "treasury.approve": ["PENDING_APPROVAL"], "treasury.release": ["APPROVED"],
      "transactions.capture": ["PENDING"], "transactions.clear": ["PENDING"], "transactions.void": ["PENDING"],
      "transactions.reverse": ["CLEARED"],
    };
    const allowed = states[`${path}.${name}`];
    return !allowed || !row.status || allowed.includes(row.status);
  }

  return <div className="resource-page">
    <div className="resource-heading"><PageHeader title={title} subtitle={config?.description ?? `${title} across your organization.`} />
      {canCreate && <button type="button" className="btn btn-primary" onClick={openCreate}>{config?.createLabel}</button>}
    </div>
    {myWorkFilters && (
      <div className="my-work-filters" role="toolbar" aria-label="List filters">
        <button type="button" className={`chip${activeFocus === "ALL" ? " chip-active" : ""}`} onClick={() => setActiveFocus("ALL")}>
          All <span className="chip-count">{searchedRows.length}</span>
        </button>
        <button type="button" className={`chip${activeFocus === "NEW" ? " chip-active" : ""}`} onClick={() => setActiveFocus("NEW")}>
          New <span className="chip-count">{newCount}</span>
        </button>
        {actionStatuses.length > 0 && (
          <button type="button" className={`chip${activeFocus === "NEEDS_ACTION" ? " chip-active" : ""}`} onClick={() => setActiveFocus("NEEDS_ACTION")}>
            Needs action <span className="chip-count">{needsCount}</span>
          </button>
        )}
        {statuses.map((item) => (
          <button
            key={item}
            type="button"
            className={`chip${activeFocus === item ? " chip-active" : ""}`}
            onClick={() => setActiveFocus(item)}
          >
            {item.replaceAll("_", " ")}
            <span className="chip-count">{searchedRows.filter((row) => row.status === item).length}</span>
          </button>
        ))}
      </div>
    )}
    <div className="resource-toolbar">
      <label className="search-field"><span className="sr-only">Search {title}</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} /></label>
      {!myWorkFilters && statuses.length > 1 && <select className="input status-filter" aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="ALL">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>}
      {(savedViews.data?.length ?? 0) > 0 && (
        <select className="input status-filter" aria-label="Saved views" defaultValue="" onChange={(event) => {
          const view = savedViews.data?.find((item) => item.id === event.target.value);
          if (!view?.filters) return;
          const filters = view.filters as { status?: string; focus?: string };
          if (myWorkFilters && filters.focus) {
            setActiveFocus(filters.focus);
          } else if (filters.status) {
            setActiveFocus(filters.status);
            setStatus(filters.status);
          }
        }}>
          <option value="">Saved views</option>
          {(savedViews.data ?? []).map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select>
      )}
      <label className="sr-only" htmlFor={`save-view-${path}`}>Saved view name</label>
      <input id={`save-view-${path}`} className="input" style={{ maxWidth: 160 }} value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Save view name" />
      <button type="button" className="btn btn-ghost" disabled={saveView.isPending || (status === "ALL" && activeFocus === "ALL") && !viewName.trim()} onClick={() => saveView.mutate()}>Save view</button>
      <span className="record-count">{rows.length} records{myWorkFilters && activeFocus === "NEW" ? ` · last ${newWithinDays} days` : ""}</span>
    </div>
    {message && <p className={message.includes("created") || message.includes("completed") || message.includes("invited") ? "notice" : "error"} role="status">{message}</p>}
    {sandboxLink && <div className="policy-box"><strong>Sandbox activation delivery</strong><p className="muted">Share this single-use link with the invited person. The raw token is not shown as the primary workflow.</p><button className="btn btn-ghost" type="button" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${sandboxLink}`)}>Copy activation link</button> <a href={sandboxLink}>Open activation</a></div>}
    {query.isError ? <div className="error-panel" role="alert">
      {(query.error as Error)?.message
        ? <>{(query.error as Error).message} <button className="text-button" type="button" onClick={() => void query.refetch()}>Try again</button></>
        : <>Could not load {title.toLowerCase()}. <button className="text-button" type="button" onClick={() => void query.refetch()}>Try again</button></>}
    </div> : query.isPending ? <p className="muted">Loading {title.toLowerCase()}…</p> : rows.length === 0 ? <div className="empty-state"><p className="muted">No {title.toLowerCase()} match the current filters.</p></div> : <>
      <div className="table-wrap"><DataTable rows={visibleRows} columns={cols} onRowClick={selectRow} /></div>
      {pageSize && pageCount > 1 && <nav className="table-pagination" aria-label={`${title} pagination`}>
        <span>Page {currentPage} of {pageCount}</span>
        <div>
          <button className="btn btn-ghost" type="button" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>Previous</button>
          <button className="btn btn-ghost" type="button" disabled={currentPage === pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))}>Next</button>
        </div>
      </nav>}
    </>}

    <DrawerReview open={Boolean(selected)} title={selected ? `${title} detail` : title} onClose={() => setSelected(null)}>
      {selected && <div className="detail-panel">
        {selected.status && <StatusBadge status={selected.status} />}
        <dl className="detail-list">{Object.entries(selected)
          .filter(([key]) => !hiddenKeys.has(key) && !key.endsWith("Id") && key !== "id" && key !== "organizationId" && key !== "coding" && typeof selected[key] !== "object")
          .map(([key, value]) => <div key={key}><dt>{labelForKey(key)}</dt><dd>{displayValue(key, value, selected, labels)}</dd></div>)}</dl>
        <details className="system-info">
          <summary>System information</summary>
          <dl className="detail-list muted">{Object.entries(selected)
            .filter(([key]) => !hiddenKeys.has(key) && (key.endsWith("Id") || key === "id" || key === "organizationId" || typeof selected[key] === "object"))
            .map(([key, value]) => <div key={key}><dt>{labelForKey(key)}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : displayValue(key, value, selected, labels)}</dd></div>)}</dl>
        </details>
        {path === "accounting" && ["NEEDS_REVIEW", "SYNC_ERROR", "READY_TO_SYNC"].includes(selected.status ?? "") && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("accounting.code")) && <form className="record-form" onSubmit={(event) => { event.preventDefault(); codeAccounting.mutate({ id: selected.id, draft: accountingDraft }); }}>
          <h3>Accounting coding</h3>
          <label>Category<input className="input" value={accountingDraft.category} onChange={(event) => setAccountingDraft({ ...accountingDraft, category: event.target.value })} maxLength={120} /></label>
          <label>GL account<input className="input" value={accountingDraft.glAccount} onChange={(event) => setAccountingDraft({ ...accountingDraft, glAccount: event.target.value })} maxLength={120} /></label>
          <label>Department<input className="input" value={accountingDraft.department} onChange={(event) => setAccountingDraft({ ...accountingDraft, department: event.target.value })} maxLength={120} /></label>
          <label>Memo<input className="input" value={accountingDraft.memo} onChange={(event) => setAccountingDraft({ ...accountingDraft, memo: event.target.value })} maxLength={500} /></label>
          {codeAccounting.isError && <p className="error" role="alert">{codeAccounting.error.message}</p>}
          <button className="btn btn-primary" type="submit" disabled={codeAccounting.isPending}>{codeAccounting.isPending ? "Saving…" : "Save coding"}</button>
        </form>}
        {action.isError && <p className="error" role="alert">{action.error.message}</p>}
        {permittedActions.length > 0 && <div className="detail-actions">{permittedActions.filter((item) => actionApplies(item.name, selected)).map((item) => <button key={item.name} className={`btn ${item.name === "terminate" ? "btn-danger" : "btn-primary"}`} type="button" disabled={action.isPending || (item.name === "approve" && (selected.requesterId === session?.userId || selected.travelerId === session?.userId))} onClick={() => runAction(item, selected)}>{item.label}</button>)}</div>}
      </div>}
    </DrawerReview>

    <DrawerReview open={creating} title={config?.createLabel ?? `New ${title}`} onClose={() => setCreating(false)}>
      <form className="record-form" onSubmit={submitCreate}>
        {fields.map((field) => <label key={field.key}>{field.label}{field.required ? " *" : ""}
          {field.type === "select" ? <select className="input" value={values[field.key] ?? ""} required={field.required} disabled={formOptionsLoading} aria-busy={formOptionsLoading} onChange={(event) => updateValue(field.key, event.target.value)}>
            <option value="">{formOptionsLoading ? "Loading options…" : `Select ${field.label.toLowerCase()}`}</option>
            {fieldOptions(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <input className="input" type={field.type ?? "text"} min={field.type === "number" ? "0.01" : undefined} step={field.type === "number" ? "0.01" : undefined} value={values[field.key] ?? ""} required={field.required} onChange={(event) => updateValue(field.key, event.target.value)} />}
        </label>)}
        {optionsQuery.isError && <p className="error">Could not load form options.</p>}
        {create.isError && <p className="error" role="alert">{create.error.message}</p>}
        <button className="btn btn-primary" type="submit" disabled={create.isPending || optionsQuery.isPending && sourcePaths.length > 0}>{create.isPending ? "Saving…" : "Create"}</button>
      </form>
    </DrawerReview>
    <DrawerReview open={Boolean(editing)} title={`Edit ${title}`} onClose={() => setEditing(null)}><form className="record-form" onSubmit={(event) => { event.preventDefault(); if (editing) update.mutate({ id: editing.id, body: editValues }); }}>{fields.map((field) => <label key={field.key}>{field.label}{field.type === "select" ? <select className="input" value={editValues[field.key] ?? ""} onChange={(event) => setEditValues({ ...editValues, [field.key]: event.target.value })}>{fieldOptions(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input className="input" type={field.type ?? "text"} value={editValues[field.key] ?? ""} onChange={(event) => setEditValues({ ...editValues, [field.key]: event.target.value })} />}</label>)}{update.isError && <p className="error">{update.error.message}</p>}<button className="btn btn-primary" disabled={update.isPending}>Save changes</button></form></DrawerReview>
  </div>;
}
