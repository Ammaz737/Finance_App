import { describe, expect, it } from "vitest";
import { calculateReimbursement, DEFAULT_MILEAGE_RATE_USD, DEFAULT_PER_DIEM_RATE_USD } from "../modules/reimbursements/domain/calc";
import { evaluateReimbursementDuplicate } from "../modules/reimbursements/domain/duplicate";
import { evaluateReimbursementRequirements } from "../modules/reimbursements/domain/requirements";

describe("reimbursement calc", () => {
  it("calculates mileage from distance × rate and ignores forged amount/rate", () => {
    const result = calculateReimbursement({
      type: "MILEAGE",
      currency: "USD",
      distanceMiles: "100",
      amount: "9999",
      mileageRate: "9.99",
    });
    expect(Number(result.mileageRate)).toBe(Number(DEFAULT_MILEAGE_RATE_USD));
    expect(Number(result.amount)).toBe(67);
    expect(result.breakdown.formula).toContain("100");
  });

  it("calculates per diem from nights × rate and ignores forged amount", () => {
    const result = calculateReimbursement({
      type: "PER_DIEM",
      currency: "USD",
      perDiemNights: 2,
      amount: "1.00",
      perDiemRate: "999",
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

describe("reimbursement requirements + duplicates", () => {
  it("requires receipt for standard over threshold", () => {
    const incomplete = evaluateReimbursementRequirements({
      type: "STANDARD",
      hasReceipt: false,
      hasMemo: true,
      hasCategory: false,
      requireReceipt: true,
    });
    expect(incomplete.complete).toBe(false);
    expect(incomplete.missing).toContain("Receipt");
  });

  it("blocks exact duplicate merchant/date/amount", () => {
    const result = evaluateReimbursementDuplicate({
      userId: "u1",
      type: "STANDARD",
      amount: 50,
      currency: "USD",
      merchant: "Uber",
      expenseDate: "2026-09-01",
      existing: [{
        id: "r1", userId: "u1", type: "STANDARD", amount: 50, currency: "USD",
        merchant: "Uber", expenseDate: "2026-09-01", status: "IN_REVIEW",
      }],
    });
    expect(result.decision).toBe("BLOCKED_DUPLICATE");
  });
});
