import { WorkSummary } from "./PersonalWorkPresentation";

type Row = { id: string; status?: string; policyResult?: unknown };

export function TravelOverview({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const count = (...statuses: string[]) => rows.filter(row => statuses.includes(row.status ?? "")).length;
  return <WorkSummary loading={loading} stats={[
    { label: "Trips in view", value: rows.length, note: "Trips in the selected view", icon: "plane" },
    { label: "Awaiting approval", value: count("PENDING_APPROVAL", "IN_REVIEW"), note: "Requests awaiting a decision", icon: "clock" },
    { label: "Needs booking", value: count("APPROVED", "READY_TO_BOOK", "BOOKING"), note: "Approved trips awaiting booking", icon: "card" },
    { label: "Booked / completed", value: count("BOOKED", "COMPLETED"), note: "Confirmed or completed trips", icon: "check" },
  ]}/>;
}
