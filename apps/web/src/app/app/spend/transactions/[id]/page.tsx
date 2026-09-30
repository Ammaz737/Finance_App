"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type TxnDetail = {
  transaction: {
    id: string;
    merchant: string;
    amount: string | number;
    currency: string;
    status: string;
    memo: string;
    authorizedAt: string;
    clearedAt: string | null;
    capturedAmount: string | number | null;
    voidedAt: string | null;
    reversedAt: string | null;
    cardId: string | null;
    fundId: string | null;
    vendorId: string | null;
    authorizationId: string | null;
  };
  card: {
    id: string;
    last4: string;
    status: string;
    type: string;
    network: string;
    holderId: string;
    fundId: string;
    merchantLock: string | null;
  } | null;
  holder: { id: string; firstName: string; lastName: string; email: string } | null;
  fund: {
    id: string;
    name: string;
    status: string;
    availableAmount: string | number;
    limitAmount: string | number;
    currency: string;
    ownerId: string;
  } | null;
  expense: {
    id: string;
    merchant: string;
    amount: string | number;
    currency: string;
    status: string;
    policyResult: string;
    userId: string;
    receiptId: string | null;
  } | null;
  authorization: {
    id: string;
    decision: string;
    reason: string | null;
    amount: string | number;
    currency: string;
    merchant: string;
    createdAt: string;
  } | null;
  vendor: { id: string; name: string; status: string } | null;
  audit: Array<{ id: string; action: string; createdAt: string; actorId?: string | null }>;
};

function money(currency: string, value: string | number) {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)}`;
}

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const sandbox = process.env.NODE_ENV !== "production";
  const [message, setMessage] = useState("");

  const detail = useQuery({
    queryKey: ["transaction-detail", params.id],
    queryFn: () => api.get<TxnDetail>(`/transactions/${params.id}`),
  });

  const runAction = useMutation({
    mutationFn: (name: string) => api.post(`/transactions/${params.id}/${name}`, {}),
    onSuccess: (_result, name) => {
      setMessage(`${name} completed.`);
      void queryClient.invalidateQueries({ queryKey: ["transaction-detail", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "transactions"] });
    },
  });

  if (detail.isError) {
    return (
      <div className="error-panel" role="alert">
        Could not load transaction.{" "}
        <button className="text-button" type="button" onClick={() => void detail.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading transaction…</p>;

  const data = detail.data;
  const txn = data.transaction;
  const holderName = data.holder
    ? `${data.holder.firstName} ${data.holder.lastName}`.trim() || data.holder.email
    : "—";
  const isMine = Boolean(
    session?.userId &&
      (data.card?.holderId === session.userId ||
        data.fund?.ownerId === session.userId ||
        data.expense?.userId === session.userId),
  );
  const canIssue = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("card.issue"),
  );
  const canSeeTransactions = session
    ? canSeeItem(
        findNavItem("/app/spend/transactions") ?? {
          href: "/app/spend/transactions",
          permissions: ["expense.read", "card.read"],
        },
        session,
      )
    : false;
  const canSeeCorporateCards = session
    ? canSeeItem(findNavItem("/app/cards") ?? { href: "/app/cards", permission: "card.issue" }, session)
    : false;
  const canSeeFunds = session
    ? canSeeItem(findNavItem("/app/spend/funds") ?? { href: "/app/spend/funds", permission: "card.read" }, session)
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
  const canSeeExpenseReview = session
    ? canSeeItem(
        findNavItem("/app/expenses/transactions") ?? {
          href: "/app/expenses/transactions",
          permission: "expense.approve",
        },
        session,
      )
    : false;
  const canSeeVendors = session
    ? canSeeItem(findNavItem("/app/vendors") ?? { href: "/app/vendors", permission: "vendor.read" }, session)
    : false;

  const backHref = canSeeTransactions ? "/app/spend/transactions" : isMine ? "/app/me/cards" : "/app/home";
  const backLabel =
    backHref === "/app/spend/transactions"
      ? "Back to transactions"
      : backHref === "/app/me/cards"
        ? "Back to my card"
        : "Back to overview";

  const cardHref = data.card
    ? isMine || !canSeeCorporateCards
      ? `/app/me/cards/${data.card.id}`
      : `/app/cards/${data.card.id}`
    : null;
  const fundHref = data.fund && canSeeFunds ? `/app/spend/funds/${data.fund.id}` : null;
  const expenseHref = data.expense
    ? canSeeExpenseReview || canSeeMyExpenses || isMine
      ? `/app/expenses/${data.expense.id}`
      : null
    : null;
  const vendorHref = data.vendor && canSeeVendors ? `/app/vendors/${data.vendor.id}` : null;

  const pendingActions =
    sandbox && canIssue && txn.status === "PENDING"
      ? [
          { label: "Capture", name: "capture" },
          { label: "Void", name: "void" },
          { label: "Simulate clearing", name: "clear" },
        ]
      : [];
  const clearedActions =
    sandbox && canIssue && txn.status === "CLEARED" ? [{ label: "Reverse", name: "reverse" }] : [];
  const actions = [...pendingActions, ...clearedActions];

  return (
    <div className="detail-page txn-detail-page">
      <div className="resource-heading">
        <PageHeader title={txn.merchant || "Transaction"} subtitle={money(txn.currency, txn.amount)} />
        <Link className="btn btn-ghost" href={backHref}>
          {backLabel}
        </Link>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {runAction.isError && (
        <p className="error" role="alert">
          {runAction.error.message}
        </p>
      )}

      <div className="overview-stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <article className="overview-stat">
          <span>Status</span>
          <strong>
            <StatusBadge status={txn.status} />
          </strong>
          <small>
            Auth {txn.authorizedAt ? new Date(txn.authorizedAt).toLocaleString() : "—"}
          </small>
        </article>
        <article className="overview-stat">
          <span>Cleared</span>
          <strong>
            {txn.clearedAt
              ? money(txn.currency, txn.capturedAmount ?? txn.amount)
              : "—"}
          </strong>
          <small>
            {txn.clearedAt
              ? new Date(txn.clearedAt).toLocaleString()
              : txn.status === "PENDING"
                ? "Hold open"
                : "Not cleared"}
          </small>
        </article>
        {expenseHref ? (
          <Link href={expenseHref} className="overview-stat">
            <span>Expense</span>
            <strong>
              <StatusBadge status={data.expense!.status} />
            </strong>
            <small>
              {data.expense!.receiptId ? "Receipt linked" : "Receipt may be needed"} · Open →
            </small>
          </Link>
        ) : (
          <article className="overview-stat">
            <span>Expense</span>
            <strong>{data.expense ? <StatusBadge status={data.expense.status} /> : "—"}</strong>
            <small>{data.expense ? "Linked" : "Created on capture"}</small>
          </article>
        )}
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h2>Activity</h2>
          <dl className="detail-list">
            <div>
              <dt>Merchant</dt>
              <dd>{txn.merchant}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{money(txn.currency, txn.amount)}</dd>
            </div>
            <div>
              <dt>Memo</dt>
              <dd>{txn.memo?.trim() || "—"}</dd>
            </div>
            {data.authorization && (
              <div>
                <dt>Authorization</dt>
                <dd>
                  <StatusBadge status={data.authorization.decision} />
                  {data.authorization.reason ? ` · ${data.authorization.reason}` : ""}
                </dd>
              </div>
            )}
            {txn.voidedAt && (
              <div>
                <dt>Voided</dt>
                <dd>{new Date(txn.voidedAt).toLocaleString()}</dd>
              </div>
            )}
            {txn.reversedAt && (
              <div>
                <dt>Reversed</dt>
                <dd>{new Date(txn.reversedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          {actions.length > 0 && (
            <div className="detail-actions" style={{ marginTop: 16 }}>
              {actions.map((item) => (
                <button
                  key={item.name}
                  className={`btn ${item.name === "void" || item.name === "reverse" ? "btn-danger" : "btn-primary"}`}
                  type="button"
                  disabled={runAction.isPending}
                  onClick={() => {
                    if (
                      (item.name === "void" || item.name === "reverse") &&
                      !window.confirm(`Confirm ${item.label.toLowerCase()} for this transaction?`)
                    ) {
                      return;
                    }
                    setMessage("");
                    runAction.mutate(item.name);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {sandbox && canIssue && (
            <p className="muted" style={{ marginTop: 12 }}>
              Capture, void, and reverse are sandbox controls for issued cards.
            </p>
          )}
        </section>

        <section className="panel work-panel">
          <h2>Related</h2>
          <dl className="detail-list">
            <div>
              <dt>Cardholder</dt>
              <dd>{holderName}</dd>
            </div>
            <div>
              <dt>Card</dt>
              <dd>
                {data.card ? (
                  cardHref ? (
                    <Link className="detail-link" href={cardHref}>
                      •••• {data.card.last4} · {data.card.status} →
                    </Link>
                  ) : (
                    <>
                      •••• {data.card.last4} · {data.card.status}
                    </>
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Fund</dt>
              <dd>
                {data.fund ? (
                  fundHref ? (
                    <Link className="detail-link" href={fundHref}>
                      {data.fund.name} →
                    </Link>
                  ) : (
                    data.fund.name
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Expense</dt>
              <dd>
                {data.expense ? (
                  expenseHref ? (
                    <Link className="detail-link" href={expenseHref}>
                      {data.expense.merchant} · {data.expense.status} →
                    </Link>
                  ) : (
                    `${data.expense.merchant} · ${data.expense.status}`
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Vendor</dt>
              <dd>
                {data.vendor ? (
                  vendorHref ? (
                    <Link className="detail-link" href={vendorHref}>
                      {data.vendor.name} →
                    </Link>
                  ) : (
                    data.vendor.name
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {data.audit.length > 0 && (
        <section className="panel">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h2>Timeline</h2>
            <span>{data.audit.length}</span>
          </div>
          <div className="timeline">
            {data.audit.map((item) => (
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
