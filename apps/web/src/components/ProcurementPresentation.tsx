import { WorkSummary } from "./PersonalWorkPresentation";

type Row = { status?: string; outcomeType?: unknown; purchaseOrderId?: unknown; receivedBy?: unknown; memo?: unknown; requireReceiving?: unknown; matchStatus?: unknown; defaultOutcomeType?: unknown };

export function ProcurementOverview({ kind, rows, loading }: { kind: "requests" | "programs" | "orders" | "receiving"; rows: Row[]; loading: boolean }) {
  const count = (...statuses: string[]) => rows.filter(row => statuses.includes(row.status ?? "")).length;
  const stats = {
    requests: [
      { label: "Draft requests", value: count("DRAFT"), note: "Not yet submitted for review", icon: "receipt" as const },
      { label: "Awaiting review", value: count("IN_REVIEW"), note: "Requests awaiting a decision", icon: "clock" as const },
      { label: "Approved / fulfilled", value: count("APPROVED", "FULFILLED"), note: "Approved procurement requests", icon: "check" as const },
      { label: "PO requests", value: rows.filter(row => row.outcomeType === "PURCHASE_ORDER").length, note: "Purchase order requested", icon: "card" as const },
    ],
    programs: [
      { label: "Total programs", value: rows.length, note: "Procurement intake programs", icon: "receipt" as const },
      { label: "Active", value: count("ACTIVE"), note: "Available for new requests", icon: "check" as const },
      { label: "Receiving required", value: rows.filter(row => row.requireReceiving !== false).length, note: "Goods or services confirmation", icon: "card" as const },
      { label: "PO programs", value: rows.filter(row => row.defaultOutcomeType === "PURCHASE_ORDER").length, note: "Purchase order fulfillment", icon: "clock" as const },
    ],
    orders: [
      { label: "Open orders", value: count("ISSUED", "OPEN"), note: "Orders awaiting receiving", icon: "receipt" as const },
      { label: "Partially received", value: count("PARTIALLY_RECEIVED"), note: "Deliveries still outstanding", icon: "clock" as const },
      { label: "Received", value: count("RECEIVED"), note: "Receiving completed", icon: "check" as const },
      { label: "Match exceptions", value: rows.filter(row => ["EXCEPTION", "BLOCKED"].includes(String(row.matchStatus))).length, note: "Matching requires follow-up", icon: "alert" as const },
    ],
    receiving: [
      { label: "Receiving records", value: rows.length, note: "Goods and services received", icon: "receipt" as const },
      { label: "Purchase orders", value: new Set(rows.map(row => row.purchaseOrderId).filter(Boolean)).size, note: "Orders with receiving records", icon: "card" as const },
      { label: "Received by", value: new Set(rows.map(row => row.receivedBy).filter(Boolean)).size, note: "People recording deliveries", icon: "check" as const },
      { label: "With notes", value: rows.filter(row => typeof row.memo === "string" && row.memo.trim()).length, note: "Records with delivery notes", icon: "clock" as const },
    ],
  };
  return <WorkSummary stats={stats[kind]} loading={loading}/>;
}
