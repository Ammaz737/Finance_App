"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";
import { canSeeItem, findNavItem } from "@/config/navigation";

type Detail = {
  reimbursement: {
    id: string;
    type: string;
    amount: string | number;
    currency: string;
    memo: string;
    merchant: string;
    status: string;
    policyResult: string;
    distanceMiles: string | number | null;
    mileageRate: string | number | null;
    perDiemNights: number | null;
    perDiemRate: string | number | null;
    calcBreakdown: { formula?: string } | null;
    payoutRail: string | null;
    providerRef: string | null;
    scheduledAt: string | null;
    paidAt: string | null;
    userId: string;
    failureReason?: string;
    payoutStatus?: string;
    destination?: string;
    category?: string;
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

function ReimbursementDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("receipt.png");
  const [fileContent, setFileContent] = useState("");
  const sandbox = process.env.NODE_ENV !== "production";

  const detail = useQuery({
    queryKey: ["reimbursement-detail", params.id],
    queryFn: () => api.get<Detail>(`/reimbursements/${params.id}`),
  });

  const run = useMutation({
    mutationFn: (action: string) =>
      api.post(`/reimbursements/${params.id}/${action}`, action === "schedule" ? { rail: "ACH" } : {}),
    onSuccess: (_data, action) => {
      setMessage(`Action ${action} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["reimbursement-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "reimbursements"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const attachReceipt = useMutation({
    mutationFn: async () => {
      if (!fileContent) {
        throw Object.assign(new Error("Choose a PDF, PNG, or JPEG first"), {
          message: "Choose a PDF, PNG, or JPEG first",
        });
      }
      const uploaded = await api.post<{ id: string }>("/documents/upload", {
        name: fileName || "receipt.png",
        mimeType: fileName.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg")
            ? "image/jpeg"
            : "image/png",
        classification: "RECEIPT",
        contentBase64: fileContent,
      });
      return api.post(`/reimbursements/${params.id}/attach-receipt`, { attachmentId: uploaded.id });
    },
    onSuccess: () => {
      setMessage("Receipt attached.");
      setFileContent("");
      void queryClient.invalidateQueries({ queryKey: ["reimbursement-detail", params.id] });
    },
  });

  function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      setFileContent(base64);
    };
    reader.readAsDataURL(file);
  }

  if (detail.isError) {
    return (
      <div className="error-panel">
        Could not load reimbursement.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading reimbursement…</p>;

  const data = detail.data.reimbursement;
  const isOwner =
    session?.userId === data.userId ||
    session?.roles.includes("Owner") ||
    session?.permissions.includes("*");
  const canSubmit = ["DRAFT", "NEEDS_INFO"].includes(data.status) && Boolean(isOwner);
  const canApprove =
    data.status === "IN_REVIEW" &&
    Boolean(
      session?.roles.includes("Owner") ||
        session?.permissions.includes("*") ||
        session?.permissions.includes("reimbursement.approve"),
    ) &&
    session?.userId !== data.userId;
  const canPay = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("reimbursement.pay"),
  );
  const canCreate = Boolean(
    session?.permissions.includes("reimbursement.create") ||
      session?.roles.includes("Owner") ||
      session?.permissions.includes("*"),
  );
  const canSeeCompanyList = session
    ? canSeeItem(
        findNavItem("/app/expenses/reimbursements") ?? {
          href: "/app/expenses/reimbursements",
          permissions: ["reimbursement.approve", "reimbursement.pay"],
        },
        session,
      )
    : false;
  const statusParam = searchParams.get("status");
  const queueTitles: Record<string, string> = {
    IN_REVIEW: "For approval",
    APPROVED: "For payout",
    PAID: "Paid / History",
    FAILED: "Failures",
  };
  const backHref =
    session?.userId === data.userId || (canCreate && !canSeeCompanyList)
      ? "/app/me/reimbursements"
      : statusParam && queueTitles[statusParam]
        ? `/app/expenses/reimbursements?status=${encodeURIComponent(statusParam)}`
        : "/app/expenses/reimbursements";
  const backLabel = backHref.startsWith("/app/me/reimbursements")
    ? "Back to my reimbursements"
    : statusParam && queueTitles[statusParam]
      ? `Back to ${queueTitles[statusParam].toLowerCase()}`
      : "Back to reimbursements";
  const canSeeAccounting = session
    ? canSeeItem(
        findNavItem("/app/accounting/review") ?? { href: "/app/accounting/review", permission: "accounting.read" },
        session,
      )
    : false;
  const approvedSteps = detail.data.approvalProgress.filter((step) => step.status === "Approved").length;

  return (
    <div className="detail-page">
      <div className="resource-heading">
        <PageHeader
          title={data.memo || `${data.type} reimbursement`}
          subtitle={`${detail.data.employee ? `${detail.data.employee.firstName} ${detail.data.employee.lastName}` : "Employee"} · ${money(data.currency, data.amount)}`}
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
      {(run.isError || attachReceipt.isError) && (
        <p className="error" role="alert">
          {(run.error ?? attachReceipt.error)?.message}
        </p>
      )}

      <div className="overview-stat-grid">
        <article className="overview-stat">
          <span>Status</span>
          <strong>
            <StatusBadge status={data.status} />
          </strong>
          <small>{detail.data.approvalLabel || data.payoutStatus || "—"}</small>
        </article>
        <article className="overview-stat">
          <span>Type</span>
          <strong>{data.type}</strong>
          <small>{data.calcBreakdown?.formula ?? "Server calculated"}</small>
        </article>
        <article className="overview-stat">
          <span>Policy</span>
          <strong>{detail.data.policy.result ?? data.policyResult}</strong>
          <small>{detail.data.policy.reason || "—"}</small>
        </article>
        {detail.data.accounting && canSeeAccounting ? (
          <Link
            href={`/app/accounting/review?entry=${encodeURIComponent(detail.data.accounting.id)}`}
            className="overview-stat"
          >
            <span>Accounting</span>
            <strong>
              <StatusBadge status={detail.data.accounting.status} />
            </strong>
            <small>Open entry →</small>
          </Link>
        ) : (
          <article className="overview-stat">
            <span>Accounting</span>
            <strong>
              {detail.data.accounting ? <StatusBadge status={detail.data.accounting.status} /> : "Not yet"}
            </strong>
            <small>Created only after payout</small>
          </article>
        )}
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Overview</h2>
          <dl className="detail-list">
            <div>
              <dt>Merchant / destination</dt>
              <dd>{data.merchant || data.destination || "—"}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{data.category || "—"}</dd>
            </div>
            {data.distanceMiles != null && (
              <div>
                <dt>Distance</dt>
                <dd>
                  {String(data.distanceMiles)} mi @ {String(data.mileageRate)}
                </dd>
              </div>
            )}
            {data.perDiemNights != null && (
              <div>
                <dt>Per diem</dt>
                <dd>
                  {data.perDiemNights} days @ {String(data.perDiemRate)}
                </dd>
              </div>
            )}
            <div>
              <dt>Duplicate check</dt>
              <dd>{detail.data.duplicate.status}</dd>
            </div>
          </dl>
          <div className="detail-actions">
            {canSubmit && (
              <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("submit")}>
                {data.status === "NEEDS_INFO" ? "Resubmit" : "Submit"}
              </button>
            )}
            {canApprove && (
              <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("approve")}>
                Approve
              </button>
            )}
            {canPay && ["APPROVED", "FAILED", "READY_FOR_PAYOUT"].includes(data.status) && (
              <button className="btn btn-primary" type="button" disabled={run.isPending} onClick={() => run.mutate("schedule")}>
                Schedule payout
              </button>
            )}
            {canPay && sandbox && data.status === "SCHEDULED" && (
              <button
                className="btn btn-primary"
                type="button"
                disabled={run.isPending}
                onClick={() => run.mutate("confirm-payout")}
              >
                Confirm payout
              </button>
            )}
          </div>
          <p className="muted">{detail.data.sandboxLabel}</p>
          {canApprove && (
            <p className="muted" style={{ fontSize: 13 }}>
              Reject or request info from{" "}
              <Link className="detail-link" href="/app/inbox">
                Inbox
              </Link>
              .
            </p>
          )}
        </section>

        <section className="panel">
          <h2>Requirements</h2>
          <ul className="plain-list detail-checklist">
            {detail.data.requirements.requirements.map((row) => (
              <li key={row.label}>
                <span>{row.label}</span>
                <span className={row.status === "Complete" || row.status === "COMPLETE" ? "req-ok" : "req-missing"}>
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Receipt / Evidence</h2>
          {detail.data.receipt ? (
            <dl className="detail-list">
              <div>
                <dt>Match</dt>
                <dd>{detail.data.receipt.matchStatus}</dd>
              </div>
              <div>
                <dt>OCR</dt>
                <dd>
                  {detail.data.receipt.ocrStatus}
                  {detail.data.receipt.merchantGuess ? ` · ${detail.data.receipt.merchantGuess}` : ""}
                </dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>
                  {detail.data.attachment?.originalName ?? "Linked"} · {detail.data.attachment?.malwareStatus ?? "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted">No receipt attached yet.</p>
          )}
          {canSubmit && (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                attachReceipt.mutate();
              }}
            >
              <label>
                Attach receipt
                <input
                  className="input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button className="btn btn-ghost" type="submit" disabled={attachReceipt.isPending || !fileContent}>
                {attachReceipt.isPending ? "Uploading…" : "Upload & link"}
              </button>
            </form>
          )}
        </section>

        <section className="panel">
          <h2>Approvals</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {approvedSteps} of {detail.data.approvalProgress.length || 0} approvals completed
          </p>
          <ul className="plain-list detail-checklist">
            {detail.data.approvalProgress.map((step) => (
              <li key={`${step.label}-${step.status}`}>
                <span>{step.label}</span>
                <StatusBadge status={step.status} />
              </li>
            ))}
            {!detail.data.approvalProgress.length && <li className="muted">No approval steps yet.</li>}
          </ul>
          <h2 style={{ marginTop: 20 }}>Payout</h2>
          <dl className="detail-list">
            <div>
              <dt>Rail</dt>
              <dd>{data.payoutRail ?? "—"}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{data.providerRef ?? "—"}</dd>
            </div>
            {data.scheduledAt && (
              <div>
                <dt>Scheduled</dt>
                <dd>{new Date(data.scheduledAt).toLocaleString()}</dd>
              </div>
            )}
            {data.paidAt && (
              <div>
                <dt>Paid</dt>
                <dd>{new Date(data.paidAt).toLocaleString()}</dd>
              </div>
            )}
            {data.failureReason && (
              <div>
                <dt>Failure</dt>
                <dd>{data.failureReason}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="panel">
        <h2>Activity</h2>
        <div className="timeline">
          {detail.data.timeline.map((event) => (
            <div key={event.id} className="timeline-item">
              <strong>{event.action}</strong>
              <div className="muted">{new Date(event.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {!detail.data.timeline.length && <p className="muted">No activity yet.</p>}
        </div>
      </section>
    </div>
  );
}

export default function ReimbursementDetailPage() {
  return (
    <Suspense fallback={<p className="muted">Loading reimbursement…</p>}>
      <ReimbursementDetailInner />
    </Suspense>
  );
}
