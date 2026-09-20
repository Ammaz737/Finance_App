import { describe, expect, it } from "vitest";
import { matchAccountingRule, pickAccountingRule } from "../modules/accounting/domain/rules";

describe("accounting rules", () => {
  it("matches source type and memo, preferring lower priority number", () => {
    const rules = [
      { enabled: true, priority: 20, match: { sourceType: "REIMBURSEMENT" }, coding: { category: "Travel" } },
      { enabled: true, priority: 10, match: { sourceType: "REIMBURSEMENT", memoContains: "mile" }, coding: { category: "Mileage", coding: { glAccount: "6200" } } },
    ];
    const picked = pickAccountingRule(rules, {
      sourceType: "REIMBURSEMENT",
      category: "",
      memo: "Client visit mileage",
      amount: 67,
    });
    expect(picked?.category).toBe("Mileage");
    expect(picked?.coding?.glAccount).toBe("6200");
  });

  it("skips disabled rules", () => {
    expect(matchAccountingRule(
      { enabled: false, priority: 1, match: { sourceType: "BILL" }, coding: { category: "AP" } },
      { sourceType: "BILL", category: "", memo: "", amount: 10 },
    )).toBe(false);
  });
});
