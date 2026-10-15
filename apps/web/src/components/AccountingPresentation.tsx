import { WorkSummary } from "./PersonalWorkPresentation";

type Row = { status?: string; category?: unknown; externalId?: unknown; sourceType?: unknown; enabled?: unknown; provider?: unknown; lastSyncAt?: unknown };

export function AccountingOverview({ kind, rows, loading }: { kind: "entries" | "rules" | "integrations"; rows: Row[]; loading: boolean }) {
  const unique = (key: "sourceType" | "provider") => new Set(rows.map(row => row[key]).filter(Boolean)).size;
  const stats = {
    entries: [
      { label: "Queue entries", value: rows.length, note: "Entries in this accounting view", icon: "receipt" as const },
      { label: "With category", value: rows.filter(row => typeof row.category === "string" && row.category.trim()).length, note: "Category assigned to the entry", icon: "card" as const },
      { label: "Provider reference", value: rows.filter(row => Boolean(row.externalId)).length, note: "Entries with an external posting ID", icon: "check" as const },
      { label: "Sync errors", value: rows.filter(row => row.status === "SYNC_ERROR").length, note: "Entries requiring follow-up", icon: "alert" as const },
    ],
    rules: [
      { label: "Total rules", value: rows.length, note: "Automatic coding rules", icon: "receipt" as const },
      { label: "Enabled", value: rows.filter(row => row.enabled !== false).length, note: "Available for automatic coding", icon: "check" as const },
      { label: "Disabled", value: rows.filter(row => row.enabled === false).length, note: "Currently excluded from coding", icon: "clock" as const },
      { label: "Source types", value: unique("sourceType"), note: "Explicit source types across rules", icon: "card" as const },
    ],
    integrations: [
      { label: "Connectors", value: rows.length, note: "Providers registered in this workspace", icon: "card" as const },
      { label: "Providers", value: unique("provider"), note: "Distinct accounting providers", icon: "receipt" as const },
      { label: "Sync recorded", value: rows.filter(row => Boolean(row.lastSyncAt)).length, note: "Connectors with a last sync time", icon: "clock" as const },
      { label: "Needs attention", value: rows.filter(row => ["ERROR", "FAILED", "DEGRADED", "DISCONNECTED"].includes(row.status ?? "")).length, note: "Connectors reporting an issue", icon: "alert" as const },
    ],
  };
  return <WorkSummary stats={stats[kind]} loading={loading}/>;
}
