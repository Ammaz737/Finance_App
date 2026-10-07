"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Candidate = {
  id: string;
  merchant: string;
  amount: string | number;
  currency: string;
  createdAt: string;
  transactionId: string | null;
  status: string;
  score: number;
  reasons: string[];
  employee?: { firstName: string; lastName: string; email: string };
};

type Detail = {
  receipt: {
    id?: string;
    merchantGuess: string | null;
    amountGuess: string | number | null;
    matchStatus: string;
    ocrStatus?: string;
    expenseId?: string | null;
    transactionId?: string | null;
  };
  candidates: Candidate[];
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function ReceiptLinkPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const [search, setSearch] = useState("");

  const detail = useQuery({
    queryKey: ["receipt-candidates", id, search],
    queryFn: () => api.get<Detail>(`/receipts/${id}${search ? `?q=${encodeURIComponent(search)}` : ""}`),
  });

  const link = useMutation({
    mutationFn: (expenseId: string) => api.post(`/receipts/${id}/link`, { expenseId }),
    onSuccess: (_result, expenseId) => router.push(`/app/expenses/${expenseId}`),
  });

  const canSeeReceipts = session
    ? canSeeItem(
        findNavItem("/app/expenses/receipts") ?? { href: "/app/expenses/receipts", permission: "expense.create" },
        session,
      )
    : false;
  const canSeeMyExpenses = session
    ? canSeeItem(
        findNavItem("/app/me/expenses") ?? {
          href: "/app/me/expenses",
          permissions: ["expense.read", "expense.create"],
        },
        session,
      )
    : false;

  const backHref = canSeeReceipts ? "/app/expenses/receipts" : canSeeMyExpenses ? "/app/me/expenses" : "/app/home";
  const backLabel =
    backHref === "/app/expenses/receipts"
      ? "Back to receipts"
      : backHref === "/app/me/expenses"
        ? "Back to my expenses"
        : "Back to overview";

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load receipt.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const receipt = detail.data?.receipt;
  const alreadyLinked = Boolean(receipt?.expenseId) || receipt?.matchStatus === "MATCHED";
  const candidates = detail.data?.candidates ?? [];

  return (
    <div className="detail-page receipt-link-page">
      <div className="resource-heading">
        <PageHeader
          title="Link receipt"
          subtitle="Search by employee, merchant, amount, date, transaction, or expense id."
        />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      <div className="overview-stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <article className="overview-stat">
          <span>Merchant guess</span>
          <strong>{receipt?.merchantGuess?.trim() || "Unknown"}</strong>
          <small>From OCR / upload filename</small>
        </article>
        <article className="overview-stat">
          <span>Amount guess</span>
          <strong>{receipt?.amountGuess != null ? String(receipt.amountGuess) : "—"}</strong>
          <small>
            <StatusBadge status={receipt?.matchStatus ?? "UNMATCHED"} />
          </small>
        </article>
        <article className="overview-stat">
          <span>OCR</span>
          <strong>
            <StatusBadge status={receipt?.ocrStatus ?? "PENDING"} />
          </strong>
          <small>{candidates.length} candidate{candidates.length === 1 ? "" : "s"}</small>
        </article>
      </div>

      {alreadyLinked && receipt?.expenseId ? (
        <section className="panel">
          <h2>Already linked</h2>
          <p className="notice" role="status">
            This receipt is linked to an expense.
          </p>
          <Link className="btn btn-primary" href={`/app/expenses/${receipt.expenseId}`}>
            Open linked expense
          </Link>
        </section>
      ) : null}

      <section className="panel">
        <h2>{alreadyLinked ? "Other candidates" : "Find expense"}</h2>
        <div className="form-grid">
          <label>
            Search candidates
            <input
              className="input"
              placeholder="Employee, merchant, amount, date, transaction, or expense"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {link.isError && (
          <p className="error" role="alert">
            {link.error.message}
          </p>
        )}
        {detail.isPending ? (
          <p className="muted">Loading candidates…</p>
        ) : candidates.length === 0 ? (
          <p className="muted">No expense candidates match this search.</p>
        ) : (
          <ul className="plain-list receipt-candidate-list">
            {candidates.map((candidate) => {
              const employee = candidate.employee
                ? `${candidate.employee.firstName} ${candidate.employee.lastName}`.trim() ||
                  candidate.employee.email
                : "Employee";
              const isCurrent = receipt?.expenseId === candidate.id;
              return (
                <li key={candidate.id} className="receipt-candidate">
                  <div className="receipt-candidate-main">
                    <strong>{candidate.merchant}</strong>
                    <span>{money(candidate.currency, candidate.amount)}</span>
                    <StatusBadge status={candidate.status} />
                  </div>
                  <div className="muted">
                    {employee} · score {candidate.score}
                    {candidate.reasons.length ? ` · ${candidate.reasons.join(", ")}` : ""} ·{" "}
                    {new Date(candidate.createdAt).toLocaleDateString()}
                    {candidate.transactionId ? ` · txn ${candidate.transactionId.slice(0, 8)}` : ""}
                  </div>
                  {isCurrent ? (
                    <Link className="btn btn-ghost" href={`/app/expenses/${candidate.id}`}>
                      Linked — open expense
                    </Link>
                  ) : (
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={link.isPending}
                      onClick={() => link.mutate(candidate.id)}
                    >
                      Link to this expense
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
