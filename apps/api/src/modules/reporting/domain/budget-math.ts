/**
 * Budget capacity math: actual and committed are mutually exclusive dollars.
 * remaining = amount - actual - committed (never subtract the same spend twice).
 */
export function budgetCapacity(input: {
  amount: number | string | { toString(): string };
  actualAmount: number | string | { toString(): string };
  committedAmount: number | string | { toString(): string };
}) {
  const amount = Number(input.amount.toString());
  const actual = Number(input.actualAmount.toString());
  const committed = Number(input.committedAmount.toString());
  const used = actual + committed;
  const remaining = amount - used;
  const utilization = amount > 0 ? used / amount : 0;
  return {
    amount: amount.toFixed(2),
    actualAmount: actual.toFixed(2),
    committedAmount: committed.toFixed(2),
    usedAmount: used.toFixed(2),
    remainingAmount: remaining.toFixed(2),
    utilizationPct: Math.round(utilization * 1000) / 10,
    overBudget: remaining < 0,
  };
}

/** Aggregate money rows by currency without merging distinct currencies. */
export function sumByCurrency(rows: Array<{ currency: string; amount: number | string }>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const currency = row.currency.toUpperCase();
    map.set(currency, (map.get(currency) ?? 0) + Number(row.amount));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ currency, amount: amount.toFixed(2) }));
}
