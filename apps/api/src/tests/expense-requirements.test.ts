import { describe, expect, it } from "vitest";
import { evaluateExpenseRequirements, scoreReceiptMatch } from "../modules/expenses/domain/requirements";

describe("expense requirements", () => {
  it("lists missing receipt and memo", () => {
    const result = evaluateExpenseRequirements({ hasReceipt: false, hasMemo: false, hasCategory: true });
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(["Receipt", "Business purpose"]));
  });

  it("is complete when all core requirements are met", () => {
    expect(evaluateExpenseRequirements({ hasReceipt: true, hasMemo: true, hasCategory: true }).complete).toBe(true);
  });
});

describe("receipt matching", () => {
  it("matches exact amount, currency, merchant, and date", () => {
    const result = scoreReceiptMatch({
      receiptAmount: 25,
      receiptCurrency: "USD",
      receiptMerchant: "OpenAI",
      receiptDate: "2026-09-20",
      txnAmount: 25,
      txnCurrency: "USD",
      txnMerchant: "OpenAI Inc",
      txnDate: "2026-09-20",
    });
    expect(result.decision).toBe("MATCHED");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("returns NO_MATCH for unrelated receipts", () => {
    const result = scoreReceiptMatch({
      receiptAmount: 9,
      receiptCurrency: "EUR",
      receiptMerchant: "Taxi",
      receiptDate: "2020-01-01",
      txnAmount: 100,
      txnCurrency: "USD",
      txnMerchant: "OpenAI",
      txnDate: "2026-09-20",
    });
    expect(result.decision).toBe("NO_MATCH");
  });
});
