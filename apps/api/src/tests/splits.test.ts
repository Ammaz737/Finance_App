import { describe, expect, it } from "vitest";

function splitsBalance(total: number, parts: number[]) {
  return Math.abs(parts.reduce((sum, part) => sum + part, 0) - total) < 0.001;
}

describe("expense splits", () => {
  it("must balance exactly", () => {
    expect(splitsBalance(100, [40, 60])).toBe(true);
    expect(splitsBalance(100, [40, 59])).toBe(false);
  });
});
