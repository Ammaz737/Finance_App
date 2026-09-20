import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword, login } from "../platform/auth";
import { assertEntityPermission, scopedWhere } from "../platform/resource-access";
import { actOnApproval } from "../engines/workflow";
import { people, cards } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";
import { AppError } from "../platform/http";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";

const suffix = Date.now().toString(36);
const sharedEmail = `shared.${suffix}@tenancy.test`;

let acmeOrgId = "";
let betaOrgId = "";
let acmeEntityId = "";
let betaEntityId = "";
let acmeOwnerId = "";
let betaOwnerId = "";
let acmeBillId = "";
let fundId = "";
let cardId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "test-session",
    correlationId: `corr-${suffix}`,
    ...partial,
  };
}

describe.runIf(runDb)("two-tenant postgres matrix", () => {
  beforeAll(async () => {
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const acme = await prisma.organization.create({ data: { name: `Acme ${suffix}`, slug: `acme-${suffix}` } });
    const beta = await prisma.organization.create({ data: { name: `Beta ${suffix}`, slug: `beta-${suffix}` } });
    acmeOrgId = acme.id;
    betaOrgId = beta.id;
    const acmeEntity = await prisma.legalEntity.create({ data: { organizationId: acme.id, name: "Acme US", country: "US", currency: "USD" } });
    const betaEntity = await prisma.legalEntity.create({ data: { organizationId: beta.id, name: "Beta US", country: "US", currency: "USD" } });
    acmeEntityId = acmeEntity.id;
    betaEntityId = betaEntity.id;

    const [acmeOwner, betaOwner] = await Promise.all([
      prisma.user.create({ data: { organizationId: acme.id, email: sharedEmail, passwordHash, firstName: "Acme", lastName: "Owner", status: "ACTIVE" } }),
      prisma.user.create({ data: { organizationId: beta.id, email: sharedEmail, passwordHash, firstName: "Beta", lastName: "Owner", status: "ACTIVE" } }),
    ]);
    acmeOwnerId = acmeOwner.id;
    betaOwnerId = betaOwner.id;

    const acmeRole = await prisma.role.create({ data: { organizationId: acme.id, name: "Owner" } });
    const betaRole = await prisma.role.create({ data: { organizationId: beta.id, name: "Owner" } });
    let star = await prisma.permission.findUnique({ where: { key: "*" } });
    if (!star) star = await prisma.permission.create({ data: { key: "*", label: "*" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: acmeRole.id, permissionId: star.id, scope: "ORGANIZATION" },
        { roleId: betaRole.id, permissionId: star.id, scope: "ORGANIZATION" },
      ],
    });
    await prisma.userRole.createMany({
      data: [
        { organizationId: acme.id, userId: acmeOwner.id, roleId: acmeRole.id },
        { organizationId: beta.id, userId: betaOwner.id, roleId: betaRole.id },
      ],
    });

    const vendor = await prisma.vendor.create({ data: { organizationId: acme.id, legalEntityId: acmeEntity.id, name: `Vendor ${suffix}` } });
    const bill = await prisma.bill.create({
      data: {
        organizationId: acme.id, legalEntityId: acmeEntity.id, vendorId: vendor.id,
        invoiceNumber: `INV-${suffix}`, amount: 100, remainingAmount: 100, currency: "USD",
        status: "APPROVED", createdBy: acmeOwner.id,
      },
    });
    acmeBillId = bill.id;

    const fund = await prisma.fund.create({
      data: {
        organizationId: acme.id, legalEntityId: acmeEntity.id, name: `Fund ${suffix}`,
        ownerId: acmeOwner.id, availableAmount: 10, limitAmount: 10, currency: "USD",
      },
    });
    fundId = fund.id;
    const card = await prisma.card.create({
      data: {
        organizationId: acme.id, legalEntityId: acmeEntity.id, fundId: fund.id,
        holderId: acmeOwner.id, type: "VIRTUAL", last4: "4242", token: `tok-${suffix}`,
      },
    });
    cardId = card.id;
  }, 60_000);

  afterAll(async () => {
    const orgIds = [acmeOrgId, betaOrgId].filter(Boolean);
    if (orgIds.length) {
      await prisma.expense.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.accountingEntry.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.txn.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.cardAuthorization.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.ledgerEntry.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.ledgerTransaction.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.card.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.fund.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.bill.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.vendor.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.session.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.userRole.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: (await prisma.role.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } })).map((r) => r.id) } } });
      await prisma.role.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.auditEvent.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.outboxEvent.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.legalEntity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.$disconnect();
  });

  it("requires workspace for shared email and signs into the selected tenant", async () => {
    await expect(login(sharedEmail, "Password12345")).rejects.toMatchObject({ code: "WORKSPACE_REQUIRED" });
    const beta = await login(sharedEmail, "Password12345", `beta-${suffix}`);
    expect(beta.user.organizationId).toBe(betaOrgId);
    expect(beta.user.id).toBe(betaOwnerId);
  });

  it("denies cross-tenant bill scope and entity writes", async () => {
    const betaCtx = ctx({
      userId: betaOwnerId,
      organizationId: betaOrgId,
      entityIds: [betaEntityId],
      roles: ["Finance"],
      permissions: ["bill.create", "payment.create"],
      grants: [
        { permission: "bill.create", scope: "ENTITY", entityId: betaEntityId },
        { permission: "payment.create", scope: "ENTITY", entityId: betaEntityId },
      ],
    });
    const where = await scopedWhere(betaCtx, "bills");
    expect(where).toEqual({ organizationId: betaOrgId, OR: [{ legalEntityId: { in: [betaEntityId] } }] });
    const visible = await prisma.bill.findMany({ where: where as never });
    expect(visible.find((bill) => bill.id === acmeBillId)).toBeUndefined();
    expect(() => assertEntityPermission(betaCtx, "payment.create", acmeEntityId)).toThrow(/this entity/);
  });

  it("rejects self-approval on an approval instance", async () => {
    const instance = await prisma.approvalInstance.create({
      data: {
        organizationId: acmeOrgId,
        workflowId: "default",
        objectType: "spend_request",
        objectId: crypto.randomUUID(),
        requesterId: acmeOwnerId,
        status: "IN_REVIEW",
        currentStep: 0,
      },
    });
    await expect(actOnApproval({ instanceId: instance.id, actorId: acmeOwnerId, action: "approve" }))
      .rejects.toMatchObject({ code: "SOD_VIOLATION" });
    await prisma.approvalInstance.delete({ where: { id: instance.id } });
  });

  it("activates a draft person with a one-time token", async () => {
    const ownerCtx = ctx({ userId: acmeOwnerId, organizationId: acmeOrgId, roles: ["Owner"], permissions: ["*"] });
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId: acmeOrgId, name: "Owner" } });
    const invited = await people.create(ownerCtx, {
      email: `invite.${suffix}@tenancy.test`,
      firstName: "Invite",
      lastName: "User",
      roleId: role.id,
    });
    expect(invited.activationToken).toBeTruthy();
    expect(invited.status).toBe("DRAFT");
    // Placeholder credentials must not authenticate before activation.
    await expect(login(`invite.${suffix}@tenancy.test`, "Anything12345", `acme-${suffix}`))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const activated = await people.activate({
      email: `invite.${suffix}@tenancy.test`,
      workspace: `acme-${suffix}`,
      token: invited.activationToken,
      password: "Activated12345",
    });
    expect(activated.status).toBe("ACTIVE");
    const session = await login(`invite.${suffix}@tenancy.test`, "Activated12345", `acme-${suffix}`);
    expect(session.user.id).toBe(invited.id);
  });

  it("allows only one concurrent authorization against a limited fund", async () => {
    process.env.NODE_ENV = "development";
    const ownerCtx = ctx({ userId: acmeOwnerId, organizationId: acmeOrgId, roles: ["Owner"], permissions: ["*", "card.issue"] });
    const results = await Promise.allSettled([
      cards.authorize(ownerCtx, {
        cardId, amount: "8.00", currency: "USD", merchant: "A", merchantCategory: "general",
        idempotencyKey: `auth-a-${suffix}`,
      }),
      cards.authorize(ownerCtx, {
        cardId, amount: "8.00", currency: "USD", merchant: "B", merchantCategory: "general",
        idempotencyKey: `auth-b-${suffix}`,
      }),
    ]);
    const fulfilled = results.filter((item) => item.status === "fulfilled").map((item) => (item as PromiseFulfilledResult<{ decision: string }>).value);
    const approved = fulfilled.filter((item) => item.decision === "APPROVED");
    const declined = fulfilled.filter((item) => item.decision === "DECLINED");
    expect(approved.length).toBe(1);
    expect(declined.length + (results.length - fulfilled.length)).toBeGreaterThanOrEqual(1);
    const fund = await prisma.fund.findUniqueOrThrow({ where: { id: fundId } });
    expect(Number(fund.availableAmount)).toBeLessThanOrEqual(2);
  });

  it("replays changed authorization payload under the same key as conflict", async () => {
    const ownerCtx = ctx({ userId: acmeOwnerId, organizationId: acmeOrgId, roles: ["Owner"], permissions: ["*", "card.issue"] });
    // Top up fund for this replay check
    await prisma.fund.update({ where: { id: fundId }, data: { availableAmount: 50 } });
    const key = `replay-${suffix}`;
    const first = await cards.authorize(ownerCtx, {
      cardId, amount: "5.00", currency: "USD", merchant: "Replay", merchantCategory: "general", idempotencyKey: key,
    });
    expect(first.decision).toBe("APPROVED");
    await expect(cards.authorize(ownerCtx, {
      cardId, amount: "6.00", currency: "USD", merchant: "Replay", merchantCategory: "general", idempotencyKey: key,
    })).rejects.toBeInstanceOf(AppError);
  });
});
