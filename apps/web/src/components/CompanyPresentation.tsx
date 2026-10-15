import { WorkSummary } from "./PersonalWorkPresentation";

type Row = { id: string; status?: string; country?: unknown; currency?: unknown };

export function CompanyOverview({ kind, rows, loading }: { kind: "entities" | "people"; rows: Row[]; loading: boolean }) {
  const count = (status: string) => rows.filter(row => row.status === status).length;
  return <WorkSummary loading={loading} stats={kind === "entities" ? [
    { label: "Legal entities", value: rows.length, note: "Company entities in this view", icon: "receipt" },
    { label: "Active", value: rows.filter(row => !row.status || row.status === "ACTIVE").length, note: "Active entity records", icon: "check" },
    { label: "Countries", value: new Set(rows.map(row => row.country).filter(Boolean)).size, note: "Countries across your entities", icon: "card" },
    { label: "Currencies", value: new Set(rows.map(row => row.currency).filter(Boolean)).size, note: "Entity accounting currencies", icon: "clock" },
  ] : [
    { label: "People in view", value: rows.length, note: "People in the selected view", icon: "receipt" },
    { label: "Active", value: count("ACTIVE"), note: "Active employee accounts", icon: "check" },
    { label: "Draft / invite", value: count("DRAFT"), note: "Accounts awaiting activation", icon: "clock" },
    { label: "Suspended", value: count("SUSPENDED"), note: "Suspended employee accounts", icon: "alert" },
  ]}/>;
}
