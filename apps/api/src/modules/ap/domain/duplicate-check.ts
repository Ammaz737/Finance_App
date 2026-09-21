/** Deterministic bill duplicate checks. Exact invoice# is blocked; near amount/date is possible. */
export type DuplicateDecision = "CLEAR" | "POSSIBLE_DUPLICATE" | "DUPLICATE_BLOCKED";

export type ExistingBill = {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  invoiceDate?: Date | string | null;
  status: string;
};

export function evaluateBillDuplicate(input: {
  invoiceNumber: string;
  amount: number;
  currency: string;
  invoiceDate?: Date | string | null;
  existing: ExistingBill[];
}): { decision: DuplicateDecision; evidence: Record<string, unknown>; matchedBillId?: string } {
  const invoiceNumber = input.invoiceNumber.trim().toLowerCase();
  const exact = input.existing.find((row) => row.invoiceNumber.trim().toLowerCase() === invoiceNumber);
  if (exact) {
    return {
      decision: "DUPLICATE_BLOCKED",
      matchedBillId: exact.id,
      evidence: {
        reason: "exact_invoice_number",
        billId: exact.id,
        invoiceNumber: exact.invoiceNumber,
        status: exact.status,
      },
    };
  }

  const near = input.existing.find((row) => {
    if (!input.invoiceDate || !row.invoiceDate) return false;
    if (row.currency.toUpperCase() !== input.currency.toUpperCase()) return false;
    const delta = Math.abs(row.amount - input.amount);
    if (delta > Math.max(1, input.amount * 0.01)) return false;
    const a = new Date(input.invoiceDate).getTime();
    const b = new Date(row.invoiceDate).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) / (24 * 60 * 60 * 1000) <= 3;
  });

  if (near) {
    return {
      decision: "POSSIBLE_DUPLICATE",
      matchedBillId: near.id,
      evidence: {
        reason: "near_amount_date",
        billId: near.id,
        invoiceNumber: near.invoiceNumber,
        amount: near.amount,
        currency: near.currency,
      },
    };
  }

  return { decision: "CLEAR", evidence: { reason: "no_match" } };
}
