"use client";

import Link from "next/link";
import { StatusBadge, type Column } from "@finance/design-system";
import { ResourcePage } from "@/components/ResourcePage";

type RuleRow = {
  id: string;
  name?: string;
  sourceType?: string;
  category?: string;
  glAccount?: string;
  priority?: number | string;
  enabled?: boolean;
  createdAt?: string;
};

function sourceLabel(value?: string) {
  if (value === "CARD_TRANSACTION") return "Card";
  if (value === "REIMBURSEMENT") return "Reimbursement";
  if (value === "BILL") return "Bill";
  if (value === "PAYMENT") return "Payment";
  return value || "Any";
}

export default function Page() {
  const columns: Column<RuleRow>[] = [
    {
      key: "name",
      header: "Rule",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.name || "Coding rule"}</strong>
          <small>
            {sourceLabel(row.sourceType)} → {row.category || "category"}
            {row.glAccount ? ` / ${row.glAccount}` : ""}
          </small>
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => String(row.priority ?? "—"),
    },
    {
      key: "enabled",
      header: "Enabled",
      render: (row) => <StatusBadge status={row.enabled === false ? "DISABLED" : "ENABLED"} />,
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"),
    },
  ];

  return (
    <div className="accounting-queue-page">
      <ResourcePage title="Accounting rules" path="accounting-rules" columns={columns} pageSize={20} />
      <p className="muted my-expenses-hint">
        Lower priority runs first when a source enters the queue. Review unmatched rows in{" "}
        <Link className="detail-link" href="/app/accounting/review">
          Needs review
        </Link>
        .
      </p>
    </div>
  );
}
