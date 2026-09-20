import { describe, expect, it } from "vitest";
import { calculateReimbursement, DEFAULT_MILEAGE_RATE_USD, DEFAULT_PER_DIEM_RATE_USD } from "../modules/reimbursements/domain/calc";

describe("reimbursement calc", () => {
  it("calculates mileage from distance × rate", () => {
    const result = calculateReimbursement({
      type: "MILEAGE",
      currency: "USD",
      distanceMiles: "100",
    });
    expect(Number(result.mileageRate)).toBe(Number(DEFAULT_MILEAGE_RATE_USD));
    expect(Number(result.amount)).toBe(67);
    expect(result.breakdown.formula).toContain("100");
  });

  it("calculates per diem from nights × rate", () => {
    const result = calculateReimbursement({
      type: "PER_DIEM",
      currency: "USD",
      perDiemNights: 2,
    });
    expect(Number(result.perDiemRate)).toBe(Number(DEFAULT_PER_DIEM_RATE_USD));
    expect(Number(result.amount)).toBe(150);
  });

  it("uses client amount only for STANDARD", () => {
    const result = calculateReimbursement({
      type: "STANDARD",
      currency: "USD",
      amount: "42.50",
    });
    expect(Number(result.amount)).toBe(42.5);
  });
});
