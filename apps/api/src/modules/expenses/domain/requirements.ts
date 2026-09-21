/** Deterministic receipt↔transaction match before AI. */
export type ReceiptMatchDecision = "MATCHED" | "SUGGESTED" | "NO_MATCH";

export function scoreReceiptMatch(input: {
  receiptAmount?: number | null;
  receiptCurrency?: string | null;
  receiptMerchant?: string | null;
  receiptDate?: Date | string | null;
  txnAmount: number;
  txnCurrency: string;
  txnMerchant: string;
  txnDate: Date | string;
}): { score: number; decision: ReceiptMatchDecision; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (input.receiptAmount != null && Number.isFinite(input.receiptAmount)) {
    const delta = Math.abs(input.receiptAmount - input.txnAmount);
    if (delta < 0.01) {
      score += 40;
      reasons.push("amount_exact");
    } else if (delta <= Math.max(1, input.txnAmount * 0.02)) {
      score += 25;
      reasons.push("amount_near");
    }
  }
  if (input.receiptCurrency && input.receiptCurrency.toUpperCase() === input.txnCurrency.toUpperCase()) {
    score += 15;
    reasons.push("currency");
  }
  const rm = (input.receiptMerchant ?? "").trim().toLowerCase();
  const tm = input.txnMerchant.trim().toLowerCase();
  if (rm && tm && (rm.includes(tm) || tm.includes(rm))) {
    score += 30;
    reasons.push("merchant");
  }
  if (input.receiptDate) {
    const a = new Date(input.receiptDate).getTime();
    const b = new Date(input.txnDate).getTime();
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const days = Math.abs(a - b) / (24 * 60 * 60 * 1000);
      if (days <= 2) {
        score += 15;
        reasons.push("date_near");
      } else if (days <= 7) {
        score += 8;
        reasons.push("date_week");
      }
    }
  }
  const decision: ReceiptMatchDecision = score >= 70 ? "MATCHED" : score >= 45 ? "SUGGESTED" : "NO_MATCH";
  return { score, decision, reasons };
}

export type ExpenseRequirement = {
  key: string;
  label: string;
  status: "Complete" | "Missing";
};

export function evaluateExpenseRequirements(input: {
  hasReceipt: boolean;
  hasMemo: boolean;
  hasCategory: boolean;
  policyRequiredActions?: string[];
}): { requirements: ExpenseRequirement[]; complete: boolean; missing: string[] } {
  const requirements: ExpenseRequirement[] = [
    { key: "receipt", label: "Receipt", status: input.hasReceipt ? "Complete" : "Missing" },
    { key: "memo", label: "Business purpose", status: input.hasMemo ? "Complete" : "Missing" },
    { key: "category", label: "Category", status: input.hasCategory ? "Complete" : "Missing" },
  ];
  for (const action of input.policyRequiredActions ?? []) {
    if (/receipt/i.test(action) || /memo|purpose/i.test(action) || /category/i.test(action)) continue;
    requirements.push({
      key: action.toLowerCase().replace(/\s+/g, "_"),
      label: action,
      status: "Missing",
    });
  }
  const missing = requirements.filter((row) => row.status === "Missing").map((row) => row.label);
  return { requirements, complete: missing.length === 0, missing };
}
