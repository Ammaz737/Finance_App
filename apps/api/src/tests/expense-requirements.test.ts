import { describe, expect, it } from "vitest";
import { evaluateExpenseRequirements, scoreReceiptMatch, validateReceiptMatch } from "../modules/expenses/domain/requirements";

describe("linked receipt validation", () => {
  const purchase = { amount: "250", currency: "USD", merchant: "OpenAI" };
  const receipt = { amountGuess: "250", merchantGuess: "OpenAI receipt", ocrPayload: { currencyGuess: "USD" }, ocrStatus: "COMPLETED" };
  it("flags the furniture USD 100 receipt against USD 250 OpenAI", () => {
    const result = validateReceiptMatch({ ...receipt, amountGuess: "100", merchantGuess: "furniture invoice 100 usd" }, purchase);
    expect(result.status).toBe("MISMATCH");
    expect(result.reasons).toHaveLength(2);
  });
  it("rejects a different merchant even when the amount matches", () => {
    expect(validateReceiptMatch({ ...receipt, merchantGuess: "Furniture" }, purchase).status).toBe("MISMATCH");
  });
  it("rejects a different currency", () => {
    expect(validateReceiptMatch({ ...receipt, ocrPayload: { currencyGuess: "EUR" } }, purchase).status).toBe("MISMATCH");
  });
  it("requires review when extraction is missing", () => {
    expect(validateReceiptMatch({ ...receipt, amountGuess: null }, purchase).status).toBe("NEEDS_REVIEW");
  });
  it("matches consistent extracted values", () => {
    expect(validateReceiptMatch(receipt, purchase).status).toBe("MATCHED");
  });
});

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
