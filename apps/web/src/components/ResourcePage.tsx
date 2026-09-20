"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState, type FormEvent } from "react";
import { DataTable, DrawerReview, PageHeader, StatusBadge, type Column } from "@finance/design-system";
import { api } from "@/lib/api";
import { actionPermissions, createPermissions, labelForKey, resourceConfig, type FieldConfig } from "@/config/resource-config";
import { useSession } from "@/providers/session-provider";

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

export function ResourcePage({ title, path, columns, actions = [], mineField, filter, predicate, onRowNavigate }: {
  title: string;
  path: string;
  columns?: Column<Row>[];
  actions?: Action[];
  mineField?: string;
  filter?: Record<string, string[]>;
  predicate?: (row: Row) => boolean;
  onRowNavigate?: (row: Row) => void;
}) {
  const session = useSession();
  const queryClient = useQueryClient();
  const config = resourceConfig[path];
  const fields = config?.fields ?? [];
  const [selected, setSelected] = useState<Row | null>(null);
  const [accountingDraft, setAccountingDraft] = useState({ category: "", memo: "", glAccount: "", department: "" });
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
  const [createKey, setCreateKey] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState("ALL");
  const [message, setMessage] = useState("");
  const [viewName, setViewName] = useState("");

  const query = useQuery({
    queryKey: ["resource", path, deferredSearch],
    queryFn: () => api.get<Row[]>(`/${path}${deferredSearch ? `?q=${encodeURIComponent(deferredSearch)}` : ""}`),
  });
  const savedViews = useQuery({
    queryKey: ["saved-views", path],
    queryFn: () => api.get<Array<{ id: string; name: string; filters: { status?: string } }>>(`/saved-views?resource=${encodeURIComponent(path)}`),
  });
  const saveView = useMutation({
    mutationFn: () => api.post("/saved-views", {
      resource: path,
      name: viewName.trim() || `${title} ${status}`,
      filters: { status },
      columns: config?.columns ?? [],
    }),
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
    queryFn: async () => Object.fromEntries(await Promise.all(sourcePaths.map(async (source) => [source, await api.get<Row[]>(`/${source}`)] as const))),
    enabled: creating && sourcePaths.length > 0,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, string>) => api.post<Row>(`/${path}`, path === "payments" ? { ...body, idempotencyKey: createKey } : body),
    onSuccess: (created) => {
      setCreating(false);
      setValues(initialValues(fields));
      setCreateKey("");
      const token = typeof created?.activationToken === "string" ? created.activationToken : "";
      setMessage(token
        ? `${title} invited. One-time activation token (copy now): ${token}`
        : `${title} record created.`);
      void queryClient.invalidateQueries({ queryKey: ["resource", path] });
    },
  });
  const action = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.post<Row>(`/${path}/${id}/${name}`, {}),
    onSuccess: (result, variables) => {
      const token = typeof result?.activationToken === "string" ? result.activationToken : "";
      setMessage(token
        ? `${variables.name} completed. One-time activation token (copy now): ${token}`
        : `${variables.name} completed.`);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["resource", path] });
    },
  });
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
  const rows = status === "ALL" ? searchedRows : searchedRows.filter((row) => row.status === status);
  const permittedActions = actions.filter((item) => {
    const permission = actionPermissions[path]?.[item.name];
    return !permission || session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes(permission);
  });
  const keys = config?.columns ?? ["name", "status", "createdAt"];
  const cols: Column<Row>[] = columns ?? keys.map((key) => ({
    key,
    header: labelForKey(key),
    render: (row: Row) => displayValue(key, row[key], row, labels),
  }));
  const createPermission = createPermissions[path];
  const canCreate = Boolean(config?.createLabel) && (!createPermission || session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes(createPermission)) && (path !== "people" || session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("roles.assign"));

  function fieldOptions(field: FieldConfig) {
    if (field.options) return field.options;
    const items = optionsQuery.data?.[field.source?.path ?? ""] ?? [];
    return items.filter((item) =>
      (!field.source?.entityField || !values.legalEntityId || item[field.source.entityField] === values.legalEntityId) &&
      (!field.source?.statuses || field.source.statuses.includes(String(item.status))),
    ).map((item) => ({ value: item.id, label: String(item[field.source?.labelKey ?? "name"] ?? item.id) }));
  }

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
    const invalidAmount = fields.find((field) => field.type === "number" && (!Number.isFinite(Number(values[field.key])) || Number(values[field.key]) <= 0));
    if (invalidAmount) {
      setMessage(`${invalidAmount.label} must be greater than zero.`);
      return;
    }
    create.mutate(values);
  }

  function runAction(item: Action, row: Row) {
    if (["release", "terminate", "freeze"].includes(item.name) && !window.confirm(`Confirm ${item.label.toLowerCase()} for this record?`)) return;
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

  function actionApplies(name: string, row: Row) {
    const states: Record<string, string[]> = {
      "bills.submit": ["DRAFT"], "bills.approve": ["PENDING_APPROVAL"],
      "payments.release": ["SCHEDULED"], "payments.confirm-settlement": ["PROCESSING"],
      "payment-runs.release": ["OPEN"],
      "procurement.submit": ["DRAFT"], "procurement.approve": ["IN_REVIEW"],
      "purchase-orders.receive": ["OPEN", "PARTIALLY_RECEIVED"],
      "purchase-orders.match": ["OPEN", "PARTIALLY_RECEIVED", "RECEIVED"],
      "travel.submit": ["DRAFT"], "travel.approve": ["PENDING_APPROVAL"],
      "expenses.submit": ["DRAFT", "INCOMPLETE"], "expenses.approve": ["SUBMITTED", "IN_REVIEW"],
      "reimbursements.approve": ["IN_REVIEW"],
      "reimbursements.schedule": ["APPROVED"],
      "reimbursements.confirm-payout": ["SCHEDULED"],
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
    <div className="resource-toolbar">
      <label className="search-field"><span className="sr-only">Search {title}</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} /></label>
      {statuses.length > 1 && <select className="input status-filter" aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>}
      {(savedViews.data?.length ?? 0) > 0 && (
        <select className="input status-filter" aria-label="Saved views" defaultValue="" onChange={(event) => {
          const view = savedViews.data?.find((item) => item.id === event.target.value);
          if (view?.filters?.status) setStatus(view.filters.status);
        }}>
          <option value="">Saved views</option>
          {(savedViews.data ?? []).map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select>
      )}
      <label className="sr-only" htmlFor={`save-view-${path}`}>Saved view name</label>
      <input id={`save-view-${path}`} className="input" style={{ maxWidth: 160 }} value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Save view name" />
      <button type="button" className="btn btn-ghost" disabled={saveView.isPending || status === "ALL" && !viewName.trim()} onClick={() => saveView.mutate()}>Save view</button>
      <span className="record-count">{rows.length} records</span>
    </div>
    {message && <p className={message.includes("created") || message.includes("completed") ? "notice" : "error"} role="status">{message}</p>}
    {query.isError ? <div className="error-panel">Could not load {title.toLowerCase()}. <button className="text-button" onClick={() => void query.refetch()}>Try again</button></div> : query.isPending ? <p className="muted">Loading {title.toLowerCase()}…</p> : <div className="table-wrap"><DataTable rows={rows} columns={cols} onRowClick={selectRow} /></div>}

    <DrawerReview open={Boolean(selected)} title={selected ? `${title} detail` : title} onClose={() => setSelected(null)}>
      {selected && <div className="detail-panel">
        {selected.status && <StatusBadge status={selected.status} />}
        <dl className="detail-list">{Object.entries(selected).filter(([key]) => !hiddenKeys.has(key)).map(([key, value]) => <div key={key}><dt>{labelForKey(key)}</dt><dd>{displayValue(key, value, selected, labels)}</dd></div>)}</dl>
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
        {permittedActions.length > 0 && <div className="detail-actions">{permittedActions.filter((item) => actionApplies(item.name, selected)).map((item) => <button key={item.name} className={`btn ${item.name === "terminate" ? "btn-danger" : "btn-primary"}`} type="button" disabled={action.isPending || (item.name === "approve" && selected.requesterId === session?.userId)} onClick={() => runAction(item, selected)}>{item.label}</button>)}</div>}
      </div>}
    </DrawerReview>

    <DrawerReview open={creating} title={config?.createLabel ?? `New ${title}`} onClose={() => setCreating(false)}>
      <form className="record-form" onSubmit={submitCreate}>
        {fields.map((field) => <label key={field.key}>{field.label}{field.required ? " *" : ""}
          {field.type === "select" ? <select className="input" value={values[field.key] ?? ""} required={field.required} onChange={(event) => updateValue(field.key, event.target.value)}>
            <option value="">Select {field.label.toLowerCase()}</option>
            {fieldOptions(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <input className="input" type={field.type ?? "text"} min={field.type === "number" ? "0.01" : undefined} step={field.type === "number" ? "0.01" : undefined} value={values[field.key] ?? ""} required={field.required} onChange={(event) => updateValue(field.key, event.target.value)} />}
        </label>)}
        {optionsQuery.isError && <p className="error">Could not load form options.</p>}
        {create.isError && <p className="error" role="alert">{create.error.message}</p>}
        <button className="btn btn-primary" type="submit" disabled={create.isPending || optionsQuery.isPending && sourcePaths.length > 0}>{create.isPending ? "Saving…" : "Create"}</button>
      </form>
    </DrawerReview>
  </div>;
}
