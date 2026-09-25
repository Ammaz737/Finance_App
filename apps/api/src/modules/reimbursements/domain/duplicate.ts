/** Deterministic reimbursement duplicate checks. */
export type ReimbursementDuplicateDecision = "CLEAR" | "POSSIBLE_DUPLICATE" | "BLOCKED_DUPLICATE";

export type ExistingReimbursement = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  merchant: string;
  expenseDate?: Date | string | null;
  receiptFingerprint?: string | null;
  status: string;
};

export function evaluateReimbursementDuplicate(input: {
  userId: string;
  type: string;
  amount: number;
  currency: string;
  merchant: string;
  expenseDate?: Date | string | null;
  receiptFingerprint?: string | null;
  existing: ExistingReimbursement[];
}): { decision: ReimbursementDuplicateDecision; matchedId?: string; evidence: Record<string, unknown> } {
  const fingerprint = (input.receiptFingerprint ?? "").trim();
  if (fingerprint) {
    const byReceipt = input.existing.find((row) => (row.receiptFingerprint ?? "").trim() === fingerprint && row.status !== "CANCELLED");
    if (byReceipt) {
      return {
        decision: "BLOCKED_DUPLICATE",
        matchedId: byReceipt.id,
        evidence: { reason: "receipt_fingerprint", reimbursementId: byReceipt.id },
      };
    }
  }

  const merchant = input.merchant.trim().toLowerCase();
  const exact = input.existing.find((row) => {
    if (row.userId !== input.userId) return false;
    if (row.type !== input.type) return false;
    if (row.currency.toUpperCase() !== input.currency.toUpperCase()) return false;
    if (Math.abs(row.amount - input.amount) > 0.009) return false;
    if ((row.merchant ?? "").trim().toLowerCase() !== merchant) return false;
    if (!input.expenseDate || !row.expenseDate) return false;
    const a = new Date(input.expenseDate).toISOString().slice(0, 10);
    const b = new Date(row.expenseDate).toISOString().slice(0, 10);
    return a === b && !["CANCELLED", "REJECTED", "DRAFT"].includes(row.status);
  });
  if (exact) {
    return {
      decision: "BLOCKED_DUPLICATE",
      matchedId: exact.id,
      evidence: { reason: "exact_employee_merchant_date_amount", reimbursementId: exact.id },
    };
  }

  const near = input.existing.find((row) => {
    if (row.userId !== input.userId) return false;
    if (row.type !== input.type) return false;
    if (row.currency.toUpperCase() !== input.currency.toUpperCase()) return false;
    if (Math.abs(row.amount - input.amount) > Math.max(1, input.amount * 0.01)) return false;
    if (!input.expenseDate || !row.expenseDate) return false;
    const days = Math.abs(new Date(input.expenseDate).getTime() - new Date(row.expenseDate).getTime()) / (24 * 60 * 60 * 1000);
    return days <= 2 && !["CANCELLED", "REJECTED", "DRAFT"].includes(row.status);
  });
  if (near) {
    return {
      decision: "POSSIBLE_DUPLICATE",
      matchedId: near.id,
      evidence: { reason: "near_amount_date", reimbursementId: near.id },
    };
  }

  return { decision: "CLEAR", evidence: { reason: "no_match" } };
}
