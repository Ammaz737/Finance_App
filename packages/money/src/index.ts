export type Money = {
  amount: string;
  currency: string;
};

const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class MoneyError extends Error {
  constructor(message: string, readonly code: string = "INVALID_MONEY") {
    super(message);
    this.name = "MoneyError";
  }
}

/** Normalize and validate a decimal money amount with at most 2 fraction digits. */
export function parseAmount(value: string | number): string {
  const raw = typeof value === "number" ? value.toFixed(2) : String(value).trim();
  if (!AMOUNT_PATTERN.test(raw)) {
    throw new MoneyError("Amount must be a non-negative decimal with at most 2 fraction digits", "INVALID_AMOUNT");
  }
  const [whole, fraction = ""] = raw.split(".");
  return fraction ? `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}` : `${whole}.00`;
}

export function assertCurrency(currency: string): string {
  const code = currency.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(code)) {
    throw new MoneyError("Currency must be a 3-letter ISO code", "INVALID_CURRENCY");
  }
  return code;
}

export function money(amount: string | number, currency: string): Money {
  return { amount: parseAmount(amount), currency: assertCurrency(currency) };
}

export function assertPositiveMoney(amount: string | number, currency: string): Money {
  const value = money(amount, currency);
  if (Number(value.amount) <= 0) {
    throw new MoneyError("Amount must be greater than zero", "INVALID_AMOUNT");
  }
  return value;
}

export function assertSameCurrency(expected: string, actual: string): string {
  const left = assertCurrency(expected);
  const right = assertCurrency(actual);
  if (left !== right) {
    throw new MoneyError(`Currency must match ${left}`, "CURRENCY_MISMATCH");
  }
  return left;
}

export function compareAmount(left: string | number, right: string | number): -1 | 0 | 1 {
  const a = Number(parseAmount(left));
  const b = Number(parseAmount(right));
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function amountsEqual(left: string | number, right: string | number): boolean {
  return compareAmount(left, right) === 0;
}
