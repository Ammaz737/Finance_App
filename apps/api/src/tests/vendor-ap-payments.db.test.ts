import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../platform/auth";
import { bills, payments, paymentRuns, vendors } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let entityId = "";
let creatorId = "";
let approverId = "";
let releaserId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [entityId],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "m6-session",
    correlationId: `m6-${suffix}`,
    ...partial,
  };
}

describe.runIf(runDb)("M6 vendor AP payments", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `M6 ${suffix}`, slug: `m6-${suffix}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({
      data: { organizationId: org.id, name: "M6 US", country: "US", currency: "USD" },
    });
    entityId = entity.id;
    await prisma.countryCapability.create({
      data: { organizationId: org.id, country: "US", billPaySupported: true, rails: ["ACH", "WIRE", "CHECK"] },
    });
    const [creator, approver, releaser] = await Promise.all([
      prisma.user.create({
        data: { organizationId: org.id, email: `create.${suffix}@m6.test`, passwordHash, firstName: "Create", lastName: "User", status: "ACTIVE" },
      }),
      prisma.user.create({
        data: { organizationId: org.id, email: `approve.${suffix}@m6.test`, passwordHash, firstName: "Approve", lastName: "User", status: "ACTIVE" },
      }),
      prisma.user.create({
        data: { organizationId: org.id, email: `release.${suffix}@m6.test`, passwordHash, firstName: "Release", lastName: "User", status: "ACTIVE" },
      }),
    ]);
    creatorId = creator.id;
    approverId = approver.id;
    releaserId = releaser.id;
    const role = await prisma.role.create({ data: { organizationId: org.id, name: "Owner" } });
    let star = await prisma.permission.findUnique({ where: { key: "*" } });
    if (!star) star = await prisma.permission.create({ data: { key: "*", label: "*" } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: star.id, scope: "ORGANIZATION" } });
    await prisma.userRole.createMany({
      data: [
        { organizationId: org.id, userId: creator.id, roleId: role.id },
        { organizationId: org.id, userId: approver.id, roleId: role.id },
        { organizationId: org.id, userId: releaser.id, roleId: role.id },
      ],
    });
    await prisma.approvalWorkflow.create({
      data: {
        organizationId: org.id,
        name: "Bill",
        objectType: "bill",
        steps: [{ name: "AP", role: "Owner" }],
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    const instances = await prisma.approvalInstance.findMany({ where: { organizationId: orgId }, select: { id: true } });
    const roles = await prisma.role.findMany({ where: { organizationId: orgId }, select: { id: true } });
    await prisma.accountingEntry.deleteMany({ where: { organizationId: orgId } });
    await prisma.payment.deleteMany({ where: { organizationId: orgId } });
    await prisma.paymentRun.deleteMany({ where: { organizationId: orgId } });
    await prisma.billLine.deleteMany({ where: { organizationId: orgId } });
    await prisma.bill.deleteMany({ where: { organizationId: orgId } });
    await prisma.vendorBankAccount.deleteMany({ where: { organizationId: orgId } });
    await prisma.vendor.deleteMany({ where: { organizationId: orgId } });
    if (instances.length) {
      await prisma.approvalAction.deleteMany({ where: { instanceId: { in: instances.map((row) => row.id) } } });
    }
    await prisma.approvalInstance.deleteMany({ where: { organizationId: orgId } });
    await prisma.inboxItem.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await prisma.approvalWorkflow.deleteMany({ where: { organizationId: orgId } });
    await prisma.auditEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.outboxEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.idempotencyKey.deleteMany({ where: { organizationId: orgId } });
    await prisma.userRole.deleteMany({ where: { organizationId: orgId } });
    if (roles.length) {
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map((row) => row.id) } } });
    }
    await prisma.role.deleteMany({ where: { organizationId: orgId } });
    await prisma.countryCapability.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.legalEntity.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it("blocks duplicate vendor/invoice, enforces SoD, partial settle once", async () => {
    const creator = ctx({ userId: creatorId, organizationId: orgId });
    const approver = ctx({ userId: approverId, organizationId: orgId });
    const releaser = ctx({ userId: releaserId, organizationId: orgId });

    const vendor = await vendors.create(creator, {
      name: `Acme Supplies ${suffix}`,
      legalEntityId: entityId,
      category: "Office",
      riskLevel: "MEDIUM",
    });
    await expect(vendors.create(creator, {
      name: `acme supplies ${suffix}`,
      legalEntityId: entityId,
    })).rejects.toMatchObject({ code: "DUPLICATE_VENDOR" });

    const bank1 = await vendors.setBankAccount(creator, vendor.id, {
      last4: "1111", routingMasked: "****111", changeReason: "Initial setup",
    });
    const bank2 = await vendors.setBankAccount(creator, vendor.id, {
      last4: "2222", routingMasked: "****222", changeReason: "Vendor updated ACH",
    });
    expect(bank2.isCurrent).toBe(true);
    const history = await prisma.vendorBankAccount.findMany({ where: { vendorId: vendor.id } });
    expect(history).toHaveLength(2);
    expect(history.find((row) => row.id === bank1.id)?.isCurrent).toBe(false);

    const bill = await bills.create(creator, {
      vendorId: vendor.id,
      legalEntityId: entityId,
      invoiceNumber: `INV-${suffix}`,
      amount: "100.00",
      currency: "USD",
      memo: "Office chairs",
      lines: [
        { description: "Chair A", amount: "60.00", category: "Furniture" },
        { description: "Chair B", amount: "40.00", category: "Furniture" },
      ],
    });
    await expect(bills.create(creator, {
      vendorId: vendor.id,
      legalEntityId: entityId,
      invoiceNumber: `INV-${suffix}`,
      amount: "10.00",
      currency: "USD",
    })).rejects.toMatchObject({ code: "DUPLICATE_INVOICE" });

    await expect(bills.approve(creator, bill.id)).rejects.toMatchObject({ code: "SOD_VIOLATION" });
    const approved = await bills.approve(approver, bill.id);
    const approvedStatus = "status" in approved ? approved.status : ("bill" in approved ? (approved as { bill: { status: string } }).bill.status : "");
    expect(approvedStatus).toBe("APPROVED");

    await expect(payments.schedule(creator, {
      billId: bill.id, amount: "70.00", rail: "ACH", idempotencyKey: `m6-a-${suffix}`,
    })).resolves.toMatchObject({ status: "SCHEDULED" });
    await expect(payments.schedule(creator, {
      billId: bill.id, amount: "40.00", rail: "ACH", idempotencyKey: `m6-b-${suffix}`,
    })).rejects.toMatchObject({ code: "PAYMENT_EXCEEDS_BALANCE" });

    const first = await payments.schedule(creator, {
      billId: bill.id, amount: "30.00", rail: "ACH", idempotencyKey: `m6-c-${suffix}`,
    });
    await expect(payments.release(creator, first.id)).rejects.toMatchObject({ code: "SOD_VIOLATION" });
    const released = await payments.release(releaser, first.id);
    expect(released.status).toBe("PROCESSING");
    expect(released.providerRef).toMatch(/^mock_rail_/);

    const settled = await payments.confirmSettlement(releaser, first.id);
    expect(settled.payment.status).toBe("SETTLED");
    expect(settled.payment.settlementId).toMatch(/^mock_settle_/);
    expect(Number(settled.bill?.remainingAmount)).toBe(70);
    expect(settled.bill?.status).toBe("PARTIAL");

    const again = await payments.confirmSettlement(releaser, first.id);
    expect(again.payment.settlementId).toBe(settled.payment.settlementId);
    const paymentRows = await prisma.payment.findMany({ where: { id: first.id } });
    expect(paymentRows).toHaveLength(1);
    expect(Number((await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })).remainingAmount)).toBe(70);
  });

  it("releases a payment run transactionally with SoD", async () => {
    const creator = ctx({ userId: creatorId, organizationId: orgId });
    const approver = ctx({ userId: approverId, organizationId: orgId });
    const releaser = ctx({ userId: releaserId, organizationId: orgId });

    const vendor = await vendors.create(creator, {
      name: `Run Vendor ${suffix}`,
      legalEntityId: entityId,
    });
    const bill = await bills.create(creator, {
      vendorId: vendor.id,
      legalEntityId: entityId,
      invoiceNumber: `RUN-${suffix}`,
      amount: "50.00",
      currency: "USD",
    });
    await bills.approve(approver, bill.id);
    const payment = await payments.schedule(creator, {
      billId: bill.id, amount: "50.00", rail: "ACH", idempotencyKey: `m6-run-pay-${suffix}`,
    });
    const run = await paymentRuns.create(creator, { legalEntityId: entityId, name: `Weekly ${suffix}` });
    await paymentRuns.addPayments(creator, run.id, { paymentIds: [payment.id] });
    await expect(paymentRuns.release(creator, run.id)).rejects.toMatchObject({ code: "SOD_VIOLATION" });
    const released = await paymentRuns.release(releaser, run.id);
    expect(released.run.status).toBe("RELEASED");
    expect(released.items[0]?.status).toBe("PROCESSING");
    expect(released.items[0]?.providerRef).toBeTruthy();
  });
});
