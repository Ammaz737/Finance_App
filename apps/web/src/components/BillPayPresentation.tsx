import { WorkSummary } from "./PersonalWorkPresentation";

type Row = { status?: string; riskLevel?: unknown; paymentStatus?: unknown };

export function BillPayOverview({ kind, rows, loading }: { kind: "vendors" | "bills" | "payments" | "runs"; rows: Row[]; loading: boolean }) {
  const count = (...statuses: string[]) => rows.filter(row => statuses.includes(row.status ?? "")).length;
  const stats = {
    vendors: [
      { label: "Total vendors", value: rows.length, note: "Vendors in this workspace", icon: "receipt" as const },
      { label: "Active", value: count("ACTIVE"), note: "Current vendor relationships", icon: "check" as const },
      { label: "Needs bank details", value: rows.filter(row => !row.paymentStatus || row.paymentStatus === "NEEDS_BANK").length, note: "Payment setup outstanding", icon: "card" as const },
      { label: "High risk", value: rows.filter(row => row.riskLevel === "HIGH").length, note: "Vendors requiring closer review", icon: "alert" as const },
    ],
    bills: [
      { label: "Drafts / review", value: count("DRAFT", "NEEDS_REVIEW"), note: "Invoice details to complete", icon: "receipt" as const },
      { label: "For approval", value: count("PENDING_APPROVAL", "IN_REVIEW"), note: "Bills awaiting a decision", icon: "clock" as const },
      { label: "For payment", value: count("APPROVED", "PARTIAL"), note: "Approved bills with balances", icon: "card" as const },
      { label: "Paid", value: count("PAID"), note: "Fully settled invoices", icon: "check" as const },
    ],
    payments: [
      { label: "Scheduled", value: count("SCHEDULED"), note: "Awaiting payment release", icon: "clock" as const },
      { label: "Processing", value: count("PROCESSING"), note: "Released and in flight", icon: "card" as const },
      { label: "Settled", value: count("SETTLED"), note: "Completed settlements", icon: "check" as const },
      { label: "Failed", value: count("FAILED"), note: "Payments requiring follow-up", icon: "alert" as const },
    ],
    runs: [
      { label: "Total runs", value: rows.length, note: "Payment batch records", icon: "receipt" as const },
      { label: "Open", value: count("OPEN"), note: "Batches available to prepare", icon: "clock" as const },
      { label: "Released", value: count("RELEASED"), note: "Batches released for processing", icon: "check" as const },
      { label: "Cancelled", value: count("CANCELLED"), note: "Cancelled batch records", icon: "alert" as const },
    ],
  };
  return <WorkSummary stats={stats[kind]} loading={loading}/>;
}
