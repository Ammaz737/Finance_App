"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  request: {
    id: string;
    name: string;
    purpose: string;
    amount: string | number;
    currency: string;
    status: string;
    fulfillmentType: string;
    recurrence: string;
    category: string;
    comments: string;
    policyResult: string;
    policyReason: string;
    createdAt: string;
    requesterId?: string;
  };
  program: { id: string; name: string } | null;
  requester: { id?: string; firstName: string; lastName: string; email: string } | null;
  vendor: { id: string; name: string } | null;
  entity: { id: string; name: string } | null;
  fund: {
    id: string;
    name: string;
    availableAmount: string | number;
    limitAmount: string | number;
    currency: string;
  } | null;
  card: { id: string; last4: string; status: string; holderId?: string; provider?: string } | null;
  approval: { status: string; infoRequestComment: string; infoRequestedAt: string | null } | null;
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

function recurrenceLabel(value: string) {
  if (value === "NONE" || !value) return "One-time";
  return value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function SpendRequestDetailPage() {
  return (
    <Suspense fallback={<p className="muted">Loading request…</p>}>
      <SpendRequestDetailInner />
    </Suspense>
  );
}

function SpendRequestDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"notice" | "error">("notice");

  const detail = useQuery({
    queryKey: ["spend-request", params.id],
    queryFn: () => api.get<Detail>(`/spend-requests/${params.id}`),
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/spend-requests/${params.id}/approve`, {}),
    onSuccess: () => {
      setMessageTone("notice");
      setMessage("Approval recorded. Fulfillment appears after the final approval step.");
      void queryClient.invalidateQueries({ queryKey: ["spend-request", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "spend-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["my-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-overview"] });
    },
    onError: (error: Error) => {
      setMessageTone("error");
      setMessage(error.message);
    },
  });

  if (detail.isPending) return <p className="muted">Loading request…</p>;
  if (detail.isError || !detail.data) {
    return (
      <div className="error-panel" role="alert">
        Could not load spend request.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const data = detail.data;
  const req = data.request;
  const informationRequested = data.approval?.status === "INFO_REQUESTED";
  const isRequester = Boolean(
    session &&
      (session.userId === req.requesterId ||
        session.userId === data.requester?.id ||
        (data.requester?.email && session.user.email === data.requester.email)),
  );
  const canApprovePerm = Boolean(
    session &&
      (session.permissions.includes("*") ||
        session.permissions.includes("spend_request.approve") ||
        session.roles.includes("Owner")),
  );
  const canApprove =
    canApprovePerm &&
    !isRequester &&
    ["IN_REVIEW", "SUBMITTED"].includes(req.status);
  const canCreate = Boolean(
    session &&
      (session.permissions.includes("*") ||
        session.permissions.includes("spend_request.create") ||
        session.roles.includes("Owner")),
  );

  const from = searchParams.get("from");
  const canSeeQueue = session
    ? canSeeItem(findNavItem("/app/spend/requests") ?? { href: "/app/spend/requests", permission: "spend_request.approve" }, session)
    : false;
  const canSeeMine = session
    ? canSeeItem(findNavItem("/app/me/requests") ?? { href: "/app/me/requests", permission: "spend_request.create" }, session)
    : false;
  const canSeePrograms = session
    ? canSeeItem(findNavItem("/app/spend/programs") ?? { href: "/app/spend/programs", permission: "spend_program.manage" }, session)
    : false;
  const canSeeVendors = session
    ? canSeeItem(findNavItem("/app/vendors") ?? { href: "/app/vendors", permission: "vendor.read" }, session)
    : false;
  const canSeeCorporateCards = session
    ? canSeeItem(findNavItem("/app/cards") ?? { href: "/app/cards", permission: "card.issue" }, session)
    : false;
  const canSeeFunds = session
    ? canSeeItem(findNavItem("/app/spend/funds") ?? { href: "/app/spend/funds", permission: "card.read" }, session)
    : false;

  let backHref = "/app/spend/requests";
  let backLabel = "Back to spend requests";
  if (from === "mine" && canSeeMine) {
    backHref = "/app/me/requests";
    backLabel = "Back to my requests";
  } else if (from === "queue" && canSeeQueue) {
    backHref = "/app/spend/requests";
    backLabel = "Back to spend requests";
  } else if (isRequester || (canCreate && !canApprovePerm)) {
    backHref = canSeeMine ? "/app/me/requests" : "/app/home";
    backLabel = canSeeMine ? "Back to my requests" : "Back to overview";
  } else if (canSeeQueue) {
    backHref = "/app/spend/requests";
    backLabel = "Back to spend requests";
  } else if (canSeeMine) {
    backHref = "/app/me/requests";
    backLabel = "Back to my requests";
  } else {
    backHref = "/app/inbox";
    backLabel = "Back to inbox";
  }

  const cardHref = data.card
    ? isRequester || !canSeeCorporateCards
      ? `/app/me/cards/${data.card.id}`
      : `/app/cards/${data.card.id}`
    : null;
  const fundHref = data.fund && canSeeFunds ? `/app/spend/funds/${data.fund.id}` : null;
  const requesterName = data.requester
    ? `${data.requester.firstName} ${data.requester.lastName}`.trim() || data.requester.email
    : "Requester";

  return (
    <div className="spend-detail spend-request-detail">
      <div className="resource-heading">
        <PageHeader
          title={req.name}
          subtitle={`${requesterName} · ${money(req.currency, req.amount)}`}
        />
        <div className="detail-actions-top">
          <Link className="btn btn-ghost" href={backHref}>
            {backLabel}
          </Link>
          {canApprove && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
            >
              {informationRequested ? "Approve request" : approve.isPending ? "Approving…" : "Approve"}
            </button>
          )}
        </div>
      </div>

      {message ? (
        <p className={messageTone === "error" ? "error" : "notice"} role="status">
          {message}
        </p>
      ) : null}

      {isRequester && canApprovePerm && ["IN_REVIEW", "SUBMITTED"].includes(req.status) && (
        <p className="muted" role="note">
          You cannot approve your own request (separation of duties). Another eligible approver must decide.
        </p>
      )}

      {informationRequested ? (
        <section className="work-panel" aria-live="polite">
          <div className="resource-heading">
            <h2 style={{ margin: 0 }}>Information requested</h2>
            <StatusBadge status="INFO_REQUESTED" />
          </div>
          <p>{data.approval?.infoRequestComment || "The approver requested more information about this request."}</p>
          {canApprovePerm && !isRequester ? (
            <p className="muted">
              You can approve now if the information request was sent by mistake. Approval continues from the current
              step.
            </p>
          ) : (
            <p className="muted">
              Contact your manager with the requested details. Reject or continue from{" "}
              <Link className="detail-link" href="/app/inbox">
                Inbox
              </Link>
              .
            </p>
          )}
        </section>
      ) : null}

      <div className="kpi-grid">
        <article className="kpi-card">
          <span>Status</span>
          <strong>
            <StatusBadge status={req.status} />
          </strong>
          <small>{data.approvalLabel || "No approval started"}</small>
        </article>
        <article className="kpi-card">
          <span>Amount</span>
          <strong>{money(req.currency, req.amount)}</strong>
          <small>{req.fulfillmentType === "FUND_ONLY" ? "Fund only" : "Virtual card"}</small>
        </article>
        <article className="kpi-card">
          <span>Policy</span>
          <strong>
            <StatusBadge status={data.policy.result || req.policyResult || "PASS"} />
          </strong>
          <small>{data.policy.reason || req.policyReason || "No blocking policy"}</small>
        </article>
      </div>

      <div className="work-panels">
        <section className="work-panel">
          <h2>Request</h2>
          <dl className="detail-list">
            <div>
              <dt>Requester</dt>
              <dd>
                {requesterName}
                {data.requester?.email ? ` · ${data.requester.email}` : ""}
              </dd>
            </div>
            <div>
              <dt>Legal entity</dt>
              <dd>{data.entity?.name ?? "—"}</dd>
            </div>
            <div>
              <dt>Spend program</dt>
              <dd>
                {data.program ? (
                  canSeePrograms ? (
                    <Link className="detail-link" href={`/app/spend/programs/${data.program.id}`}>
                      {data.program.name}
                    </Link>
                  ) : (
                    data.program.name
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Business purpose</dt>
              <dd>{req.purpose || "—"}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{req.category || "—"}</dd>
            </div>
            <div>
              <dt>Vendor</dt>
              <dd>
                {data.vendor ? (
                  canSeeVendors ? (
                    <Link className="detail-link" href={`/app/vendors/${data.vendor.id}`}>
                      {data.vendor.name}
                    </Link>
                  ) : (
                    data.vendor.name
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Recurrence</dt>
              <dd>{recurrenceLabel(req.recurrence)}</dd>
            </div>
            <div>
              <dt>Comments</dt>
              <dd>{req.comments || "—"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(req.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        <section className="work-panel">
          <h2>Approval progress</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {data.approvalLabel || "No approval started"}
          </p>
          <ul className="plain-list detail-checklist">
            {data.approvalProgress.map((step) => (
              <li key={step.label}>
                <span>{step.label}</span>
                <StatusBadge status={step.status} />
              </li>
            ))}
            {!data.approvalProgress.length && <li className="muted">No steps yet</li>}
          </ul>
          {canApprovePerm && (
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              Reject or request info from{" "}
              <Link className="detail-link" href="/app/inbox">
                Inbox
              </Link>
              .
            </p>
          )}
        </section>
      </div>

      <div className="work-panels">
        <section className="work-panel">
          <h2>Fulfillment</h2>
          <dl className="detail-list">
            <div>
              <dt>Type</dt>
              <dd>{req.fulfillmentType === "FUND_ONLY" ? "Fund only" : "Virtual card"}</dd>
            </div>
            <div>
              <dt>Fund</dt>
              <dd>
                {data.fund ? (
                  <>
                    {fundHref ? (
                      <Link className="detail-link" href={fundHref}>
                        {data.fund.name}
                      </Link>
                    ) : (
                      data.fund.name
                    )}
                    {" · "}
                    {money(data.fund.currency, data.fund.availableAmount)} available of{" "}
                    {money(data.fund.currency, data.fund.limitAmount)}
                  </>
                ) : (
                  <span className="muted">Not created yet — appears after final approval</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Card</dt>
              <dd>
                {data.card && cardHref ? (
                  <>
                    <Link className="detail-link" href={cardHref}>
                      •••• {data.card.last4}
                    </Link>{" "}
                    <StatusBadge status={data.card.status} />
                    <span className="muted">
                      {" · "}
                      {(data.card as { provider?: string }).provider === "stripe"
                        ? "Stripe Issuing"
                        : data.sandbox
                          ? "Sandbox / mock"
                          : "Issuer"}
                    </span>
                  </>
                ) : (
                  <span className="muted">
                    {req.fulfillmentType === "FUND_ONLY"
                      ? "Fund-only — no card for this request"
                      : "No card yet — issued on fulfillment"}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {isRequester && data.card && (
            <p className="muted" style={{ marginTop: 12 }}>
              {req.status === "FULFILLED" && data.fund && Number(data.fund.availableAmount) === 0 ? (
                <>
                  This approval topped up your shared virtual card (•••• {data.card.last4}). The request fund
                  balance was moved onto that card wallet.{" "}
                </>
              ) : null}
              <Link className="detail-link" href="/app/me/cards">
                My card →
              </Link>
            </p>
          )}
        </section>

        <section className="work-panel">
          <h2>Policy</h2>
          <p style={{ marginTop: 0 }}>
            <StatusBadge status={data.policy.result || "PASS"} /> {data.policy.reason || "No blocking policy matched."}
          </p>
          {Array.isArray(data.policy.matchedRules) && data.policy.matchedRules.length > 0 ? (
            <p className="muted">Matched rules: {(data.policy.matchedRules as string[]).join(", ")}</p>
          ) : null}
          {Array.isArray(data.policy.requiredActions) && (data.policy.requiredActions as string[]).length > 0 ? (
            <p className="muted">Required: {(data.policy.requiredActions as string[]).join(", ")}</p>
          ) : null}
        </section>
      </div>

      <section className="work-panel" style={{ marginTop: 14 }}>
        <h2>Timeline</h2>
        <div className="timeline">
          {data.timeline.map((event) => (
            <div key={event.id} className="timeline-item">
              <strong>{event.action}</strong>
              <div className="muted">{new Date(event.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {!data.timeline.length && <p className="muted">No activity yet.</p>}
        </div>
      </section>
    </div>
  );
}
