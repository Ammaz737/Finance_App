"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  request: {
    id: string;
    name: string;
    amount: string | number;
    currency: string;
    status: string;
    outcomeType: string;
    outcomeId: string | null;
    approvalProgress: string;
    requesterId: string;
    memo: string;
    formAnswers: { lines?: Array<{ description: string; amount: string }> } | null;
  };
  program: { name: string } | null;
  vendor: { id?: string; name: string } | null;
  requester: { firstName: string; lastName: string; email: string } | null;
  purchaseOrder: { id: string; number: string; status: string } | null;
  approval: { status: string; currentStep: number } | null;
  approvalProgress: Array<{ label: string; status: string }>;
  approvalLabel: string;
  policy: {
    result: string | null;
    reason: string | null;
    matchedRules: unknown;
    requiredActions: unknown;
    version: number | null;
    evaluatedAt: string | null;
  };
  timeline: Array<{ id: string; action: string; createdAt: string }>;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

function outcomeLabel(value?: string) {
  if (value === "VIRTUAL_CARD") return "Virtual card";
  if (value === "VENDOR_SETUP") return "Vendor setup";
  if (value === "PURCHASE_ORDER") return "Purchase order";
  return value || "—";
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
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load request.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading request…</p>;

  const { request, program, vendor, requester, purchaseOrder, approvalProgress, approvalLabel, policy, timeline } =
    detail.data;
  const isOwner =
    session?.userId === request.requesterId ||
    session?.roles.includes("Owner") ||
    session?.permissions.includes("*");
  const canSubmit = request.status === "DRAFT" && Boolean(isOwner);
  const canApprove =
    request.status === "IN_REVIEW" &&
    Boolean(
      session?.roles.includes("Owner") ||
        session?.permissions.includes("*") ||
        session?.permissions.includes("procurement.review"),
    ) &&
    session?.userId !== request.requesterId;

  const canSeeRequests = session
    ? canSeeItem(
        findNavItem("/app/procurement/requests") ?? {
          href: "/app/procurement/requests",
          permission: "procurement.request",
        },
        session,
      )
    : false;
  const canSeePos = session
    ? canSeeItem(
        findNavItem("/app/procurement/purchase-orders") ?? {
          href: "/app/procurement/purchase-orders",
          permission: "procurement.review",
        },
        session,
      )
    : false;
  const canSeeVendors = session
    ? canSeeItem(findNavItem("/app/vendors") ?? { href: "/app/vendors", permission: "vendor.read" }, session)
    : false;
  const canSeePrograms = session
    ? canSeeItem(
        findNavItem("/app/procurement/programs") ?? {
          href: "/app/procurement/programs",
          permission: "procurement.review",
        },
        session,
      )
    : false;

  const backHref = canSeeRequests ? "/app/procurement/requests" : canSeePos ? "/app/procurement/purchase-orders" : "/app/home";
  const backLabel =
    backHref === "/app/procurement/requests"
      ? "Back to requests"
      : backHref === "/app/procurement/purchase-orders"
        ? "Back to purchase orders"
        : "Back to overview";

  const poHref = purchaseOrder && canSeePos ? `/app/procurement/purchase-orders/${purchaseOrder.id}` : null;
  const vendorHref = vendor?.id && canSeeVendors ? `/app/vendors/${vendor.id}` : null;
  const approvedSteps = approvalProgress.filter((step) => step.status === "Approved").length;

  return (
    <div className="detail-page procurement-detail-page">
      <div className="resource-heading">
        <PageHeader
          title={request.name}
          subtitle={`${requester ? `${requester.firstName} ${requester.lastName}` : "Requester"} · ${money(request.currency, request.amount)}`}
        />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {run.isError && (
        <p className="error" role="alert">
          {run.error.message}
        </p>
      )}

      <div className="overview-stat-grid">
        <article className="overview-stat">
          <span>Status</span>
          <strong>
            <StatusBadge status={request.status} />
          </strong>
          <small>{approvalLabel || "—"}</small>
        </article>
        <article className="overview-stat">
          <span>Outcome</span>
          <strong>{outcomeLabel(request.outcomeType)}</strong>
          <small>{request.outcomeId ? `Ref ${request.outcomeId.slice(0, 12)}` : "After final approval only"}</small>
        </article>
        {poHref ? (
          <Link href={poHref} className="overview-stat">
            <span>Purchase order</span>
            <strong>{purchaseOrder!.number}</strong>
            <small>
              <StatusBadge status={purchaseOrder!.status} /> · Open →
            </small>
          </Link>
        ) : (
          <article className="overview-stat">
            <span>Purchase order</span>
            <strong>{purchaseOrder ? purchaseOrder.number : "None"}</strong>
            <small>{purchaseOrder ? <StatusBadge status={purchaseOrder.status} /> : "Not before final approve"}</small>
          </article>
        )}
        <article className="overview-stat">
          <span>Policy</span>
          <strong>{policy.result ?? "—"}</strong>
          <small>{policy.reason || "Evaluated on submit"}</small>
        </article>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Overview</h2>
          <dl className="detail-list">
            <div>
              <dt>Program</dt>
              <dd>
                {program?.name ?? "—"}
                {canSeePrograms && (
                  <>
                    {" "}
                    <Link className="detail-link" href="/app/procurement/programs">
                      Programs →
                    </Link>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Vendor</dt>
              <dd>
                {vendor ? (
                  vendorHref ? (
                    <Link className="detail-link" href={vendorHref}>
                      {vendor.name} →
                    </Link>
                  ) : (
                    vendor.name
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Business purpose</dt>
              <dd>{request.memo || "—"}</dd>
            </div>
          </dl>
          <h3>Lines</h3>
          <ul className="plain-list">
            {(request.formAnswers?.lines ?? []).map((line, index) => (
              <li key={`${line.description}-${index}`}>
                {line.description} — {money(request.currency, line.amount)}
              </li>
            ))}
            {!request.formAnswers?.lines?.length && <li className="muted">Single-line request amount.</li>}
          </ul>
          <div className="detail-actions">
            {canSubmit && (
              <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("submit")}>
                Submit
              </button>
            )}
            {canApprove && (
              <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("approve")}>
                Approve
              </button>
            )}
            {poHref && (
              <Link className="btn btn-ghost" href={poHref}>
                Open PO
              </Link>
            )}
          </div>
          {canApprove && (
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              Reject or request info from{" "}
              <Link className="detail-link" href="/app/inbox">
                Inbox
              </Link>
              .
            </p>
          )}
        </section>

        <section className="panel">
          <h2>Approvals</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {approvedSteps} of {approvalProgress.length || 0} approvals completed
          </p>
          <ul className="plain-list detail-checklist">
            {approvalProgress.map((step) => (
              <li key={`${step.label}-${step.status}`}>
                <span>{step.label}</span>
                <StatusBadge status={step.status} />
              </li>
            ))}
            {!approvalProgress.length && <li className="muted">No approval steps yet.</li>}
          </ul>
        </section>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Policy</h2>
          <dl className="detail-list">
            <div>
              <dt>Result</dt>
              <dd>{policy.result ?? "—"}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{policy.reason || "—"}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{policy.version ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Activity</h2>
          <div className="timeline">
            {timeline.map((event) => (
              <div key={event.id} className="timeline-item">
                <strong>{event.action}</strong>
                <div className="muted">{new Date(event.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {!timeline.length && <p className="muted">No activity yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
