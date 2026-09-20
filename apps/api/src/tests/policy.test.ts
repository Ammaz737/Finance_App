import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../engines/policy";

describe("policy engine", () => {
  it("requires a receipt above the threshold from default rules", () => {
    const result = evaluatePolicy({ objectType: "expense", amount: 80, hasReceipt: false });
    expect(result.result).toBe("BLOCK");
    expect(result.matchedRules).toContain("receipt_required");
  });

  it("uses supplied DB-style rules for memo and category thresholds", () => {
    const result = evaluatePolicy({
      objectType: "expense",
      amount: 600,
      hasReceipt: true,
      hasMemo: false,
      category: "MEALS",
      rules: [
        { type: "memo_required", threshold: 0 },
        { type: "category_amount", category: "MEALS", threshold: 500 },
      ],
    });
    expect(result.result).toBe("REVIEW");
    expect(result.matchedRules).toEqual(expect.arrayContaining(["memo_required", "category_amount"]));
  });

  it("never lets AI-style flags override a hard block", () => {
    const result = evaluatePolicy({ objectType: "card", amount: 10, outOfPolicy: true });
    expect(result.result).toBe("BLOCK");
  });

  it("never applies receipt rules to card authorizations", () => {
    const result = evaluatePolicy({ objectType: "card", amount: 80, hasReceipt: false });
    expect(result.result).not.toBe("BLOCK");
    expect(result.matchedRules).not.toContain("receipt_required");
  });
});
