import { describe, expect, it } from "vitest";
import { evaluateMatch, normalizeProcurementLines, sumLineAmounts } from "../modules/procurement/domain/match";

describe("procurement match helpers", () => {
  it("normalizes lines and sums to request amount", () => {
    const lines = normalizeProcurementLines([
      { description: "Licenses", quantity: 2, unitAmount: "50" },
      { description: "Support", amount: "25" },
    ], { description: "Fallback", amount: "100" });
    expect(sumLineAmounts(lines)).toBe(125);
    expect(lines[0]?.amount).toBe("100.00");
  });

  it("evaluates 2-way and 3-way match", () => {
    expect(evaluateMatch({ poAmount: 100, receivedAmount: 0, billedAmount: 100 }).status).toBe("MATCHED");
    expect(evaluateMatch({ poAmount: 100, receivedAmount: 0, billedAmount: 90 }).status).toBe("EXCEPTION");
    expect(evaluateMatch({ poAmount: 100, receivedAmount: 100, billedAmount: 100 }).matchType).toBe("THREE_WAY");
    expect(evaluateMatch({ poAmount: 100, receivedAmount: 80, billedAmount: 100 }).status).toBe("EXCEPTION");
  });
});
