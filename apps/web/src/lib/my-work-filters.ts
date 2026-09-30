/** Shared filters for My expenses / requests / reimbursements / travel lists. */

export const DEFAULT_NEW_WITHIN_DAYS = 7;

export type MyWorkFocus = "ALL" | "NEW" | "NEEDS_ACTION" | string;

export function isNewRecord(createdAt: unknown, withinDays = DEFAULT_NEW_WITHIN_DAYS): boolean {
  if (!createdAt) return false;
  const time = new Date(String(createdAt)).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= withinDays * 24 * 60 * 60 * 1000;
}

/** Statuses that typically need the employee/holder to act. */
export const MY_WORK_NEEDS_ACTION: Record<string, string[]> = {
  expenses: ["INCOMPLETE", "REJECTED", "DRAFT"],
  "spend-requests": ["DRAFT", "REJECTED", "BLOCKED", "NEEDS_INFO"],
  reimbursements: ["DRAFT", "NEEDS_INFO", "FAILED"],
  travel: ["DRAFT", "READY_TO_BOOK", "BLOCKED", "BOOKING"],
  transactions: ["PENDING"],
  procurement: ["DRAFT", "IN_REVIEW"],
  "purchase-orders": ["ISSUED", "OPEN", "PARTIALLY_RECEIVED"],
  payments: ["SCHEDULED", "PROCESSING"],
  "payment-runs": ["OPEN"],
};

export function focusLabel(focus: MyWorkFocus): string {
  if (focus === "ALL") return "All";
  if (focus === "NEW") return "New";
  if (focus === "NEEDS_ACTION") return "Needs action";
  return focus.replaceAll("_", " ");
}
