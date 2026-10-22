/** Deterministic receipt↔transaction match before AI. */
export type ReceiptMatchDecision = "MATCHED" | "SUGGESTED" | "NO_MATCH";

/** A file link alone is not evidence that a receipt matches a purchase. */
export function validateReceiptMatch(
  receipt: { amountGuess: unknown; merchantGuess: string | null; ocrPayload: unknown; ocrStatus: string },
  purchase: { amount: unknown; currency: string; merchant: string },
): { status: "MATCHED" | "MISMATCH" | "NEEDS_REVIEW"; reasons: string[] } {
  const payload = receipt.ocrPayload && typeof receipt.ocrPayload === "object"
    ? receipt.ocrPayload as Record<string, unknown> : {};
  const currency = typeof payload.currencyGuess === "string" ? payload.currencyGuess.toUpperCase() : null;
  const amount = receipt.amountGuess == null ? NaN : Number(receipt.amountGuess);
  const reasons: string[] = [];
  if (Number.isFinite(amount) && Math.round(amount * 100) !== Math.round(Number(purchase.amount) * 100)) {
    reasons.push(`Receipt amount ${amount.toFixed(2)} differs from expense ${Number(purchase.amount).toFixed(2)} ${purchase.currency}`);
  }
  if (currency && currency !== purchase.currency.toUpperCase()) reasons.push("Receipt currency differs from expense currency");
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const merchant = normalize(receipt.merchantGuess ?? "");
  const target = normalize(purchase.merchant);
  const merchantMatches = Boolean(merchant && target && (merchant.includes(target) || target.includes(merchant)));
  if (merchant && target && !merchantMatches) reasons.push("Receipt merchant differs from expense merchant");
  if (reasons.length) return { status: "MISMATCH", reasons };
  if (receipt.ocrStatus !== "COMPLETED" || !Number.isFinite(amount) || !currency || !merchantMatches) {
    return { status: "NEEDS_REVIEW", reasons: ["Receipt extraction is incomplete; verify amount, currency and merchant"] };
  }
  return { status: "MATCHED", reasons: [] };
}

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
