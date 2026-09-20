import { describe, expect, it } from "vitest";
import {
  amountsEqual,
  assertCurrency,
  assertPositiveMoney,
  assertSameCurrency,
  compareAmount,
  money,
  MoneyError,
  parseAmount,
} from "@finance/money";

describe("money primitives", () => {
  it("normalizes and validates amounts", () => {
    expect(parseAmount("12")).toBe("12.00");
    expect(parseAmount("12.5")).toBe("12.50");
    expect(parseAmount(3.1)).toBe("3.10");
    expect(() => parseAmount("-1")).toThrow(MoneyError);
    expect(() => parseAmount("12.345")).toThrow(MoneyError);
  });

  it("requires positive money and matching currency", () => {
    expect(assertPositiveMoney("10.00", "usd")).toEqual({ amount: "10.00", currency: "USD" });
    expect(() => assertPositiveMoney("0", "USD")).toThrow(MoneyError);
    expect(assertSameCurrency("USD", "usd")).toBe("USD");
    expect(() => assertSameCurrency("USD", "EUR")).toThrow(MoneyError);
    expect(assertCurrency("eur")).toBe("EUR");
  });

  it("compares amounts", () => {
    expect(compareAmount("1.00", "1")).toBe(0);
    expect(amountsEqual("2.5", "2.50")).toBe(true);
    expect(compareAmount("1", "2")).toBe(-1);
    expect(money("1", "USD").currency).toBe("USD");
  });
});
