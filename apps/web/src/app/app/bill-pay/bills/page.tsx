"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ResourcePage } from "@/components/ResourcePage";

type Bill = { id: string; status: string; dueDate?: string | null; amount: string; currency: string };
type Stage = "Overview" | "Drafts" | "For approval" | "For payment" | "History" | "Urgent";

const stages: Stage[] = ["Overview", "Drafts", "For approval", "For payment", "History", "Urgent"];
const statusGroups: Partial<Record<Stage, string[]>> = {
  Drafts: ["DRAFT", "NEEDS_REVIEW"],
  "For approval": ["PENDING_APPROVAL", "IN_REVIEW"],
  "For payment": ["APPROVED", "PARTIAL"],
  History: ["PAID", "REJECTED", "CANCELLED"],
};

function isUrgent(bill: { status?: string; dueDate?: unknown }) {
  if (!["DRAFT", "NEEDS_REVIEW", "PENDING_APPROVAL", "IN_REVIEW", "APPROVED", "PARTIAL"].includes(bill.status ?? "")) return false;
  if (!bill.dueDate) return false;
  const due = new Date(String(bill.dueDate)).getTime();
  return Number.isFinite(due) && due <= Date.now() + 7 * 24 * 60 * 60 * 1000;
}

export default function Page() {
  const router = useRouter();
  const search = useSearchParams();
  const initial = (search.get("stage") as Stage | null) ?? "Overview";
  const [stage, setStage] = useState<Stage>(stages.includes(initial) ? initial : "Overview");
  useEffect(() => {
    if (stages.includes(initial)) setStage(initial);
  }, [initial]);
  const bills = useQuery({ queryKey: ["resource", "bills", ""], queryFn: () => api.get<Bill[]>("/bills") });
  const rows = bills.data ?? [];
  const counts: Record<Stage, number> = {
    Overview: rows.length,
    Drafts: rows.filter((row) => statusGroups.Drafts?.includes(row.status)).length,
    "For approval": rows.filter((row) => statusGroups["For approval"]?.includes(row.status)).length,
    "For payment": rows.filter((row) => statusGroups["For payment"]?.includes(row.status)).length,
    History: rows.filter((row) => statusGroups.History?.includes(row.status)).length,
    Urgent: rows.filter(isUrgent).length,
  };

  return <div>
    <div className="stage-heading">
      <p>Bill Pay</p>
      <h1>Payables workspace</h1>
      <span>Review invoices, approve bills, schedule payments, and release them through a separate payment gate.</span>
    </div>
    <div className="stage-tabs" role="tablist" aria-label="Bill stages">
      {stages.map((item) => <button key={item} role="tab" aria-selected={stage === item} type="button" className={stage === item ? "active" : ""} onClick={() => setStage(item)}>{item}<span>{counts[item]}</span></button>)}
    </div>
    <ResourcePage
      title={stage === "Overview" ? "All bills" : stage}
      path="bills"
      filter={statusGroups[stage] ? { status: statusGroups[stage] } : undefined}
      predicate={stage === "Urgent" ? isUrgent : undefined}
      actions={[{ label: "Submit", name: "submit" }, { label: "Approve", name: "approve" }]}
      onRowNavigate={(row) => router.push(`/app/bill-pay/bills/${row.id}`)}
    />
  </div>;
}
