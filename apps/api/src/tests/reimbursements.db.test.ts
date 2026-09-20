import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../platform/auth";
import { reimbursements } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";
import { ingestDocument } from "../engines/documents";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let entityId = "";
let employeeId = "";
let approverId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [entityId],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "m5-session",
    correlationId: `m5-${suffix}`,
    ...partial,
  };
}

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

describe.runIf(runDb)("M5 reimbursements", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `M5 ${suffix}`, slug: `m5-${suffix}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({
      data: { organizationId: org.id, name: "M5 US", country: "US", currency: "USD" },
    });
    entityId = entity.id;
    const [employee, approver] = await Promise.all([
      prisma.user.create({
        data: { organizationId: org.id, email: `emp.${suffix}@m5.test`, passwordHash, firstName: "Emp", lastName: "User", status: "ACTIVE" },
      }),
      prisma.user.create({
        data: { organizationId: org.id, email: `apr.${suffix}@m5.test`, passwordHash, firstName: "Apr", lastName: "User", status: "ACTIVE" },
      }),
    ]);
    employeeId = employee.id;
    approverId = approver.id;
    const role = await prisma.role.create({ data: { organizationId: org.id, name: "Owner" } });
    let star = await prisma.permission.findUnique({ where: { key: "*" } });
    if (!star) star = await prisma.permission.create({ data: { key: "*", label: "*" } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: star.id, scope: "ORGANIZATION" } });
    await prisma.userRole.createMany({
      data: [
        { organizationId: org.id, userId: employee.id, roleId: role.id },
        { organizationId: org.id, userId: approver.id, roleId: role.id },
      ],
    });
    await prisma.approvalWorkflow.create({
      data: {
        organizationId: org.id,
        name: "Reimbursement",
        objectType: "reimbursement",
        steps: [{ name: "Manager", role: "Owner" }],
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    await prisma.accountingEntry.deleteMany({ where: { organizationId: orgId } });
    await prisma.receipt.deleteMany({ where: { organizationId: orgId } });
    await prisma.attachment.deleteMany({ where: { organizationId: orgId } });
    await prisma.reimbursement.deleteMany({ where: { organizationId: orgId } });
    await prisma.inboxItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.approvalAction.deleteMany({
      where: { instanceId: { in: (await prisma.approvalInstance.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((i) => i.id) } },
    });
    await prisma.approvalInstance.deleteMany({ where: { organizationId: orgId } });
    await prisma.approvalWorkflow.deleteMany({ where: { organizationId: orgId } });
    await prisma.auditEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.outboxEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.userRole.deleteMany({ where: { organizationId: orgId } });
    await prisma.rolePermission.deleteMany({
      where: { roleId: { in: (await prisma.role.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((r) => r.id) } },
    });
    await prisma.role.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.legalEntity.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it("calculates mileage server-side and pays only after schedule + confirm", async () => {
    process.env.NODE_ENV = "development";
    const employee = ctx({
      userId: employeeId,
      organizationId: orgId,
      permissions: ["*", "reimbursement.create"],
    });
    const approver = ctx({
      userId: approverId,
      organizationId: orgId,
      permissions: ["*", "reimbursement.approve", "reimbursement.pay"],
    });

    const created = await reimbursements.create(employee, {
      legalEntityId: entityId,
      type: "MILEAGE",
      currency: "USD",
      memo: "Client visit drive",
      distanceMiles: "100",
    });
    expect(Number(created.amount)).toBe(67);
    expect(created.status).toBe("IN_REVIEW");

    const approved = await reimbursements.approve(approver, created.id);
    const approvedStatus = "reimbursement" in approved ? approved.reimbursement.status : approved.status;
    expect(approvedStatus).toBe("APPROVED");
    const accountingAfterApprove = await prisma.accountingEntry.findMany({
      where: { organizationId: orgId, sourceType: "REIMBURSEMENT", sourceId: created.id },
    });
    expect(accountingAfterApprove).toHaveLength(0);

    const scheduled = await reimbursements.schedule(approver, created.id, { rail: "ACH" });
    expect(scheduled.status).toBe("SCHEDULED");
    expect(scheduled.providerRef).toMatch(/^mock_payout_/);

    const paid = await reimbursements.confirmPayout(approver, created.id);
    expect(paid.reimbursement.status).toBe("PAID");
    expect(paid.accounting?.sourceType).toBe("REIMBURSEMENT");

    const again = await reimbursements.confirmPayout(approver, created.id);
    expect(again.accounting?.id).toBe(paid.accounting?.id);
    const accountingRows = await prisma.accountingEntry.findMany({
      where: { organizationId: orgId, sourceType: "REIMBURSEMENT", sourceId: created.id },
    });
    expect(accountingRows).toHaveLength(1);
  });

  it("blocks high-value standard submit without receipt, then accepts with receipt", async () => {
    process.env.NODE_ENV = "development";
    const employee = ctx({
      userId: employeeId,
      organizationId: orgId,
      permissions: ["*", "reimbursement.create", "expense.create"],
    });

    await expect(reimbursements.create(employee, {
      legalEntityId: entityId,
      type: "STANDARD",
      currency: "USD",
      memo: "Conference hotel",
      amount: "120.00",
    })).rejects.toMatchObject({ code: "REIMBURSEMENT_POLICY_BLOCK" });

    const attachment = await ingestDocument(employee, tinyPng(), {
      name: `hotel-120-${suffix}.png`,
      mimeType: "image/png",
      classification: "RECEIPT",
    });
    const created = await reimbursements.create(employee, {
      legalEntityId: entityId,
      type: "STANDARD",
      currency: "USD",
      memo: "Conference hotel",
      amount: "120.00",
      attachmentId: attachment.id,
    });
    expect(created.receiptId).toBeTruthy();
    expect(Number(created.amount)).toBe(120);
  });

  it("rejects self-approval", async () => {
    const employee = ctx({
      userId: employeeId,
      organizationId: orgId,
      permissions: ["*", "reimbursement.create", "reimbursement.approve"],
    });
    const created = await reimbursements.create(employee, {
      legalEntityId: entityId,
      type: "PER_DIEM",
      currency: "USD",
      memo: "Travel nights",
      perDiemNights: 1,
      attachmentId: (await ingestDocument(employee, tinyPng(), {
        name: `perdiem-${suffix}.png`,
        mimeType: "image/png",
        classification: "RECEIPT",
      })).id,
    });
    expect(Number(created.amount)).toBe(75);
    await expect(reimbursements.approve(employee, created.id)).rejects.toMatchObject({ code: "SOD_VIOLATION" });
  });
});
