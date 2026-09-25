/** PO lifecycle helpers for GF3. */
export const PO_RECEIVE_STATUSES = ["ISSUED", "PARTIALLY_RECEIVED", "OPEN"] as const;
export const PO_MATCH_OK = ["MATCHED", "WITHIN_TOLERANCE"] as const;

export function canReceivePo(status: string): boolean {
  return (PO_RECEIVE_STATUSES as readonly string[]).includes(status);
}

export function isMatchPassing(status: string): boolean {
  return (PO_MATCH_OK as readonly string[]).includes(status);
}

export function nextReceiveStatus(input: {
  receivedAmount: number;
  poAmount: number;
  receivedQuantity?: number;
  orderedQuantity?: number;
  /** Quantity completion is required only for QUANTITY receipt semantics. */
  enforceQuantity?: boolean;
}): "RECEIVED" | "PARTIALLY_RECEIVED" {
  const amountDone = input.receivedAmount + 1e-9 >= input.poAmount;
  if (input.enforceQuantity) {
    const ordered = input.orderedQuantity ?? 0;
    const qtyDone = ordered <= 0 || (input.receivedQuantity ?? 0) + 1e-9 >= ordered;
    return amountDone && qtyDone ? "RECEIVED" : "PARTIALLY_RECEIVED";
  }
  return amountDone ? "RECEIVED" : "PARTIALLY_RECEIVED";
}
