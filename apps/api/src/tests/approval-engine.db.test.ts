import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  actOnApproval,
  escalateApproval,
  reassignApproval,
  startApproval,
} from "../engines/workflow";
import { hashPassword } from "../platform/auth";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let requesterId = "";
let managerId = "";
let financeId = "";
let finance2Id = "";
let workflowId = "";

describe.runIf(runDb)("approval engine DB foundation", () => {
  beforeAll(async () => {
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `Appr ${suffix}`, slug: `appr-${suffix}` } });
    orgId = org.id;
    const [requester, manager, finance, finance2] = await Promise.all([
      prisma.user.create({ data: { organizationId: org.id, email: `req.${suffix}@t.test`, passwordHash, firstName: "Req", lastName: "U", status: "ACTIVE" } }),
      prisma.user.create({ data: { organizationId: org.id, email: `mgr.${suffix}@t.test`, passwordHash, firstName: "Mgr", lastName: "U", status: "ACTIVE" } }),
      prisma.user.create({ data: { organizationId: org.id, email: `fin.${suffix}@t.test`, passwordHash, firstName: "Fin", lastName: "U", status: "ACTIVE" } }),
      prisma.user.create({ data: { organizationId: org.id, email: `fin2.${suffix}@t.test`, passwordHash, firstName: "Fin2", lastName: "U", status: "ACTIVE" } }),
    ]);
    requesterId = requester.id;
    managerId = manager.id;
    financeId = finance.id;
    finance2Id = finance2.id;
    await prisma.user.update({ where: { id: requesterId }, data: { managerId } });

    const finRole = await prisma.role.create({ data: { organizationId: org.id, name: "Finance Admin" } });
    let perm = await prisma.permission.findUnique({ where: { key: "*" } });
    if (!perm) perm = await prisma.permission.create({ data: { key: "*", label: "*" } });
    await prisma.rolePermission.create({ data: { roleId: finRole.id, permissionId: perm.id, scope: "ORGANIZATION" } });
    await prisma.userRole.createMany({
      data: [
        { organizationId: org.id, userId: financeId, roleId: finRole.id },
        { organizationId: org.id, userId: finance2Id, roleId: finRole.id },
      ],
    });

    const workflow = await prisma.approvalWorkflow.create({
      data: {
        organizationId: org.id,
        name: `WF ${suffix}`,
        objectType: `test_object_${suffix}`,
        version: 3,
        steps: [
          { type: "manager" },
          { type: "finance", mode: "parallel", parallelGroup: "dual" },
          { type: "finance", mode: "parallel", parallelGroup: "dual", userId: finance2Id },
        ],
      },
    });
    workflowId = workflow.id;
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    const instances = await prisma.approvalInstance.findMany({ where: { organizationId: orgId }, select: { id: true } });
    await prisma.approvalAction.deleteMany({ where: { instanceId: { in: instances.map((i) => i.id) } } });
    await prisma.inboxItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.approvalInstance.deleteMany({ where: { organizationId: orgId } });
    await prisma.approvalWorkflow.deleteMany({ where: { organizationId: orgId } });
    await prisma.userRole.deleteMany({ where: { organizationId: orgId } });
    const roles = await prisma.role.findMany({ where: { organizationId: orgId }, select: { id: true } });
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map((r) => r.id) } } });
    await prisma.role.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it("pins workflow version and blocks self-approval", async () => {
    const { instance, workflowVersion } = await startApproval({
      organizationId: orgId,
      workflowId,
      objectType: `test_object_${suffix}`,
      objectId: `obj-self-${suffix}`,
      requesterId,
      amount: 100,
    });
    expect(workflowVersion).toBe(3);
    expect(instance.workflowVersion).toBe(3);
    await expect(actOnApproval({
      instanceId: instance.id, actorId: requesterId, action: "approve",
    })).rejects.toMatchObject({ code: "SOD_VIOLATION" });
  });

  it("enforces sequential manager then parallel finance SoD", async () => {
    const { instance } = await startApproval({
      organizationId: orgId,
      workflowId,
      objectType: `test_object_${suffix}`,
      objectId: `obj-seq-${suffix}`,
      requesterId,
      amount: 100,
    });
    const afterManager = await actOnApproval({
      instanceId: instance.id, actorId: managerId, action: "approve",
    });
    expect(afterManager.status).toBe("IN_REVIEW");
    expect(afterManager.currentStep).toBeGreaterThanOrEqual(1);

    const afterFin1 = await actOnApproval({
      instanceId: afterManager.id, actorId: financeId, action: "approve",
    });
    expect(afterFin1.status).toBe("IN_REVIEW");

    // Step 2 is locked to finance2 — finance1 is not eligible (and manager→finance SoD already applied).
    await expect(actOnApproval({
      instanceId: afterFin1.id, actorId: financeId, action: "approve",
    })).rejects.toMatchObject({ code: "NOT_ASSIGNED" });

    // Distinct control SoD: same eligible actor cannot approve manager then finance
    const sodWorkflow = await prisma.approvalWorkflow.create({
      data: {
        organizationId: orgId,
        name: `SOD ${suffix}`,
        objectType: `sod_object_${suffix}`,
        version: 1,
        steps: [
          { type: "manager", userId: financeId },
          { type: "finance", userId: financeId },
        ],
      },
    });
    const { instance: sodInstance } = await startApproval({
      organizationId: orgId,
      workflowId: sodWorkflow.id,
      objectType: `sod_object_${suffix}`,
      objectId: `obj-sod-${suffix}`,
      requesterId,
      amount: 100,
    });
    await actOnApproval({ instanceId: sodInstance.id, actorId: financeId, action: "approve" });
    await expect(actOnApproval({
      instanceId: sodInstance.id, actorId: financeId, action: "approve",
    })).rejects.toMatchObject({ code: "SOD_VIOLATION" });

    const done = await actOnApproval({
      instanceId: afterFin1.id, actorId: finance2Id, action: "approve",
    });
    expect(done.status).toBe("APPROVED");
  });

  it("supports reassignment and escalation", async () => {
    const { instance } = await startApproval({
      organizationId: orgId,
      workflowId,
      objectType: `test_object_${suffix}`,
      objectId: `obj-esc-${suffix}`,
      requesterId,
      amount: 50,
    });
    await expect(reassignApproval({
      instanceId: instance.id,
      organizationId: orgId,
      actorId: managerId,
      assigneeUserId: requesterId,
    })).rejects.toMatchObject({ code: "SOD_VIOLATION" });

    const reassigned = await reassignApproval({
      instanceId: instance.id,
      organizationId: orgId,
      actorId: managerId,
      assigneeUserId: financeId,
    });
    expect(reassigned.assigneeUserId).toBe(financeId);

    await prisma.approvalInstance.update({
      where: { id: instance.id },
      data: { dueAt: new Date(Date.now() - 60_000), assigneeUserId: null },
    });
    const escalated = await escalateApproval({
      instanceId: instance.id,
      organizationId: orgId,
    });
    expect(escalated.status).toBe("ESCALATED");
    expect(escalated.escalatedAt).toBeTruthy();
  });
});
