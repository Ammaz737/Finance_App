import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../engines/policy";

describe("policy engine", () => {
  it("requires a receipt above the threshold from default rules", () => {
    const result = evaluatePolicy({ objectType: "expense", amount: 80, hasReceipt: false });
    expect(result.result).toBe("BLOCK");
    expect(result.matchedRules).toContain("receipt_required");
    expect(result.reason).toContain("Receipt is required");
    expect(result.requiredActions).toContain("Attach receipt");
    expect(result.evidence.length).toBeGreaterThan(0);
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
    expect(result.requiredActions.length).toBeGreaterThan(0);
  });

  it("classifies PASS WARN REVIEW BLOCK deterministically", () => {
    expect(evaluatePolicy({ objectType: "expense", amount: 10, hasReceipt: true }).result).toBe("PASS");
    expect(evaluatePolicy({
      objectType: "expense", amount: 12000, hasReceipt: true, rules: [{ type: "high_value", threshold: 10000 }],
    }).result).toBe("WARN");
    expect(evaluatePolicy({
      objectType: "expense", amount: 100, hasReceipt: true, hasMemo: false,
      rules: [{ type: "memo_required", threshold: 0 }],
    }).result).toBe("REVIEW");
    expect(evaluatePolicy({ objectType: "card", amount: 10, outOfPolicy: true }).result).toBe("BLOCK");
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
