export type ReimbursementRequirement = {
  key: string;
  label: string;
  status: "Complete" | "Missing";
};

/** Checklist for GF4 reimbursements — STANDARD may require receipt; mileage/per diem differ. */
export function evaluateReimbursementRequirements(input: {
  type: "STANDARD" | "MILEAGE" | "PER_DIEM";
  hasReceipt: boolean;
  hasMemo: boolean;
  hasCategory: boolean;
  hasDistance?: boolean;
  hasPerDiemDays?: boolean;
  hasDestination?: boolean;
  requireReceipt: boolean;
  policyRequiredActions?: string[];
}): { requirements: ReimbursementRequirement[]; complete: boolean; missing: string[] } {
  const requirements: ReimbursementRequirement[] = [
    { key: "memo", label: "Business purpose", status: input.hasMemo ? "Complete" : "Missing" },
  ];
  if (input.type === "STANDARD") {
    if (input.requireReceipt) {
      requirements.push({ key: "receipt", label: "Receipt", status: input.hasReceipt ? "Complete" : "Missing" });
    }
    const categoryRequired = (input.policyRequiredActions ?? []).some((a) => /category/i.test(a));
    if (categoryRequired || input.hasCategory) {
      requirements.push({ key: "category", label: "Category", status: input.hasCategory ? "Complete" : "Missing" });
    }
  }
  if (input.type === "MILEAGE") {
    requirements.push({ key: "distance", label: "Distance", status: input.hasDistance ? "Complete" : "Missing" });
  }
  if (input.type === "PER_DIEM") {
    requirements.push({ key: "days", label: "Eligible days", status: input.hasPerDiemDays ? "Complete" : "Missing" });
    if (input.hasDestination) {
      requirements.push({ key: "destination", label: "Destination", status: "Complete" });
    }
  }
  for (const action of input.policyRequiredActions ?? []) {
    if (requirements.some((row) => row.label.toLowerCase() === action.toLowerCase())) continue;
    if (/receipt/i.test(action) && input.hasReceipt) continue;
    if (/memo|purpose/i.test(action) && input.hasMemo) continue;
    if (/category/i.test(action) && input.hasCategory) continue;
    if (/distance/i.test(action) && input.hasDistance) continue;
    requirements.push({
      key: action.toLowerCase().replace(/\s+/g, "_"),
      label: action,
      status: "Missing",
    });
  }
  const missing = requirements.filter((row) => row.status === "Missing").map((row) => row.label);
  return { requirements, complete: missing.length === 0, missing };
}
