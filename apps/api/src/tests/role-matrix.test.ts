import { describe, expect, it } from "vitest";
import {
  ROLE_PAGE_MODULES,
  assertValidMatrixSelection,
  isCapabilityAvailable,
  permissionKeysFromSelection,
  selectionFromPermissionKeys,
} from "@finance/permissions";

describe("role permission matrix", () => {
  it("disables delete on read-only audit page", () => {
    const audit = ROLE_PAGE_MODULES.find((page) => page.id === "company.audit");
    expect(audit).toBeTruthy();
    expect(isCapabilityAvailable(audit!, "read")).toBe(true);
    expect(isCapabilityAvailable(audit!, "write")).toBe(false);
    expect(isCapabilityAvailable(audit!, "edit")).toBe(false);
    expect(isCapabilityAvailable(audit!, "delete")).toBe(false);
  });

  it("rejects enabling an unavailable capability", () => {
    expect(() =>
      assertValidMatrixSelection({
        "company.audit": { read: true, delete: true },
      }),
    ).toThrow(/does not support delete/i);
  });

  it("maps selection to domain keys without inventing unavailable actions", () => {
    const keys = permissionKeysFromSelection({
      "company.audit": { read: true },
      "travel.requests": { read: true, edit: true, write: true },
    });
    expect(keys).toEqual(["audit.read", "travel.approve"]);
  });

  it("round-trips common grants through selection helpers", () => {
    const keys = ["people.read", "people.invite", "expense.read"];
    const selection = selectionFromPermissionKeys(keys);
    expect(selection["company.people"]?.read).toBe(true);
    expect(selection["company.people"]?.write).toBe(true);
    expect(selection["me.expenses"]?.read).toBe(true);
    expect(permissionKeysFromSelection(selection)).toEqual(
      expect.arrayContaining(["people.read", "people.invite", "expense.read"]),
    );
  });

  it("never exposes wildcard through the matrix", () => {
    const all = permissionKeysFromSelection(
      Object.fromEntries(
        ROLE_PAGE_MODULES.map((page) => [
          page.id,
          {
            read: isCapabilityAvailable(page, "read"),
            write: isCapabilityAvailable(page, "write"),
            edit: isCapabilityAvailable(page, "edit"),
            delete: isCapabilityAvailable(page, "delete"),
          },
        ]),
      ),
    );
    expect(all).not.toContain("*");
  });
});
