"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Program = {
  id: string;
  name: string;
  description: string;
  maxAmount: string | number;
  currency: string;
  status: string;
  legalEntityId: string;
  budgetId?: string | null;
  defaultFulfillmentType?: string;
  defaultValidDays?: number | null;
  merchantLockDefault?: string | null;
  allowedMccsDefault?: string | null;
  perTransactionLimitDefault?: string | number | null;
  velocityMaxAmountDefault?: string | number | null;
  velocityMaxCountDefault?: number | null;
};

type Named = { id: string; name?: string };
type RequestRow = {
  id: string;
  name?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  programId?: string;
  createdAt?: string;
};

function money(currency: string, value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

function hasPerm(session: { roles: string[]; permissions: string[] } | null | undefined, permission: string) {
  if (!session) return false;
  return session.roles.includes("Owner") || session.permissions.includes("*") || session.permissions.includes(permission);
}

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    maxAmount: "",
    currency: "USD",
    merchantLockDefault: "",
    allowedMccsDefault: "",
    perTransactionLimitDefault: "",
    velocityMaxAmountDefault: "",
    velocityMaxCountDefault: "",
  });
  const [message, setMessage] = useState("");

  const detail = useQuery({
    queryKey: ["program", id],
    queryFn: () => api.get<Program>(`/spend-programs/${id}`),
  });

  const entities = useQuery({
    queryKey: ["program-entities"],
    queryFn: () => api.get<Named[]>("/entities"),
    enabled: Boolean(detail.data?.legalEntityId),
  });

  const budgets = useQuery({
    queryKey: ["program-budgets"],
    queryFn: () => api.get<Named[]>("/budgets"),
    enabled: Boolean(detail.data?.budgetId) && (hasPerm(session, "report.read") || hasPerm(session, "budget.manage")),
  });

  const canListRequests = hasPerm(session, "spend_request.approve") || hasPerm(session, "spend_request.create");
  const requests = useQuery({
    queryKey: ["program-requests", id],
    queryFn: () => api.get<RequestRow[]>("/spend-requests"),
    enabled: canListRequests && Boolean(id),
  });

  useEffect(() => {
    if (!detail.data) return;
    setForm({
      name: detail.data.name,
      description: detail.data.description ?? "",
      maxAmount: String(detail.data.maxAmount),
      currency: detail.data.currency,
      merchantLockDefault: detail.data.merchantLockDefault ?? "",
      allowedMccsDefault: detail.data.allowedMccsDefault ?? "",
      perTransactionLimitDefault: detail.data.perTransactionLimitDefault != null ? String(detail.data.perTransactionLimitDefault) : "",
      velocityMaxAmountDefault: detail.data.velocityMaxAmountDefault != null ? String(detail.data.velocityMaxAmountDefault) : "",
      velocityMaxCountDefault: detail.data.velocityMaxCountDefault != null ? String(detail.data.velocityMaxCountDefault) : "",
    });
  }, [detail.data]);

  const action = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: object }) => api.post(`/spend-programs/${id}/${name}`, body ?? {}),
    onSuccess: (_result, input) => {
      setMessage(input.name === "deactivate" ? "Program deactivated. It will no longer appear for new requests." : "Changes saved.");
      void client.invalidateQueries({ queryKey: ["program", id] });
      void client.invalidateQueries({ queryKey: ["resource", "spend-programs"] });
      void client.invalidateQueries({ queryKey: ["program-requests", id] });
    },
  });

  const canManage = hasPerm(session, "spend_program.manage");
  const canSeeBudgets = session
    ? canSeeItem(findNavItem("/app/insights/budgets") ?? { href: "/app/insights/budgets", permission: "report.read" }, session)
    : false;
  const canSeeCompanyRequests = session
    ? canSeeItem(findNavItem("/app/spend/requests") ?? { href: "/app/spend/requests", permission: "spend_request.approve" }, session)
    : false;
  const backHref = canManage
    ? "/app/spend/programs"
    : canSeeCompanyRequests
      ? "/app/spend/requests"
      : "/app/me/requests";
  const backLabel = canManage
    ? "Back to spend programs"
    : canSeeCompanyRequests
      ? "Back to spend requests"
      : "Back to my requests";

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load spend program.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading program…</p>;

  const program = detail.data;
  const entityName = entities.data?.find((item) => item.id === program.legalEntityId)?.name ?? program.legalEntityId.slice(0, 8);
  const budgetName = program.budgetId
    ? (budgets.data?.find((item) => item.id === program.budgetId)?.name ?? program.budgetId.slice(0, 8))
    : null;
  const linkedRequests = (requests.data ?? [])
    .filter((row) => row.programId === program.id)
    .slice(0, 8);
  const isActive = program.status === "ACTIVE";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !isActive) return;
    const max = Number(form.maxAmount);
    if (!form.name.trim()) {
      setMessage("Program name is required.");
      return;
    }
    if (!Number.isFinite(max) || max <= 0) {
      setMessage("Maximum request amount must be greater than zero.");
      return;
    }
    setMessage("");
    action.mutate({
      name: "update",
      body: {
        name: form.name.trim(),
        description: form.description,
        maxAmount: form.maxAmount,
        currency: form.currency,
        merchantLockDefault: form.merchantLockDefault || undefined,
        allowedMccsDefault: form.allowedMccsDefault || undefined,
        perTransactionLimitDefault: form.perTransactionLimitDefault || undefined,
        velocityMaxAmountDefault: form.velocityMaxAmountDefault || undefined,
        velocityMaxCountDefault: form.velocityMaxCountDefault ? Number(form.velocityMaxCountDefault) : undefined,
      },
    });
  }

  return (
    <div className="spend-detail">
      <div className="resource-heading">
        <PageHeader
          title={program.name}
          subtitle={`${money(program.currency, program.maxAmount)} max · ${program.defaultFulfillmentType === "FUND_ONLY" ? "Fund only" : "Virtual card"}`}
        />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      {message && (
        <p className={message.includes("required") || message.includes("must be") ? "error" : "notice"} role="status">
          {message}
        </p>
      )}
      {action.isError && (
        <p className="error" role="alert">
          {action.error.message}
        </p>
      )}

      <div className="kpi-grid">
        <article className="kpi-card">
          <span>Status</span>
          <strong>
            <StatusBadge status={program.status} />
          </strong>
          <small>{isActive ? "Available for new requests" : "Hidden from new requests"}</small>
        </article>
        <article className="kpi-card">
          <span>Max request</span>
          <strong>{money(program.currency, program.maxAmount)}</strong>
          <small>{entityName}</small>
        </article>
        <article className="kpi-card">
          <span>Fulfillment</span>
          <strong>{program.defaultFulfillmentType === "FUND_ONLY" ? "Fund only" : "Virtual card"}</strong>
          <small>{program.defaultValidDays != null ? `${program.defaultValidDays} day validity` : "No default expiry"}</small>
        </article>
      </div>

      <div className="work-panels">
        <section className="work-panel">
          <h2>Program details</h2>
          <dl className="detail-list">
            <div>
              <dt>Legal entity</dt>
              <dd>{entityName}</dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>
                {program.budgetId && budgetName ? (
                  canSeeBudgets ? (
                    <Link className="detail-link" href={`/app/insights/budgets/${program.budgetId}`}>
                      {budgetName}
                    </Link>
                  ) : (
                    budgetName
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{program.description?.trim() || "—"}</dd>
            </div>
            <div>
              <dt>Merchant lock</dt>
              <dd>{program.merchantLockDefault || "—"}</dd>
            </div>
            <div>
              <dt>Allowed MCCs</dt>
              <dd>{program.allowedMccsDefault || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="work-panel">
          <h2>Recent requests</h2>
          {!canListRequests ? (
            <p className="muted">You do not have permission to list spend requests.</p>
          ) : requests.isPending ? (
            <p className="muted">Loading requests…</p>
          ) : linkedRequests.length ? (
            <ul className="plain-list">
              {linkedRequests.map((row) => (
                <li key={row.id}>
                  <Link className="detail-link" href={`/app/spend/requests/${row.id}?from=queue`}>
                    {row.name || "Spend request"}
                  </Link>{" "}
                  · {money(row.currency ?? program.currency, row.amount)} · <StatusBadge status={row.status ?? "UNKNOWN"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No spend requests use this program yet.</p>
          )}
          {canSeeCompanyRequests && (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              <Link className="detail-link" href="/app/spend/requests">
                All spend requests →
              </Link>
            </p>
          )}
        </section>
      </div>

      {canManage && isActive && (
        <section className="work-panel">
          <h2>Edit controls</h2>
          <p className="muted">Currency cannot change after create. Lowering the max is blocked if an active fund already exceeds it.</p>
          <form className="record-form" onSubmit={submit}>
            <label>
              Program name
              <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={120} required />
            </label>
            <label>
              Description
              <input className="input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={500} />
            </label>
            <label>
              Maximum request amount
              <input className="input" type="number" min="0.01" step="0.01" value={form.maxAmount} onChange={(event) => setForm({ ...form, maxAmount: event.target.value })} required />
            </label>
            <label>
              Currency
              <input className="input" value={form.currency} disabled />
            </label>
            <label>
              Default merchant lock
              <input className="input" value={form.merchantLockDefault} onChange={(event) => setForm({ ...form, merchantLockDefault: event.target.value })} maxLength={120} placeholder="Optional" />
            </label>
            <label>
              Default allowed MCCs
              <input className="input" value={form.allowedMccsDefault} onChange={(event) => setForm({ ...form, allowedMccsDefault: event.target.value })} maxLength={200} placeholder="Comma-separated" />
            </label>
            <label>
              Default per-transaction limit
              <input className="input" type="number" min="0.01" step="0.01" value={form.perTransactionLimitDefault} onChange={(event) => setForm({ ...form, perTransactionLimitDefault: event.target.value })} />
            </label>
            <label>
              Default velocity max amount
              <input className="input" type="number" min="0.01" step="0.01" value={form.velocityMaxAmountDefault} onChange={(event) => setForm({ ...form, velocityMaxAmountDefault: event.target.value })} />
            </label>
            <label>
              Default velocity max count
              <input className="input" type="number" min="1" step="1" value={form.velocityMaxCountDefault} onChange={(event) => setForm({ ...form, velocityMaxCountDefault: event.target.value })} />
            </label>
            <div className="detail-actions">
              <button className="btn btn-primary" type="submit" disabled={action.isPending}>
                {action.isPending ? "Saving…" : "Save changes"}
              </button>
              <button
                className="btn btn-danger"
                type="button"
                disabled={action.isPending}
                onClick={() => {
                  if (window.confirm("Deactivate this spend program? Employees will no longer be able to select it for new requests.")) {
                    action.mutate({ name: "deactivate" });
                  }
                }}
              >
                Deactivate
              </button>
            </div>
          </form>
        </section>
      )}

      {canManage && !isActive && (
        <p className="muted">This program is inactive. Create a new program if you need to reopen these controls.</p>
      )}

      {!canManage && (
        <p className="muted">You can view this program. Editing requires spend program manage permission.</p>
      )}
    </div>
  );
}
