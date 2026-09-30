import { describe, expect, it } from "vitest";
import {
  eligibleForStep,
  progressLabel,
  resolveWorkflowSteps,
  type WorkflowStep,
} from "../engines/workflow";

describe("approval engine foundation", () => {
  it("resolves eligible approvers by user, role, and manager type", () => {
    expect(eligibleForStep({
      step: { userId: "u1" }, actorId: "u1", actorRoles: [], managerId: null,
    })).toBe(true);
    expect(eligibleForStep({
      step: { role: "Finance Admin" }, actorId: "u2", actorRoles: ["Finance Admin"], managerId: null,
    })).toBe(true);
    expect(eligibleForStep({
      step: { type: "manager" }, actorId: "mgr", actorRoles: [], managerId: "mgr",
    })).toBe(true);
    expect(eligibleForStep({
      step: { type: "manager" }, actorId: "other", actorRoles: ["Finance Admin"], managerId: "mgr",
    })).toBe(false);
    expect(eligibleForStep({
      step: { type: "manager" }, actorId: "owner", actorRoles: ["Owner"], managerId: "mgr",
    })).toBe(true);
    expect(eligibleForStep({
      step: { type: "finance" }, actorId: "x", actorRoles: ["Employee"], managerId: null,
    })).toBe(false);
  });

  it("prevents assignee override from matching non-assignee", () => {
    expect(eligibleForStep({
      step: { type: "finance" },
      actorId: "finance-1",
      actorRoles: ["Finance Admin"],
      managerId: null,
      assigneeUserId: "other",
    })).toBe(false);
    expect(eligibleForStep({
      step: { type: "finance" },
      actorId: "other",
      actorRoles: ["Employee"],
      managerId: null,
      assigneeUserId: "other",
    })).toBe(true);
  });

  it("routes steps by amount, department, and entity", () => {
    const steps: WorkflowStep[] = [
      { type: "manager", maxAmount: 999 },
      { type: "finance", minAmount: 1000 },
      { type: "controller", minAmount: 10000, departmentId: "dept-a", legalEntityId: "ent-1" },
      { type: "ap", departmentId: "dept-b" },
    ];
    expect(resolveWorkflowSteps({ steps, amount: 500, departmentId: "dept-a", legalEntityId: "ent-1" }).map((s) => s.type))
      .toEqual(["manager"]);
    expect(resolveWorkflowSteps({ steps, amount: 5000, departmentId: "dept-a", legalEntityId: "ent-1" }).map((s) => s.type))
      .toEqual(["finance"]);
    expect(resolveWorkflowSteps({ steps, amount: 15000, departmentId: "dept-a", legalEntityId: "ent-1" }).map((s) => s.type))
      .toEqual(["finance", "controller"]);
    expect(resolveWorkflowSteps({ steps, amount: 100, departmentId: "dept-b", legalEntityId: "ent-2" }).map((s) => s.type))
      .toEqual(["manager", "ap"]);
  });

  it("identifies parallel step groups", () => {
    const steps: WorkflowStep[] = [
      { type: "manager", mode: "parallel", parallelGroup: "g1" },
      { type: "finance", mode: "parallel", parallelGroup: "g1" },
      { type: "controller" },
    ];
    expect(steps.filter((s) => s.mode === "parallel" && s.parallelGroup === "g1")).toHaveLength(2);
  });

  it("labels sequential and escalated progress", () => {
    expect(progressLabel(1, 3, "IN_REVIEW")).toBe("1 of 3 approvals");
    expect(progressLabel(2, 3, "ESCALATED")).toBe("Escalated — 2 of 3 approvals");
    expect(progressLabel(3, 3, "APPROVED")).toBe("Approved");
  });
});
