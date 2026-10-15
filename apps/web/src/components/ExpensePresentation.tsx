import { WorkSummary } from "./PersonalWorkPresentation";

type Row = { status?: string; receiptId?: unknown; matchStatus?: unknown; ocrStatus?: unknown };

export function ExpenseOverview({ kind, rows, loading }: { kind: "review" | "receipts" | "reimbursements"; rows: Row[]; loading: boolean }) {
  const count = (...statuses: string[]) => rows.filter(row => statuses.includes(row.status ?? "")).length;
  const stats = {
    review: [
      { label: "Awaiting review", value: count("SUBMITTED", "IN_REVIEW"), note: "Expenses ready for a decision", icon: "clock" as const },
      { label: "Approved", value: count("APPROVED"), note: "Reviewed and approved expenses", icon: "check" as const },
      { label: "Missing receipts", value: rows.filter(row => !row.receiptId).length, note: "No receipt attached", icon: "receipt" as const },
      { label: "Needs follow-up", value: count("INCOMPLETE", "REJECTED", "NEEDS_INFO"), note: "Outstanding expense details", icon: "alert" as const },
    ],
    receipts: [
      { label: "Total receipts", value: rows.length, note: "Receipts in this view", icon: "receipt" as const },
      { label: "Unmatched", value: rows.filter(row => row.matchStatus === "UNMATCHED").length, note: "Ready to link to an expense", icon: "clock" as const },
      { label: "Matched", value: rows.filter(row => row.matchStatus === "MATCHED").length, note: "Matched receipt records", icon: "check" as const },
      { label: "OCR issues", value: rows.filter(row => ["FAILED", "ERROR"].includes(String(row.ocrStatus))).length, note: "Extraction needs attention", icon: "alert" as const },
    ],
    reimbursements: [
      { label: "For approval", value: count("IN_REVIEW"), note: "Claims awaiting approval", icon: "clock" as const },
      { label: "For payout", value: count("APPROVED", "READY_FOR_PAYOUT", "SCHEDULED"), note: "Approved or in-flight payouts", icon: "card" as const },
      { label: "Paid", value: count("PAID"), note: "Completed reimbursements", icon: "check" as const },
      { label: "Failed payouts", value: count("FAILED"), note: "Payouts requiring follow-up", icon: "alert" as const },
    ],
  };
  return <WorkSummary stats={stats[kind]} loading={loading}/>;
}
