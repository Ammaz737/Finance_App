import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../platform/auth";
import { bills, procurement } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let entityId = "";
let requesterId = "";
let approverId = "";
let approver2Id = "";
let programId = "";
let vendorId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [entityId],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "m8-session",
    correlationId: `m8-${suffix}`,
    ...partial,
  };
}

describe.runIf(runDb)("M8 procurement POs", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `M8 ${suffix}`, slug: `m8-${suffix}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({
      data: { organizationId: org.id, name: "M8 US", country: "US", currency: "USD" },
    });
    entityId = entity.id;
    const [requester, approver, approver2] = await Promise.all([
      prisma.user.create({
        data: { organizationId: org.id, email: `req.${suffix}@m8.test`, passwordHash, firstName: "Req", lastName: "User", status: "ACTIVE" },
      }),
      prisma.user.create({
        data: { organizationId: org.id, email: `apr.${suffix}@m8.test`, passwordHash, firstName: "Apr", lastName: "User", status: "ACTIVE" },
      }),
      prisma.user.create({
        data: { organizationId: org.id, email: `apr2.${suffix}@m8.test`, passwordHash, firstName: "Apr2", lastName: "User", status: "ACTIVE" },
      }),
    ]);
    requesterId = requester.id;
    approverId = approver.id;
    approver2Id = approver2.id;
    const role = await prisma.role.create({ data: { organizationId: org.id, name: "Owner" } });
    let star = await prisma.permission.findUnique({ where: { key: "*" } });
    if (!star) star = await prisma.permission.create({ data: { key: "*", label: "*" } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: star.id, scope: "ORGANIZATION" } });
    await prisma.userRole.createMany({
      data: [
        { organizationId: org.id, userId: requester.id, roleId: role.id },
        { organizationId: org.id, userId: approver.id, roleId: role.id },
        { organizationId: org.id, userId: approver2.id, roleId: role.id },
      ],
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        organizationId: org.id,
        name: "Procurement 2-step",
        objectType: "procurement",
        steps: [{ type: "finance" }, { type: "controller" }],
      },
    });
    const program = await prisma.procurementProgram.create({
      data: {
        organizationId: org.id,
        name: `Software ${suffix}`,
        workflowId: workflow.id,
        defaultOutcomeType: "PURCHASE_ORDER",
      },
    });
    programId = program.id;
    const vendor = await prisma.vendor.create({
      data: { organizationId: org.id, legalEntityId: entity.id, name: `Vendor ${suffix}`, category: "SaaS" },
    });
    vendorId = vendor.id;
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    await prisma.matchRecord.deleteMany({ where: { organizationId: orgId } });
    await prisma.receivingRecord.deleteMany({ where: { organizationId: orgId } });
    await prisma.purchaseOrderLine.deleteMany({ where: { organizationId: orgId } });
    await prisma.purchaseOrder.deleteMany({ where: { organizationId: orgId } });
    await prisma.billLine.deleteMany({ where: { organizationId: orgId } });
    await prisma.bill.deleteMany({ where: { organizationId: orgId } });
    await prisma.accountingEntry.deleteMany({ where: { organizationId: orgId } });
    const instances = await prisma.approvalInstance.findMany({ where: { organizationId: orgId }, select: { id: true } });
    if (instances.length) {
      await prisma.approvalAction.deleteMany({ where: { instanceId: { in: instances.map((i) => i.id) } } });
    }
    await prisma.approvalInstance.deleteMany({ where: { organizationId: orgId } });
    await prisma.inboxItem.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await prisma.purchaseRequest.deleteMany({ where: { organizationId: orgId } });
    await prisma.procurementProgram.deleteMany({ where: { organizationId: orgId } });
    await prisma.approvalWorkflow.deleteMany({ where: { organizationId: orgId } });
    await prisma.vendor.deleteMany({ where: { organizationId: orgId } });
    await prisma.auditEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.outboxEvent.deleteMany({ where: { organizationId: orgId } });
    const roles = await prisma.role.findMany({ where: { organizationId: orgId }, select: { id: true } });
    await prisma.userRole.deleteMany({ where: { organizationId: orgId } });
    if (roles.length) await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map((r) => r.id) } } });
    await prisma.role.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.legalEntity.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it("creates PO only after final approval, with lines and match", async () => {
    const requester = ctx({ userId: requesterId, organizationId: orgId });
    const approver = ctx({ userId: approverId, organizationId: orgId });

    const draft = await procurement.create(requester, {
      name: `Datadog seats ${suffix}`,
      legalEntityId: entityId,
      programId,
      vendorId,
      amount: "100.00",
      currency: "USD",
      outcomeType: "PURCHASE_ORDER",
      memo: "Annual seats",
      lines: [
        { description: "Seats", quantity: 2, unitAmount: "40" },
        { description: "Onboarding", amount: "20" },
      ],
    });
    expect(draft.status).toBe("DRAFT");
    expect(await prisma.purchaseOrder.count({ where: { requestId: draft.id } })).toBe(0);

    await procurement.submit(requester, draft.id);
    await expect(procurement.approve(requester, draft.id)).rejects.toMatchObject({ code: "SOD_VIOLATION" });

    const step1 = await procurement.approve(approver, draft.id);
    expect(step1.approval.status).toBe("IN_REVIEW");
    expect(step1.purchaseOrder).toBeNull();
    expect(await prisma.purchaseOrder.count({ where: { requestId: draft.id } })).toBe(0);

    const step2 = await procurement.approve(ctx({ userId: approver2Id, organizationId: orgId }), draft.id);
    expect(step2.approval.status).toBe("APPROVED");
    expect(step2.purchaseOrder?.id).toBeTruthy();
    expect(step2.request.outcomeId).toBe(step2.purchaseOrder?.id);

    const lines = await prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: step2.purchaseOrder!.id } });
    expect(lines).toHaveLength(2);
    expect(lines.reduce((sum, line) => sum + Number(line.amount), 0)).toBe(100);

    const poId = step2.purchaseOrder!.id;
    expect(step2.request.status).toBe("FULFILLED");
    expect(step2.purchaseOrder?.status).toBe("ISSUED");
    await expect(procurement.receive(approver, poId, { amount: "120" })).rejects.toMatchObject({ code: "RECEIVE_EXCEEDS_PO" });
    await procurement.receive(approver, poId, { amount: "100.00", memo: "Dock delivery" });
    const poAfter = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    expect(poAfter.status).toBe("RECEIVED");
    expect(Number(poAfter.receivedAmount)).toBe(100);

    const bill = await bills.create(approver, {
      vendorId,
      legalEntityId: entityId,
      invoiceNumber: `INV-PO-${suffix}`,
      amount: "100.00",
      currency: "USD",
      purchaseOrderId: poId,
    });
    const match = await procurement.match(approver, poId, { billId: bill.id });
    expect(match.matchType).toBe("THREE_WAY");
    expect(match.status).toBe("MATCHED");
    expect(Number(match.variance)).toBe(0);

    const again = await procurement.match(approver, poId, { billId: bill.id });
    expect(again.id).toBe(match.id);
    expect(await prisma.matchRecord.count({ where: { purchaseOrderId: poId, billId: bill.id } })).toBe(1);
  });

  it("does not create PO for non-PO outcomes", async () => {
    const requester = ctx({ userId: requesterId, organizationId: orgId });
    const approver = ctx({ userId: approverId, organizationId: orgId });
    const approver2 = ctx({ userId: approver2Id, organizationId: orgId });
    const draft = await procurement.create(requester, {
      name: `Vendor setup ${suffix}`,
      legalEntityId: entityId,
      programId,
      amount: "10.00",
      currency: "USD",
      outcomeType: "VENDOR_SETUP",
    });
    await procurement.submit(requester, draft.id);
    await procurement.approve(approver, draft.id);
    const final = await procurement.approve(approver2, draft.id);
    expect(final.request.status).toBe("APPROVED");
    expect(final.purchaseOrder).toBeNull();
    expect(final.request.outcomeId).toMatch(/^vendor_setup_/);
    expect(await prisma.purchaseOrder.count({ where: { requestId: draft.id } })).toBe(0);
  });
});
