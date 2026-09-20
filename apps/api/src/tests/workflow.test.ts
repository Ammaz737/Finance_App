import { describe, expect, it } from "vitest";
import { progressLabel } from "../engines/workflow";

describe("workflow progress", () => {
  it("shows remaining approval steps instead of a generic in-review label", () => {
    expect(progressLabel(2, 6, "IN_REVIEW")).toBe("2 of 6 approvals");
    expect(progressLabel(6, 6, "APPROVED")).toBe("Approved");
  });
});
