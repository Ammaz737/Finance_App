import { Prisma } from "@prisma/client";

export type ReimbursementType = "STANDARD" | "MILEAGE" | "PER_DIEM";

export const DEFAULT_MILEAGE_RATE_USD = "0.6700";
export const DEFAULT_PER_DIEM_RATE_USD = "75.00";
export const RATE_SOURCE_ORG_DEFAULT = "ORG_DEFAULT";
export const RATE_VERSION_GF4 = "gf4-2026.09";

export type ReimbursementCalcInput = {
  type: ReimbursementType;
  currency: string;
  /** Required for STANDARD; ignored for calculated types. */
  amount?: string;
  distanceMiles?: string;
  /** Ignored unless allowCustomRate — employees cannot forge rates. */
  mileageRate?: string;
  perDiemNights?: number;
  eligibleDays?: number;
  perDiemRate?: string;
  allowCustomRate?: boolean;
  startDate?: string;
  endDate?: string;
};

export type ReimbursementCalcResult = {
  amount: Prisma.Decimal;
  distanceMiles: Prisma.Decimal | null;
  mileageRate: Prisma.Decimal | null;
  perDiemNights: number | null;
  eligibleDays: number | null;
  perDiemRate: Prisma.Decimal | null;
  rateSource: string;
  rateVersion: string;
  breakdown: {
    method: ReimbursementType;
    currency: string;
    inputs: Record<string, string | number>;
    formula: string;
    rateSource: string;
    rateVersion: string;
  };
};

function dec(value: string | number) {
  return new Prisma.Decimal(value);
}

function daysInclusive(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b < a) return null;
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/** Server-side reimbursement amount. Client amounts are not trusted for MILEAGE/PER_DIEM. */
export function calculateReimbursement(input: ReimbursementCalcInput): ReimbursementCalcResult {
  if (input.type === "MILEAGE") {
    if (input.distanceMiles == null || input.distanceMiles === "") {
      throw new Error("DISTANCE_REQUIRED");
    }
    const miles = dec(input.distanceMiles);
    if (!miles.greaterThan(0) || miles.greaterThan(10_000)) throw new Error("INVALID_DISTANCE");
    const rate = dec(input.allowCustomRate && input.mileageRate?.trim()
      ? input.mileageRate.trim()
      : DEFAULT_MILEAGE_RATE_USD);
    if (!rate.greaterThan(0) || rate.greaterThan(10)) throw new Error("INVALID_MILEAGE_RATE");
    const amount = miles.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return {
      amount,
      distanceMiles: miles,
      mileageRate: rate,
      perDiemNights: null,
      eligibleDays: null,
      perDiemRate: null,
      rateSource: RATE_SOURCE_ORG_DEFAULT,
      rateVersion: RATE_VERSION_GF4,
      breakdown: {
        method: "MILEAGE",
        currency: input.currency,
        inputs: { distanceMiles: String(miles), mileageRate: String(rate) },
        formula: `${miles} miles × ${rate} = ${amount}`,
        rateSource: RATE_SOURCE_ORG_DEFAULT,
        rateVersion: RATE_VERSION_GF4,
      },
    };
  }

  if (input.type === "PER_DIEM") {
    const fromDates = daysInclusive(input.startDate, input.endDate);
    const nights = input.eligibleDays ?? input.perDiemNights ?? fromDates;
    if (nights == null || !Number.isInteger(nights) || nights < 1 || nights > 365) {
      throw new Error("INVALID_PER_DIEM_NIGHTS");
    }
    const rate = dec(input.allowCustomRate && input.perDiemRate?.trim()
      ? input.perDiemRate.trim()
      : DEFAULT_PER_DIEM_RATE_USD);
    if (!rate.greaterThan(0) || rate.greaterThan(1000)) throw new Error("INVALID_PER_DIEM_RATE");
    const amount = rate.mul(nights).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return {
      amount,
      distanceMiles: null,
      mileageRate: null,
      perDiemNights: nights,
      eligibleDays: nights,
      perDiemRate: rate,
      rateSource: RATE_SOURCE_ORG_DEFAULT,
      rateVersion: RATE_VERSION_GF4,
      breakdown: {
        method: "PER_DIEM",
        currency: input.currency,
        inputs: { eligibleDays: nights, perDiemRate: String(rate) },
        formula: `${nights} days × ${rate} = ${amount}`,
        rateSource: RATE_SOURCE_ORG_DEFAULT,
        rateVersion: RATE_VERSION_GF4,
      },
    };
  }

  if (!input.amount) throw new Error("AMOUNT_REQUIRED");
  const amount = dec(input.amount);
  if (!amount.greaterThan(0) || amount.greaterThan(1_000_000)) throw new Error("INVALID_AMOUNT");
  return {
    amount: amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    distanceMiles: null,
    mileageRate: null,
    perDiemNights: null,
    eligibleDays: null,
    perDiemRate: null,
    rateSource: "",
    rateVersion: "",
    breakdown: {
      method: "STANDARD",
      currency: input.currency,
      inputs: { amount: String(amount) },
      formula: `standard amount ${amount}`,
      rateSource: "",
      rateVersion: "",
    },
  };
}
