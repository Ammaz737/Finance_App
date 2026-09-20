import { describe, expect, it } from "vitest";
import { budgetCapacity, sumByCurrency } from "../modules/reporting/domain/budget-math";

describe("M10 budget math", () => {
  it("does not double-count actual and committed", () => {
    const result = budgetCapacity({ amount: 1000, actualAmount: 200, committedAmount: 300 });
    expect(result.usedAmount).toBe("500.00");
    expect(result.remainingAmount).toBe("500.00");
    expect(result.utilizationPct).toBe(50);
    expect(result.overBudget).toBe(false);
  });

  it("sums by currency without merging currencies", () => {
    expect(sumByCurrency([
      { currency: "USD", amount: "10" },
      { currency: "usd", amount: 5 },
      { currency: "GBP", amount: "2" },
    ])).toEqual([
      { currency: "GBP", amount: "2.00" },
      { currency: "USD", amount: "15.00" },
    ]);
  });
});
