export type ProcurementLineInput = {
  description: string;
  quantity?: string | number;
  unitAmount?: string | number;
  amount?: string | number;
  category?: string;
};

export function normalizeProcurementLines(
  lines: ProcurementLineInput[] | undefined,
  fallback: { description: string; amount: string | number; category?: string },
): Array<{ description: string; quantity: string; unitAmount: string; amount: string; category: string }> {
  const source = lines?.length
    ? lines
    : [{ description: fallback.description, quantity: 1, amount: fallback.amount, category: fallback.category ?? "" }];

  return source.map((line) => {
    const quantity = Number(line.quantity ?? 1);
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const amountNum = line.amount != null
      ? Number(line.amount)
      : Number(line.unitAmount ?? 0) * qty;
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error("LINE_AMOUNT_INVALID");
    }
    const unit = line.unitAmount != null ? Number(line.unitAmount) : amountNum / qty;
    return {
      description: (line.description || fallback.description).trim() || "Line",
      quantity: String(qty),
      unitAmount: unit.toFixed(2),
      amount: amountNum.toFixed(2),
      category: (line.category ?? "").trim(),
    };
  });
}

export function sumLineAmounts(lines: Array<{ amount: string }>): number {
  return lines.reduce((sum, line) => sum + Number(line.amount), 0);
}

/** 2-way = PO vs bill; 3-way = PO vs received vs bill. Tolerance in major currency units. */
export function evaluateMatch(input: {
  poAmount: number;
  receivedAmount: number;
  billedAmount: number;
  tolerance?: number;
}): { matchType: "TWO_WAY" | "THREE_WAY"; status: "MATCHED" | "EXCEPTION"; variance: number; explanation: string } {
  const tolerance = input.tolerance ?? 0.01;
  const hasReceiving = input.receivedAmount > 0;
  const varianceBill = Math.abs(input.billedAmount - input.poAmount);
  const varianceRecv = Math.abs(input.receivedAmount - input.poAmount);
  const varianceBillRecv = Math.abs(input.billedAmount - input.receivedAmount);

  if (hasReceiving) {
    const ok = varianceBill <= tolerance && varianceRecv <= tolerance && varianceBillRecv <= tolerance;
    const variance = Math.max(varianceBill, varianceRecv, varianceBillRecv);
    return {
      matchType: "THREE_WAY",
      status: ok ? "MATCHED" : "EXCEPTION",
      variance: Number(variance.toFixed(2)),
      explanation: ok
        ? "PO, receiving, and bill amounts reconcile"
        : `3-way variance ${variance.toFixed(2)} exceeds tolerance`,
    };
  }

  const ok = varianceBill <= tolerance;
  return {
    matchType: "TWO_WAY",
    status: ok ? "MATCHED" : "EXCEPTION",
    variance: Number(varianceBill.toFixed(2)),
    explanation: ok
      ? "PO and bill amounts reconcile"
      : `2-way variance ${varianceBill.toFixed(2)} exceeds tolerance`,
  };
}
