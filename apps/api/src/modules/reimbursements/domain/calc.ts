import { Prisma } from "@prisma/client";

export type ReimbursementType = "STANDARD" | "MILEAGE" | "PER_DIEM";

export const DEFAULT_MILEAGE_RATE_USD = "0.6700";
export const DEFAULT_PER_DIEM_RATE_USD = "75.00";

export type ReimbursementCalcInput = {
  type: ReimbursementType;
  currency: string;
  /** Required for STANDARD; ignored for calculated types unless used as override check. */
  amount?: string;
  distanceMiles?: string;
  mileageRate?: string;
  perDiemNights?: number;
  perDiemRate?: string;
};

export type ReimbursementCalcResult = {
  amount: Prisma.Decimal;
  distanceMiles: Prisma.Decimal | null;
  mileageRate: Prisma.Decimal | null;
  perDiemNights: number | null;
  perDiemRate: Prisma.Decimal | null;
  breakdown: {
    method: ReimbursementType;
    currency: string;
    inputs: Record<string, string | number>;
    formula: string;
  };
};

function dec(value: string | number) {
  return new Prisma.Decimal(value);
}

/** Server-side reimbursement amount. Client amounts are not trusted for MILEAGE/PER_DIEM. */
export function calculateReimbursement(input: ReimbursementCalcInput): ReimbursementCalcResult {
  if (input.type === "MILEAGE") {
    if (input.distanceMiles == null || input.distanceMiles === "") {
      throw new Error("DISTANCE_REQUIRED");
    }
    const miles = dec(input.distanceMiles);
    if (!miles.greaterThan(0) || miles.greaterThan(10_000)) throw new Error("INVALID_DISTANCE");
    const rate = dec(input.mileageRate?.trim() || DEFAULT_MILEAGE_RATE_USD);
    if (!rate.greaterThan(0) || rate.greaterThan(10)) throw new Error("INVALID_MILEAGE_RATE");
    const amount = miles.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return {
      amount,
      distanceMiles: miles,
      mileageRate: rate,
      perDiemNights: null,
      perDiemRate: null,
      breakdown: {
        method: "MILEAGE",
        currency: input.currency,
        inputs: { distanceMiles: String(miles), mileageRate: String(rate) },
        formula: `${miles} miles × ${rate} = ${amount}`,
      },
    };
  }

  if (input.type === "PER_DIEM") {
    const nights = input.perDiemNights;
    if (nights == null || !Number.isInteger(nights) || nights < 1 || nights > 365) {
      throw new Error("INVALID_PER_DIEM_NIGHTS");
    }
    const rate = dec(input.perDiemRate?.trim() || DEFAULT_PER_DIEM_RATE_USD);
    if (!rate.greaterThan(0) || rate.greaterThan(1000)) throw new Error("INVALID_PER_DIEM_RATE");
    const amount = rate.mul(nights).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return {
      amount,
      distanceMiles: null,
      mileageRate: null,
      perDiemNights: nights,
      perDiemRate: rate,
      breakdown: {
        method: "PER_DIEM",
        currency: input.currency,
        inputs: { perDiemNights: nights, perDiemRate: String(rate) },
        formula: `${nights} nights × ${rate} = ${amount}`,
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
    perDiemRate: null,
    breakdown: {
      method: "STANDARD",
      currency: input.currency,
      inputs: { amount: String(amount) },
      formula: `standard amount ${amount}`,
    },
  };
}
