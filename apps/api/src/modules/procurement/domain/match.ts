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

export function sumLineQuantities(lines: Array<{ quantity: string | number }>): number {
  return lines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
}

export type MatchDecision = "MATCHED" | "WITHIN_TOLERANCE" | "EXCEPTION" | "BLOCKED";

/** Absolute or percent-of-PO tolerance (pct as fraction, e.g. 0.01 = 1%). */
export function resolveTolerance(poAmount: number, toleranceAbs?: number, tolerancePct?: number): number {
  const abs = toleranceAbs ?? 0.01;
  const pct = tolerancePct != null ? Math.abs(poAmount) * tolerancePct : 0;
  return Math.max(abs, pct);
}

/**
 * 2-way = PO vs bill; 3-way = PO vs received vs bill.
 * Quantity mode: when ordered/received/invoiced quantities provided, qty must reconcile.
 */
export function evaluateMatch(input: {
  poAmount: number;
  receivedAmount: number;
  billedAmount: number;
  tolerance?: number;
  tolerancePct?: number;
  orderedQuantity?: number;
  receivedQuantity?: number;
  invoicedQuantity?: number;
  vendorMatch?: boolean;
  currencyMatch?: boolean;
}): {
  matchType: "TWO_WAY" | "THREE_WAY";
  status: MatchDecision;
  variance: number;
  explanation: string;
  reasonCode: string;
} {
  if (input.vendorMatch === false) {
    return {
      matchType: input.receivedAmount > 0 ? "THREE_WAY" : "TWO_WAY",
      status: "BLOCKED",
      variance: 0,
      explanation: "Vendor mismatch between PO and bill",
      reasonCode: "VENDOR_MISMATCH",
    };
  }
  if (input.currencyMatch === false) {
    return {
      matchType: input.receivedAmount > 0 ? "THREE_WAY" : "TWO_WAY",
      status: "BLOCKED",
      variance: 0,
      explanation: "Currency mismatch between PO and bill",
      reasonCode: "CURRENCY_MISMATCH",
    };
  }

  const tolerance = resolveTolerance(input.poAmount, input.tolerance, input.tolerancePct);
  const hasReceiving = input.receivedAmount > 0 || (input.receivedQuantity != null && input.receivedQuantity > 0);
  const varianceBill = Math.abs(input.billedAmount - input.poAmount);

  if (
    input.orderedQuantity != null
    && input.receivedQuantity != null
    && input.invoicedQuantity != null
  ) {
    const qtyRecvOk = input.receivedQuantity + 1e-9 >= input.invoicedQuantity;
    const qtyOrderedOk = input.invoicedQuantity <= input.orderedQuantity + 1e-9;
    if (!qtyRecvOk) {
      return {
        matchType: "THREE_WAY",
        status: "EXCEPTION",
        variance: Number((input.invoicedQuantity - input.receivedQuantity).toFixed(4)),
        explanation: `Invoiced qty ${input.invoicedQuantity} exceeds received ${input.receivedQuantity}`,
        reasonCode: "NOT_RECEIVED",
      };
    }
    if (!qtyOrderedOk) {
      return {
        matchType: "THREE_WAY",
        status: "EXCEPTION",
        variance: Number((input.invoicedQuantity - input.orderedQuantity).toFixed(4)),
        explanation: `Invoiced qty ${input.invoicedQuantity} exceeds ordered ${input.orderedQuantity}`,
        reasonCode: "QUANTITY_VARIANCE",
      };
    }
  }

  if (hasReceiving) {
    const varianceRecv = Math.abs(input.receivedAmount - input.poAmount);
    const varianceBillRecv = Math.abs(input.billedAmount - input.receivedAmount);
    const variance = Math.max(varianceBill, varianceRecv, varianceBillRecv);
    if (variance <= 0.01) {
      return {
        matchType: "THREE_WAY",
        status: "MATCHED",
        variance: Number(variance.toFixed(2)),
        explanation: "PO, receiving, and bill amounts reconcile",
        reasonCode: "",
      };
    }
    if (variance <= tolerance) {
      return {
        matchType: "THREE_WAY",
        status: "WITHIN_TOLERANCE",
        variance: Number(variance.toFixed(2)),
        explanation: `3-way variance ${variance.toFixed(2)} within tolerance ${tolerance.toFixed(2)}`,
        reasonCode: "PRICE_VARIANCE",
      };
    }
    const reasonCode = input.billedAmount > input.poAmount + tolerance
      ? "PO_OVERBILLING"
      : input.billedAmount > input.receivedAmount + tolerance
        ? "NOT_RECEIVED"
        : "PRICE_VARIANCE";
    return {
      matchType: "THREE_WAY",
      status: "EXCEPTION",
      variance: Number(variance.toFixed(2)),
      explanation: `3-way variance ${variance.toFixed(2)} exceeds tolerance`,
      reasonCode,
    };
  }

  if (varianceBill <= 0.01) {
    return {
      matchType: "TWO_WAY",
      status: "MATCHED",
      variance: Number(varianceBill.toFixed(2)),
      explanation: "PO and bill amounts reconcile",
      reasonCode: "",
    };
  }
  if (varianceBill <= tolerance) {
    return {
      matchType: "TWO_WAY",
      status: "WITHIN_TOLERANCE",
      variance: Number(varianceBill.toFixed(2)),
      explanation: `2-way variance ${varianceBill.toFixed(2)} within tolerance ${tolerance.toFixed(2)}`,
      reasonCode: "PRICE_VARIANCE",
    };
  }
  return {
    matchType: "TWO_WAY",
    status: "EXCEPTION",
    variance: Number(varianceBill.toFixed(2)),
    explanation: `2-way variance ${varianceBill.toFixed(2)} exceeds tolerance`,
    reasonCode: input.billedAmount > input.poAmount ? "PO_OVERBILLING" : "PRICE_VARIANCE",
  };
}
