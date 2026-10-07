"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Detail = {
  bill: {
    id: string; invoiceNumber: string; amount: string | number; remainingAmount: string | number; currency: string;
    status: string; memo: string; dueDate: string | null; invoiceDate?: string | null; createdBy: string; vendorId: string; legalEntityId: string; attachmentId?: string | null;
    duplicateStatus?: string; vendorMatchStatus?: string; codingSource?: string; paymentMethod?: string;
  };
  vendor: { id: string; name: string; displayName?: string; paymentStatus?: string } | null;
  entity?: { name: string } | null;
  lines: Array<{ id: string; description: string; amount: string | number; quantity?: string | number; unitPrice?: string | number; taxAmount?: string | number; category: string; glAccount?: string; department?: string; location?: string; project?: string }>;
  payments: Array<{ id: string; amount: string | number; currency: string; rail: string; status: string; settlementId: string | null; createdBy: string }>;
  attachment: { originalName: string; malwareStatus: string; ocrStatus?: string | null } | null;
  accounting: { id: string; status: string } | null;
  approvalProgress?: Array<{ label: string; status: string }>;
  approvalLabel?: string;
  duplicate?: { status: string };
  vendorMatch?: { status: string };
  vendorPayment?: { last4: string; status: string; paymentMethod: string } | null;
  timeline?: Array<{ action: string; createdAt: string; actorId?: string | null }>;
  sandbox?: boolean;
  providerLabel?: string;
  readyForPayment?: boolean;
};

type LineDraft = {
  description: string; quantity: string; unitPrice: string; taxAmount: string;
  category: string; glAccount: string; department: string; location: string; project: string;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

const emptyLine = (): LineDraft => ({
  description: "", quantity: "1", unitPrice: "", taxAmount: "0",
  category: "", glAccount: "", department: "", location: "", project: "",
});

export default function BillDetailPage() {
  return (
    <Suspense fallback={<p className="muted">Loading bill…</p>}>
      <BillDetailInner />
    </Suspense>
  );
}

function BillDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [edit, setEdit] = useState<{
    invoiceNumber: string; invoiceDate: string; dueDate: string; memo: string; lines: LineDraft[];
  } | null>(null);
  const sandbox = process.env.NODE_ENV !== "production";

  const detail = useQuery({
    queryKey: ["bill-detail", params.id],
    queryFn: () => api.get<Detail>(`/bills/${params.id}`),
  });

  useEffect(() => {
    if (detail.data?.bill.status === "DRAFT" && !edit) {
      setEdit({
        invoiceNumber: detail.data.bill.invoiceNumber,
        invoiceDate: detail.data.bill.invoiceDate?.slice(0, 10) ?? "",
        dueDate: detail.data.bill.dueDate?.slice(0, 10) ?? "",
        memo: detail.data.bill.memo,
        lines: detail.data.lines.map((line) => ({
          description: line.description,
          quantity: String(line.quantity ?? 1),
          unitPrice: String(line.unitPrice ?? line.amount),
          taxAmount: String(line.taxAmount ?? 0),
          category: line.category ?? "",
          glAccount: line.glAccount ?? "",
          department: line.department ?? "",
          location: line.location ?? "",
          project: line.project ?? "",
        })),
      });
    }
  }, [detail.data, edit]);

  const editDraft = useMutation({
    mutationFn: () => api.post(`/bills/${params.id}/edit-draft`, {
      ...edit,
      vendorId: detail.data!.bill.vendorId,
      legalEntityId: detail.data!.bill.legalEntityId,
      currency: detail.data!.bill.currency,
      attachmentId: detail.data!.bill.attachmentId,
    }),
    onSuccess: () => {
      setMessage("Draft bill updated. Totals were recalculated by the server.");
      setEdit(null);
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
    },
  });
  const cancelBill = useMutation({
    mutationFn: () => api.post(`/bills/${params.id}/cancel`, {}),
    onSuccess: () => {
      setMessage("Bill cancelled; history is retained.");
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
    },
  });
  const approve = useMutation({
    mutationFn: () => api.post(`/bills/${params.id}/approve`, {}),
    onSuccess: () => {
      setMessage("Bill approved. Payment release is a separate step.");
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "bills"] });
    },
  });
  const submit = useMutation({
    mutationFn: () => api.post(`/bills/${params.id}/submit`, {}),
    onSuccess: () => {
      setMessage("Bill submitted for approval.");
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
    },
  });
  const schedule = useMutation({
    mutationFn: () => api.post(`/payments`, {
      billId: params.id,
      amount: payAmount || String(detail.data?.bill.remainingAmount ?? ""),
      rail: "ACH",
      idempotencyKey: `web-${params.id}-${Date.now()}`,
    }),
    onSuccess: () => {
      setMessage("Payment scheduled. A different user must release it.");
      setPayAmount("");
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "payments"] });
    },
  });
  const paymentAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/payments/${id}/${action}`, {}),
    onSuccess: (_data, vars) => {
      setMessage(`Payment ${vars.action} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["bill-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "payments"] });
    },
  });

  if (detail.isError) {
    return (
      <div className="error-panel">
        Could not load bill.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>Try again</button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading bill…</p>;

  const { bill, vendor, lines, payments, attachment, accounting, approvalProgress, approvalLabel, timeline, vendorPayment, entity } = detail.data;
  const canApprove = bill.status === "PENDING_APPROVAL"
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("bill.approve"))
    && session?.userId !== bill.createdBy;
  const canSubmit = ["DRAFT", "NEEDS_REVIEW"].includes(bill.status)
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("bill.create"));
  const canSchedule = ["APPROVED", "PARTIAL"].includes(bill.status)
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("payment.create"));
  const canRelease = session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("payment.release");
  const canSeeVendors = session
    ? canSeeItem(findNavItem("/app/vendors") ?? { href: "/app/vendors", permission: "vendor.read" }, session)
    : false;
  const canSeePayments = session
    ? canSeeItem(
        findNavItem("/app/bill-pay/payments") ?? { href: "/app/bill-pay/payments", permission: "payment.create" },
        session,
      )
    : false;
  const canSeeAccounting = session
    ? canSeeItem(
        findNavItem("/app/accounting/review") ?? { href: "/app/accounting/review", permission: "accounting.read" },
        session,
      )
    : false;
  const stage = searchParams.get("stage");
  const knownStages: Record<string, string> = {
    drafts: "Drafts",
    approval: "For approval",
    payment: "For payment",
    history: "History",
    urgent: "Urgent",
    // Legacy spaced values from older links
    Drafts: "Drafts",
    "For approval": "For approval",
    "For payment": "For payment",
    History: "History",
    Urgent: "Urgent",
  };
  const stageSlug =
    stage === "Drafts" || stage === "drafts"
      ? "drafts"
      : stage === "For approval" || stage === "approval"
        ? "approval"
        : stage === "For payment" || stage === "payment"
          ? "payment"
          : stage === "History" || stage === "history"
            ? "history"
            : stage === "Urgent" || stage === "urgent"
              ? "urgent"
              : null;
  const backHref = stageSlug ? `/app/bill-pay/bills?stage=${stageSlug}` : "/app/bill-pay/bills";
  const backLabel = stage && knownStages[stage] ? `Back to ${knownStages[stage].toLowerCase()}` : "Back to bills";
  const accountingHref = accounting && canSeeAccounting
    ? `/app/accounting/review?entry=${encodeURIComponent(accounting.id)}`
    : null;

  return (
    <div className="detail-page">
      <div className="resource-heading">
        <PageHeader
          title={`Invoice ${bill.invoiceNumber}`}
          subtitle={`${vendor?.displayName ?? vendor?.name ?? "Vendor"} · ${money(bill.currency, bill.amount)}`}
        />
        <div className="detail-actions-top">
          {vendor && canSeeVendors && (
            <Link className="btn btn-ghost" href={`/app/vendors/${vendor.id}`}>
              Vendor
            </Link>
          )}
          <Link className="btn btn-ghost" href={backHref}>
            {backLabel}
          </Link>
        </div>
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {(approve.isError || schedule.isError || paymentAction.isError || submit.isError || editDraft.isError || cancelBill.isError) && (
        <p className="error" role="alert">
          {(approve.error ?? schedule.error ?? paymentAction.error ?? submit.error ?? editDraft.error ?? cancelBill.error)?.message}
        </p>
      )}
      {detail.data.sandbox && (
        <p className="muted">
          {detail.data.providerLabel
            ? `${detail.data.providerLabel} — settlement confirmation is a separate step after release.`
            : "Sandbox payment rail — settlement confirmation is a separate step after release."}
        </p>
      )}

      <div className="overview-stat-grid">
        <article className="overview-stat">
          <span>Status</span>
          <strong><StatusBadge status={bill.status} /></strong>
          <small>{entity?.name ?? "Entity"}</small>
        </article>
        <article className="overview-stat">
          <span>Remaining</span>
          <strong>{money(bill.currency, bill.remainingAmount)}</strong>
          <small>Settled payments only reduce this</small>
        </article>
        <article className="overview-stat">
          <span>Duplicate check</span>
          <strong>{bill.duplicateStatus ?? detail.data.duplicate?.status ?? "CLEAR"}</strong>
          <small>Vendor match {bill.vendorMatchStatus ?? detail.data.vendorMatch?.status ?? "—"}</small>
        </article>
        {accountingHref ? (
          <Link href={accountingHref} className="overview-stat">
            <span>Accounting</span>
            <strong>{accounting ? <StatusBadge status={accounting.status} /> : "Not linked"}</strong>
            <small>{accounting ? "Open source entry →" : "No accounting row yet"}</small>
          </Link>
        ) : (
          <article className="overview-stat">
            <span>Accounting</span>
            <strong>{accounting ? <StatusBadge status={accounting.status} /> : "Not linked"}</strong>
            <small>No accounting row yet</small>
          </article>
        )}
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Summary & actions</h2>
          <dl className="detail-list">
            <div><dt>Memo</dt><dd>{bill.memo || "—"}</dd></div>
            <div><dt>Payment method</dt><dd>{bill.paymentMethod ?? "ACH"}</dd></div>
            <div><dt>Coding</dt><dd>{bill.codingSource ?? "MANUAL"}</dd></div>
            <div>
              <dt>Vendor bank</dt>
              <dd>{vendorPayment ? `•••• ${vendorPayment.last4} (${vendorPayment.status})` : vendor?.paymentStatus ?? "—"}</dd>
            </div>
            <div><dt>Invoice date</dt><dd>{bill.invoiceDate ? new Date(bill.invoiceDate).toLocaleDateString() : "—"}</dd></div>
            <div><dt>Due date</dt><dd>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "—"}</dd></div>
          </dl>
          <div className="detail-actions">
            {canSubmit && (
              <button className="btn btn-primary" type="button" disabled={submit.isPending} onClick={() => submit.mutate()}>
                Submit for approval
              </button>
            )}
            {canApprove && (
              <button className="btn btn-primary" type="button" disabled={approve.isPending} onClick={() => approve.mutate()}>
                Approve bill
              </button>
            )}
            {canApprove && (
              <p className="muted" style={{ width: "100%", margin: "8px 0 0", fontSize: 13 }}>
                Reject or request info from{" "}
                <Link className="detail-link" href="/app/inbox">
                  Inbox
                </Link>
                .
              </p>
            )}
            {["DRAFT", "NEEDS_REVIEW", "PENDING_APPROVAL", "APPROVED"].includes(bill.status) && (
              <button
                className="btn btn-danger"
                type="button"
                disabled={cancelBill.isPending}
                onClick={() => window.confirm("Cancel this bill? Its audit history will be retained.") && cancelBill.mutate()}
              >
                Cancel bill
              </button>
            )}
            {canSchedule && (
              <>
                <input
                  className="input"
                  style={{ maxWidth: 160 }}
                  placeholder="Partial amount"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  aria-label="Partial amount"
                />
                <button className="btn btn-primary" type="button" disabled={schedule.isPending} onClick={() => schedule.mutate()}>
                  Schedule payment
                </button>
              </>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Approval</h2>
          <p className="muted" style={{ marginTop: 0 }}>{approvalLabel || "No approval started"} · Approve ≠ payment release</p>
          <ul className="plain-list detail-checklist">
            {(approvalProgress ?? []).map((step) => (
              <li key={step.label}>
                <span>{step.label}</span>
                <StatusBadge status={step.status} />
              </li>
            ))}
            {!(approvalProgress ?? []).length && <li className="muted">Waiting for submission.</li>}
          </ul>
        </section>
      </div>

      <section className="panel">
        <div className="resource-heading">
          <h2 style={{ margin: 0 }}>Invoice lines</h2>
          <span className="muted">{lines.length} line{lines.length === 1 ? "" : "s"}</span>
        </div>

        {bill.status === "DRAFT" && edit && (
          <form
            className="record-form"
            onSubmit={(event) => {
              event.preventDefault();
              editDraft.mutate();
            }}
          >
            <div className="form-grid">
              <label>Invoice number<input className="input" value={edit.invoiceNumber} onChange={(e) => setEdit({ ...edit, invoiceNumber: e.target.value })} /></label>
              <label>Invoice date<input className="input" type="date" value={edit.invoiceDate} onChange={(e) => setEdit({ ...edit, invoiceDate: e.target.value })} /></label>
              <label>Due date<input className="input" type="date" value={edit.dueDate} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} /></label>
              <label>Memo<input className="input" value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} /></label>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Tax</th>
                    <th>Category</th>
                    <th>GL</th>
                  </tr>
                </thead>
                <tbody>
                  {edit.lines.map((line, index) => (
                    <tr key={index}>
                      {(["description", "quantity", "unitPrice", "taxAmount", "category", "glAccount"] as const).map((key) => (
                        <td key={key}>
                          <input
                            className="input"
                            type={["quantity", "unitPrice", "taxAmount"].includes(key) ? "number" : "text"}
                            value={line[key]}
                            onChange={(e) => setEdit({
                              ...edit,
                              lines: edit.lines.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item),
                            })}
                            aria-label={`${key} line ${index + 1}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="detail-actions-top">
              <button className="btn btn-ghost" type="button" onClick={() => setEdit({ ...edit, lines: [...edit.lines, emptyLine()] })}>
                Add line
              </button>
              <button className="btn btn-primary" disabled={editDraft.isPending}>Save draft corrections</button>
            </div>
          </form>
        )}

        {!(bill.status === "DRAFT" && edit) && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Tax</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>GL</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.description || "—"}</td>
                    <td>{line.quantity != null ? String(line.quantity) : "—"}</td>
                    <td>{line.unitPrice != null ? money(bill.currency, line.unitPrice) : "—"}</td>
                    <td>{line.taxAmount != null ? money(bill.currency, line.taxAmount) : "—"}</td>
                    <td>{money(bill.currency, line.amount)}</td>
                    <td>{line.category || "—"}</td>
                    <td>{line.glAccount || "—"}</td>
                  </tr>
                ))}
                {!lines.length && <tr><td colSpan={7} className="muted">No invoice lines.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginBottom: 0 }}>
          Document: {attachment
            ? `${attachment.originalName} (${attachment.malwareStatus}${attachment.ocrStatus ? ` · OCR ${attachment.ocrStatus}` : ""})`
            : "None attached"}
        </p>
      </section>

      <div className="detail-grid">
        <section className="panel">
          <h2>Payments</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Rail</th>
                  <th>Status</th>
                  <th>Settlement</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      {canSeePayments ? (
                        <Link href={`/app/bill-pay/payments/${payment.id}`}>{money(payment.currency, payment.amount)}</Link>
                      ) : (
                        money(payment.currency, payment.amount)
                      )}
                    </td>
                    <td>{payment.rail}</td>
                    <td><StatusBadge status={payment.status} /></td>
                    <td className="muted">{payment.settlementId ?? "—"}</td>
                    <td>
                      {canRelease && payment.status === "SCHEDULED" && session?.userId !== payment.createdBy && (
                        <button className="btn btn-ghost" type="button" disabled={paymentAction.isPending} onClick={() => paymentAction.mutate({ id: payment.id, action: "release" })}>
                          Release
                        </button>
                      )}
                      {canRelease && sandbox && payment.status === "PROCESSING" && (
                        <button className="btn btn-ghost" type="button" disabled={paymentAction.isPending} onClick={() => paymentAction.mutate({ id: payment.id, action: "confirm-settlement" })}>
                          Confirm settlement
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!payments.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No payments yet{detail.data.readyForPayment ? " — ready for payment." : "."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Activity</h2>
          <div className="timeline">
            {(timeline ?? []).map((event, index) => (
              <div key={`${event.action}-${index}`} className="timeline-item">
                <strong>{event.action}</strong>
                <div className="muted">{new Date(event.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {!(timeline ?? []).length && <p className="muted">No timeline events yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
