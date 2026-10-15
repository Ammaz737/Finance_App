import { WorkSummary } from "./PersonalWorkPresentation";

type Budget = { id: string; overBudget?: unknown; utilizationPct?: unknown };

export function BudgetOverview({ rows, loading }: { rows: Budget[]; loading: boolean }) {
  return <WorkSummary loading={loading} stats={[
    { label: "Budgets in view", value: rows.length, note: "Allocations in the selected view", icon: "receipt" },
    { label: "Below 80%", value: rows.filter(row => !row.overBudget && Number(row.utilizationPct ?? 0) < 80).length, note: "Budgets with spending headroom", icon: "check" },
    { label: "High utilization", value: rows.filter(row => !row.overBudget && Number(row.utilizationPct ?? 0) >= 80).length, note: "At least 80% of capacity used", icon: "clock" },
    { label: "Over budget", value: rows.filter(row => Boolean(row.overBudget)).length, note: "Spending exceeds allocation", icon: "alert" },
  ]}/>;
}
