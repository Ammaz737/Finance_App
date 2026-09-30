"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";
import { canSeeItem, findNavItem } from "@/config/navigation";

type ExpenseDetail = {
  expense: {
    id: string;
    merchant: string;
    amount: string | number;
    currency: string;
    memo: string;
    status: string;
    policyResult: string;
    receiptId: string | null;
    transactionId: string | null;
    userId: string;
  };
  receipt: {
    id: string;
    merchantGuess: string | null;
    amountGuess: string | number | null;
    matchStatus: string;
    ocrStatus: string;
    attachmentId: string;
  } | null;
  attachment: { id: string; originalName: string; mimeType: string; malwareStatus: string } | null;
  splits: Array<{ id: string; amount: string | number; category: string; department: string }>;
  transaction: { id: string; status: string; merchant: string; amount: string | number } | null;
  requirements?: {
    requirements: Array<{ key: string; label: string; status: string }>;
    complete: boolean;
    missing: string[];
  };
  timeline?: Array<{ id: string; action: string; createdAt: string; actorId?: string | null }>;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("receipt.png");
  const [fileContent, setFileContent] = useState("");
  const [fileReading, setFileReading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [splitDraft, setSplitDraft] = useState({ amount: "", category: "GENERAL", department: "" });

  const detail = useQuery({
    queryKey: ["expense-detail", params.id],
    queryFn: async () => {
      const payload = await api.get<ExpenseDetail>(`/expenses/${params.id}`);
      setMemo(payload.expense.memo ?? "");
      return payload;
    },
  });

  async function uploadAndLinkReceipt(content: string, name: string) {
    if (!content) {
      throw Object.assign(new Error("Choose a PDF, PNG, or JPEG first"), {
        message: "Choose a PDF, PNG, or JPEG first",
      });
    }
    const lower = name.toLowerCase();
    const mimeType = lower.endsWith(".pdf")
      ? "application/pdf"
      : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";
    const uploaded = await api.post<{ id: string }>("/documents/upload", {
      name: name || "receipt.png",
      mimeType,
      classification: "RECEIPT",
      contentBase64: content,
    });
    return api.post("/receipts", { attachmentId: uploaded.id, expenseId: params.id });
  }

  const saveMemo = useMutation({
    mutationFn: () => api.post(`/expenses/${params.id}/update-memo`, { memo }),
    onSuccess: () => {
      setActionError("");
      setMessage("Memo saved.");
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not save memo"),
  });
  const attachReceipt = useMutation({
    mutationFn: () => uploadAndLinkReceipt(fileContent, fileName),
    onSuccess: () => {
      setActionError("");
      setMessage("Receipt linked. You can submit the expense now.");
      setFileContent("");
      setFileName("receipt.png");
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not upload receipt"),
  });
  const submit = useMutation({
    mutationFn: async () => {
      // File picker alone does not attach — upload first if still pending.
      if (!detail.data?.receipt && fileContent) {
        await uploadAndLinkReceipt(fileContent, fileName);
        setFileContent("");
        setFileName("receipt.png");
      }
      return api.post(`/expenses/${params.id}/submit`, {});
    },
    onSuccess: () => {
      setActionError("");
      setMessage("Expense submitted for review.");
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not submit expense"),
  });
  const approve = useMutation({
    mutationFn: () => api.post(`/expenses/${params.id}/approve`, {}),
    onSuccess: () => {
      setActionError("");
      setMessage("Expense approved.");
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "expenses"] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not approve expense"),
  });
  const saveSplit = useMutation({
    mutationFn: () => {
      const data = detail.data;
      if (!data) throw new Error("Expense not loaded");
      const existing = data.splits.map((row) => ({
        amount: String(row.amount),
        category: row.category,
        department: row.department,
      }));
      return api.post(`/expenses/${params.id}/split`, {
        splits: [
          ...existing,
          { amount: splitDraft.amount, category: splitDraft.category, department: splitDraft.department },
        ],
      });
    },
    onSuccess: () => {
      setActionError("");
      setMessage("Split saved.");
      setSplitDraft({ amount: "", category: "GENERAL", department: "" });
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not save split"),
  });

  function onFile(file: File | null) {
    if (!file) return;
    setActionError("");
    setFileName(file.name);
    setFileContent("");
    setFileReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      setFileContent(base64);
      setFileReading(false);
    };
    reader.onerror = () => {
      setFileReading(false);
      setActionError("Could not read that file. Try a PDF, PNG, or JPEG under 5 MB.");
    };
    reader.readAsDataURL(file);
  }

  if (detail.isError) {
    return (
      <div className="error-panel">
        Could not load expense.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading expense…</p>;

  const data = detail.data;
  const isOwner =
    session?.userId === data.expense.userId ||
    session?.roles.includes("Owner") ||
    session?.permissions.includes("*");
  const canEdit = ["INCOMPLETE", "REJECTED"].includes(data.expense.status) && Boolean(isOwner);
  const canApprove =
    ["SUBMITTED", "IN_REVIEW"].includes(data.expense.status) &&
    Boolean(
      session?.roles.includes("Owner") ||
        session?.permissions.includes("*") ||
        session?.permissions.includes("expense.approve"),
    );
  const canSeeTransactions = session
    ? canSeeItem(findNavItem("/app/spend/transactions") ?? { href: "/app/spend/transactions", permissions: ["expense.read", "card.read"] }, session)
    : false;
  const isApproverView = Boolean(
    session &&
      session.userId !== data.expense.userId &&
      (session.permissions.includes("expense.approve") ||
        session.roles.includes("Owner") ||
        session.permissions.includes("*")),
  );
  const backHref = isApproverView ? "/app/expenses/transactions" : "/app/me/expenses";
  const backLabel = isApproverView ? "Back to expense review" : "Back to my expenses";
  const requirements = data.requirements?.requirements ?? [
    { key: "receipt", label: "Receipt", status: data.receipt ? "Complete" : "Missing" },
    { key: "memo", label: "Business purpose", status: data.expense.memo?.trim() ? "Complete" : "Missing" },
  ];
  const receiptPending = Boolean(fileContent) && !data.receipt;

  return (
    <div className="detail-page">
      <div className="resource-heading">
        <PageHeader title={data.expense.merchant || "Expense"} subtitle={money(data.expense.currency, data.expense.amount)} />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      <div className="overview-stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <article className="overview-stat">
          <span>Status</span>
          <strong>
            <StatusBadge status={data.expense.status} />
          </strong>
          <small>Policy {data.expense.policyResult || "—"}</small>
        </article>
        <article className="overview-stat">
          <span>Receipt</span>
          <strong>{data.receipt ? data.receipt.matchStatus : "Missing"}</strong>
          <small>
            {data.receipt ? (
              <Link className="detail-link" href={`/app/expenses/receipts/${data.receipt.id}`}>
                {data.attachment?.originalName ?? "View receipt"} →
              </Link>
            ) : (
              "Upload required above threshold"
            )}
          </small>
        </article>
        {data.transaction ? (
          canSeeTransactions ? (
            <Link
              href={`/app/spend/transactions/${data.transaction.id}`}
              className="overview-stat"
            >
              <span>Transaction</span>
              <strong>
                <StatusBadge status={data.transaction.status} />
              </strong>
              <small>
                {money(data.expense.currency, data.transaction.amount)} · Open →
              </small>
            </Link>
          ) : (
            <article className="overview-stat">
              <span>Transaction</span>
              <strong>
                <StatusBadge status={data.transaction.status} />
              </strong>
              <small>{money(data.expense.currency, data.transaction.amount)}</small>
            </article>
          )
        ) : (
          <article className="overview-stat">
            <span>Transaction</span>
            <strong>—</strong>
            <small>No linked card txn</small>
          </article>
        )}
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Requirements</h2>
          <ul className="plain-list detail-checklist">
            {requirements.map((row) => (
              <li key={row.key}>
                <span>{row.label}</span>
                <span className={row.status === "Complete" ? "req-ok" : "req-missing"}>
                  {row.status === "Complete" ? "Complete" : "Missing"}
                </span>
              </li>
            ))}
          </ul>
          {!data.requirements?.complete && data.requirements?.missing?.length ? (
            <p className="muted">Still needed: {data.requirements.missing.join(", ")}</p>
          ) : null}
        </section>

        <section className="panel">
          <h2>Complete expense</h2>
          {canEdit ? (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveMemo.mutate();
              }}
            >
              <label>
                Business purpose / memo
                <textarea
                  className="input"
                  rows={3}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  maxLength={500}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={saveMemo.isPending}>
                {saveMemo.isPending ? "Saving…" : "Save memo"}
              </button>
            </form>
          ) : (
            <dl className="detail-list">
              <div>
                <dt>Memo</dt>
                <dd>{data.expense.memo || "—"}</dd>
              </div>
            </dl>
          )}

          {canEdit && (
            <form
              className="record-form"
              onSubmit={(event) => {
                event.preventDefault();
                attachReceipt.mutate();
              }}
            >
              <h3 style={{ margin: "8px 0 0", fontSize: 14 }}>Attach receipt</h3>
              <label>
                File
                <input
                  className="input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {fileReading ? (
                <p className="muted">Reading file…</p>
              ) : receiptPending ? (
                <p className="muted">
                  Selected <strong>{fileName}</strong> — not linked yet. Click Upload &amp; link (or Submit will upload it).
                </p>
              ) : null}
              <button
                className="btn btn-ghost"
                type="submit"
                disabled={attachReceipt.isPending || fileReading || !fileContent}
              >
                {attachReceipt.isPending ? "Uploading…" : "Upload & link"}
              </button>
            </form>
          )}

          {data.receipt && (
            <dl className="detail-list">
              <div>
                <dt>OCR merchant</dt>
                <dd>{data.receipt.merchantGuess || "—"}</dd>
              </div>
              <div>
                <dt>OCR amount</dt>
                <dd>{data.receipt.amountGuess != null ? String(data.receipt.amountGuess) : "—"}</dd>
              </div>
              <div>
                <dt>OCR status</dt>
                <dd>{data.receipt.ocrStatus}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>
                  <Link className="detail-link" href={`/app/expenses/receipts/${data.receipt.id}`}>
                    {data.attachment?.originalName ?? data.receipt.attachmentId.slice(0, 8)}
                  </Link>{" "}
                  · {data.attachment?.malwareStatus ?? "—"}
                </dd>
              </div>
            </dl>
          )}

          <div className="detail-actions">
            {canEdit && (
              <button
                className="btn btn-primary"
                type="button"
                disabled={submit.isPending || attachReceipt.isPending || fileReading}
                onClick={() => submit.mutate()}
              >
                {submit.isPending
                  ? receiptPending
                    ? "Uploading & submitting…"
                    : "Submitting…"
                  : data.expense.status === "REJECTED"
                    ? "Resubmit expense"
                    : "Submit expense"}
              </button>
            )}
            {canApprove && (
              <button className="btn btn-primary" type="button" disabled={approve.isPending} onClick={() => approve.mutate()}>
                Approve
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="resource-heading">
          <h2 style={{ margin: 0 }}>Splits</h2>
          <span className="muted">Must total {money(data.expense.currency, data.expense.amount)}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Category</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {data.splits.map((row) => (
                <tr key={row.id}>
                  <td>{money(data.expense.currency, row.amount)}</td>
                  <td>{row.category}</td>
                  <td>{row.department || "—"}</td>
                </tr>
              ))}
              {!data.splits.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    No splits yet. Full amount stays on the expense.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <form
            className="form-grid"
            style={{ marginTop: 16 }}
            onSubmit={(event) => {
              event.preventDefault();
              saveSplit.mutate();
            }}
          >
            <label>
              Amount
              <input
                className="input"
                type="number"
                step="0.01"
                required
                value={splitDraft.amount}
                onChange={(e) => setSplitDraft({ ...splitDraft, amount: e.target.value })}
              />
            </label>
            <label>
              Category
              <input
                className="input"
                required
                value={splitDraft.category}
                onChange={(e) => setSplitDraft({ ...splitDraft, category: e.target.value })}
              />
            </label>
            <label>
              Department
              <input
                className="input"
                value={splitDraft.department}
                onChange={(e) => setSplitDraft({ ...splitDraft, department: e.target.value })}
              />
            </label>
            <button className="btn btn-ghost" type="submit" disabled={saveSplit.isPending}>
              Add split line
            </button>
          </form>
        )}
      </section>

      {(data.timeline?.length ?? 0) > 0 && (
        <section className="panel">
          <h2>Activity</h2>
          <div className="timeline">
            {data.timeline!.map((item) => (
              <div key={item.id} className="timeline-item">
                <strong>{item.action}</strong>
                <div className="muted">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
