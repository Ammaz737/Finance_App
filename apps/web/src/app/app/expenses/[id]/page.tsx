"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type ExpenseDetail = {
  expense: {
    id: string; merchant: string; amount: string | number; currency: string; memo: string;
    status: string; policyResult: string; receiptId: string | null; transactionId: string | null; userId: string;
  };
  receipt: {
    id: string; merchantGuess: string | null; amountGuess: string | number | null;
    matchStatus: string; ocrStatus: string; attachmentId: string;
  } | null;
  attachment: { id: string; originalName: string; mimeType: string; malwareStatus: string } | null;
  splits: Array<{ id: string; amount: string | number; category: string; department: string }>;
  transaction: { id: string; status: string; merchant: string; amount: string | number } | null;
  requirements?: { requirements: Array<{ key: string; label: string; status: string }>; complete: boolean; missing: string[] };
  timeline?: Array<{ id: string; action: string; createdAt: string }>;
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
  const [splitDraft, setSplitDraft] = useState({ amount: "", category: "GENERAL", department: "" });

  const detail = useQuery({
    queryKey: ["expense-detail", params.id],
    queryFn: async () => {
      const payload = await api.get<ExpenseDetail>(`/expenses/${params.id}`);
      setMemo(payload.expense.memo ?? "");
      return payload;
    },
  });

  const saveMemo = useMutation({
    mutationFn: () => api.post(`/expenses/${params.id}/update-memo`, { memo }),
    onSuccess: () => {
      setMessage("Memo saved.");
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
    },
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/expenses/${params.id}/submit`, {}),
    onSuccess: () => {
      setMessage("Expense submitted for review.");
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/expenses/${params.id}/approve`, {}),
    onSuccess: () => {
      setMessage("Expense approved.");
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "expenses"] });
    },
  });

  const attachReceipt = useMutation({
    mutationFn: async () => {
      if (!fileContent) throw Object.assign(new Error("Choose a PDF, PNG, or JPEG first"), { message: "Choose a PDF, PNG, or JPEG first" });
      const uploaded = await api.post<{ id: string }>("/documents/upload", {
        name: fileName || "receipt.png",
        mimeType: fileName.toLowerCase().endsWith(".pdf") ? "application/pdf"
          : fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg") ? "image/jpeg"
            : "image/png",
        classification: "RECEIPT",
        contentBase64: fileContent,
      });
      return api.post("/receipts", { attachmentId: uploaded.id, expenseId: params.id });
    },
    onSuccess: () => {
      setMessage("Receipt linked.");
      setFileContent("");
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
    },
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
        splits: [...existing, { amount: splitDraft.amount, category: splitDraft.category, department: splitDraft.department }],
      });
    },
    onSuccess: () => {
      setMessage("Split saved.");
      setSplitDraft({ amount: "", category: "GENERAL", department: "" });
      void queryClient.invalidateQueries({ queryKey: ["expense-detail", params.id] });
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
    return <div className="error-panel">Could not load expense. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading expense…</p>;

  const data = detail.data;
  const canEdit = ["INCOMPLETE", "REJECTED"].includes(data.expense.status)
    && (session?.userId === data.expense.userId || session?.roles.includes("Owner") || session?.permissions.includes("*"));
  const canApprove = ["SUBMITTED", "IN_REVIEW"].includes(data.expense.status)
    && (session?.roles.includes("Owner") || session?.permissions.includes("*") || session?.permissions.includes("expense.approve"));

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={data.expense.merchant || "Expense"} subtitle={money(data.expense.currency, data.expense.amount)} />
      <Link className="btn btn-ghost" href="/app/me/expenses">Back</Link>
    </div>

    {message && <p className="notice" role="status">{message}</p>}
    {(saveMemo.isError || submit.isError || approve.isError || attachReceipt.isError || saveSplit.isError) && (
      <p className="error" role="alert">{(saveMemo.error ?? submit.error ?? approve.error ?? attachReceipt.error ?? saveSplit.error)?.message}</p>
    )}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={data.expense.status} /></strong><small>Policy {data.expense.policyResult}</small></article>
      <article className="kpi-card"><span>Receipt</span><strong>{data.receipt ? data.receipt.matchStatus : "Missing"}</strong><small>{data.attachment?.originalName ?? "Upload required above threshold"}</small></article>
      <article className="kpi-card"><span>Transaction</span><strong>{data.transaction ? <StatusBadge status={data.transaction.status} /> : "—"}</strong><small>{data.transaction ? money(data.expense.currency, data.transaction.amount) : "Manual expense"}</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Requirements</h2>
        <ul className="stack gap-sm">
          {(data.requirements?.requirements ?? [
            { key: "receipt", label: "Receipt", status: data.receipt ? "Complete" : "Missing" },
            { key: "memo", label: "Business purpose", status: data.expense.memo?.trim() ? "Complete" : "Missing" },
            { key: "category", label: "Category", status: data.expense.merchant ? "Complete" : "Missing" },
          ]).map((row) => (
            <li key={row.key} className="row between">
              <span>{row.label}</span>
              <span>{row.status === "Complete" ? "✓ Complete" : "! Missing"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="work-panel">
        <h2>Completion</h2>
        {canEdit ? <form className="record-form" onSubmit={(event) => { event.preventDefault(); saveMemo.mutate(); }}>
          <label>Business purpose / memo<textarea className="input" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} /></label>
          <button className="btn btn-primary" type="submit" disabled={saveMemo.isPending}>{saveMemo.isPending ? "Saving…" : "Save memo"}</button>
        </form> : <dl className="detail-list"><div><dt>Memo</dt><dd>{data.expense.memo || "—"}</dd></div></dl>}

        {canEdit && <form className="record-form" onSubmit={(event) => { event.preventDefault(); attachReceipt.mutate(); }}>
          <h3>Attach receipt</h3>
          <label>File<input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          <button className="btn btn-primary" type="submit" disabled={attachReceipt.isPending || !fileContent}>{attachReceipt.isPending ? "Uploading…" : "Upload & link"}</button>
        </form>}

        {data.receipt && <dl className="detail-list">
          <div><dt>OCR merchant</dt><dd>{data.receipt.merchantGuess || "—"}</dd></div>
          <div><dt>OCR amount</dt><dd>{data.receipt.amountGuess != null ? String(data.receipt.amountGuess) : "—"}</dd></div>
          <div><dt>OCR status</dt><dd>{data.receipt.ocrStatus}</dd></div>
          <div><dt>File</dt><dd>{data.attachment?.originalName ?? data.receipt.attachmentId.slice(0, 8)} · {data.attachment?.malwareStatus ?? "—"}</dd></div>
        </dl>}

        <div className="detail-actions">
          {canEdit && <button className="btn btn-primary" type="button" disabled={submit.isPending} onClick={() => submit.mutate()}>Submit expense</button>}
          {canApprove && <button className="btn btn-primary" type="button" disabled={approve.isPending} onClick={() => approve.mutate()}>Approve</button>}
        </div>
      </section>

      <section className="work-panel">
        <h2>Splits</h2>
        {data.splits.length === 0 ? <p className="muted">No splits yet. Full amount stays on the expense.</p> : (
          <ul className="split-list">{data.splits.map((row) => (
            <li key={row.id}>{money(data.expense.currency, row.amount)} · {row.category}{row.department ? ` · ${row.department}` : ""}</li>
          ))}</ul>
        )}
        {canEdit && <form className="record-form" onSubmit={(event) => { event.preventDefault(); saveSplit.mutate(); }}>
          <label>Amount<input className="input" type="number" step="0.01" required value={splitDraft.amount} onChange={(e) => setSplitDraft({ ...splitDraft, amount: e.target.value })} /></label>
          <label>Category<input className="input" required value={splitDraft.category} onChange={(e) => setSplitDraft({ ...splitDraft, category: e.target.value })} /></label>
          <label>Department<input className="input" value={splitDraft.department} onChange={(e) => setSplitDraft({ ...splitDraft, department: e.target.value })} /></label>
          <button className="btn btn-ghost" type="submit" disabled={saveSplit.isPending}>Add split line</button>
          <p className="muted">Splits must eventually total {money(data.expense.currency, data.expense.amount)}.</p>
        </form>}
      </section>
    </div>
  </div>;
}
