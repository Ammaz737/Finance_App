import { describe, expect, it } from "vitest";
import { evaluateBillDuplicate } from "../modules/ap/domain/duplicate-check";
import { matchVendor, normalizeVendorName } from "../modules/ap/domain/vendor-match";

describe("vendor match", () => {
  it("matches exact normalized names and tax ids", () => {
    const result = matchVendor({
      extractedName: "Acme Supplies, Inc.",
      taxId: "12-3456789",
      candidates: [
        { id: "v1", name: "Acme Supplies", legalName: "Acme Supplies Inc", taxId: "123456789" },
        { id: "v2", name: "Other Co", taxId: "999" },
      ],
    });
    expect(normalizeVendorName("Acme Supplies, Inc.")).toBe("acme supplies");
    expect(result.decision).toBe("MATCHED");
    expect(result.vendorId).toBe("v1");
  });

  it("returns NO_MATCH when nothing aligns", () => {
    const result = matchVendor({
      extractedName: "Zebra Widgets",
      candidates: [{ id: "v1", name: "Acme Supplies" }],
    });
    expect(result.decision).toBe("NO_MATCH");
  });
});

describe("bill duplicate check", () => {
  it("blocks exact invoice numbers", () => {
    const result = evaluateBillDuplicate({
      invoiceNumber: "INV-1",
      amount: 100,
      currency: "USD",
      existing: [{ id: "b1", invoiceNumber: "INV-1", amount: 50, currency: "USD", status: "APPROVED" }],
    });
    expect(result.decision).toBe("DUPLICATE_BLOCKED");
  });

  it("flags near amount+date as possible duplicate", () => {
    const result = evaluateBillDuplicate({
      invoiceNumber: "INV-2",
      amount: 100,
      currency: "USD",
      invoiceDate: "2026-09-20",
      existing: [{
        id: "b1", invoiceNumber: "INV-9", amount: 100.5, currency: "USD",
        invoiceDate: "2026-09-21", status: "APPROVED",
      }],
    });
    expect(result.decision).toBe("POSSIBLE_DUPLICATE");
  });

  it("clears when invoice numbers differ without dates", () => {
    const result = evaluateBillDuplicate({
      invoiceNumber: "INV-3",
      amount: 100,
      currency: "USD",
      existing: [{ id: "b1", invoiceNumber: "INV-9", amount: 100, currency: "USD", status: "APPROVED" }],
    });
    expect(result.decision).toBe("CLEAR");
  });
});
