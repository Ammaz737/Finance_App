import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../platform/auth";
import { travel } from "../application/actions";
import type { RequestContext } from "../platform/auth/context";

const prisma = new PrismaClient();
const runDb = process.env.RUN_DB_TESTS !== "0";
const suffix = Date.now().toString(36);

let orgId = "";
let entityId = "";
let travelerId = "";
let approverId = "";
let fundId = "";
let expenseId = "";

function ctx(partial: Partial<RequestContext> & Pick<RequestContext, "userId" | "organizationId">): RequestContext {
  return {
    actorType: "INTERNAL_USER",
    entityIds: partial.entityIds ?? [entityId],
    roles: partial.roles ?? ["Owner"],
    permissions: partial.permissions ?? ["*"],
    grants: partial.grants ?? [{ permission: "*", scope: "ORGANIZATION", entityId: null }],
    entitlements: [],
    sessionId: "m9-session",
    correlationId: `m9-${suffix}`,
    ...partial,
  };
}

describe.runIf(runDb)("M9/GF5 core travel", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    await prisma.$connect();
    const passwordHash = await hashPassword("Password12345");
    const org = await prisma.organization.create({ data: { name: `M9 ${suffix}`, slug: `m9-${suffix}` } });
    orgId = org.id;
    const entity = await prisma.legalEntity.create({
      data: { organizationId: org.id, name: "M9 US", country: "US", currency: "USD" },
    });
    entityId = entity.id;
    const [traveler, approver] = await Promise.all([
      prisma.user.create({
        data: { organizationId: org.id, email: `trav.${suffix}@m9.test`, passwordHash, firstName: "Trav", lastName: "User", status: "ACTIVE" },
      }),
      prisma.user.create({
        data: { organizationId: org.id, email: `apr.${suffix}@m9.test`, passwordHash, firstName: "Apr", lastName: "User", status: "ACTIVE" },
      }),
    ]);
    travelerId = traveler.id;
    approverId = approver.id;
    const role = await prisma.role.create({ data: { organizationId: org.id, name: "Owner" } });
    let star = await prisma.permission.findUnique({ where: { key: "*" } });
    if (!star) star = await prisma.permission.create({ data: { key: "*", label: "*" } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: star.id, scope: "ORGANIZATION" } });
    await prisma.userRole.createMany({
      data: [
        { organizationId: org.id, userId: traveler.id, roleId: role.id },
        { organizationId: org.id, userId: approver.id, roleId: role.id },
      ],
    });
    await prisma.approvalWorkflow.create({
      data: {
        organizationId: org.id,
        name: "Travel",
        objectType: "travel",
        steps: [{ type: "finance" }],
      },
    });
    await prisma.policy.create({
      data: {
        organizationId: org.id,
        name: "Travel policy",
        objectType: "travel",
        rules: [{ type: "travel_max_amount", threshold: 2500 }, { type: "travel_out_of_policy" }],
      },
    });
    const fund = await prisma.fund.create({
      data: {
        organizationId: org.id,
        legalEntityId: entity.id,
        name: `Travel fund ${suffix}`,
        ownerId: traveler.id,
        availableAmount: "5000",
        limitAmount: "5000",
        currency: "USD",
      },
    });
    fundId = fund.id;
    const expense = await prisma.expense.create({
      data: {
        organizationId: org.id,
        legalEntityId: entity.id,
        userId: traveler.id,
        amount: "120.00",
        currency: "USD",
        merchant: "Taxi",
        status: "DRAFT",
        memo: "Airport transfer",
      },
    });
    expenseId = expense.id;
  }, 60_000);

  afterAll(async () => {
    if (!orgId) return;
    await prisma.travelBooking.deleteMany({ where: { organizationId: orgId } });
    await prisma.travelTrip.deleteMany({ where: { organizationId: orgId } });
    const instances = await prisma.approvalInstance.findMany({ where: { organizationId: orgId }, select: { id: true } });
    if (instances.length) {
      await prisma.approvalAction.deleteMany({ where: { instanceId: { in: instances.map((i) => i.id) } } });
    }
    await prisma.approvalInstance.deleteMany({ where: { organizationId: orgId } });
    await prisma.inboxItem.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await prisma.expense.deleteMany({ where: { organizationId: orgId } });
    await prisma.card.deleteMany({ where: { organizationId: orgId } });
    await prisma.fund.deleteMany({ where: { organizationId: orgId } });
    await prisma.policy.deleteMany({ where: { organizationId: orgId } });
    await prisma.approvalWorkflow.deleteMany({ where: { organizationId: orgId } });
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

  it("in-policy trip still needs approval before mock book; provisions fund/card after approve", async () => {
    const traveler = ctx({ userId: travelerId, organizationId: orgId });
    const trip = await travel.createTrip(traveler, {
      name: `NYC in-policy ${suffix}`,
      legalEntityId: entityId,
      destination: "New York",
      origin: "SFO",
      purpose: "Customer visit",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      estimatedAmount: "800.00",
      currency: "USD",
    });
    expect(trip.status).toBe("DRAFT");
    expect(trip.destination).toBe("New York");

    const search = await travel.search(traveler, trip.id, { type: "FLIGHT" });
    const inPolicy = search.quotes.find((q) => !q.outOfPolicy);
    expect(inPolicy).toBeTruthy();
    const selected = await travel.selectQuote(traveler, trip.id, {
      quoteId: inPolicy!.quoteId,
      type: "FLIGHT",
      supplier: inPolicy!.supplier,
      description: inPolicy!.description,
      amount: inPolicy!.amount,
      currency: inPolicy!.currency,
      outOfPolicy: false,
      refundable: inPolicy!.refundable,
      offerExpiry: inPolicy!.offerExpiry,
      providerOfferId: inPolicy!.providerOfferId,
      itinerary: inPolicy!.itinerary,
    });
    expect(selected.booking.status).toBe("QUOTED");
    expect(selected.booking.offerSnapshot).toBeTruthy();

    const submitted = await travel.submit(traveler, trip.id);
    expect(submitted.requiresApproval).toBe(true);
    expect(submitted.trip.status).toBe("PENDING_APPROVAL");

    await expect(travel.bookMock(traveler, selected.booking.id)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    const approver = ctx({ userId: approverId, organizationId: orgId });
    const approved = await travel.approve(approver, trip.id);
    expect(approved.trip.status).toBe("READY_TO_BOOK");

    await expect(travel.bookMock(traveler, selected.booking.id)).resolves.toMatchObject({
      status: "BOOKED_MOCK",
      providerStatus: "MOCK_HOLD",
    });
    const held = await prisma.travelBooking.findUniqueOrThrow({ where: { id: selected.booking.id } });
    expect(held.status).not.toBe("CONFIRMED");

    const confirmed = await travel.confirmBooking(traveler, selected.booking.id);
    expect(confirmed.booking.status).toBe("CONFIRMED");
    expect(confirmed.booking.providerStatus).toBe("CONFIRMED");
    expect(confirmed.fund?.id).toBeTruthy();
    expect(confirmed.card?.id).toBeTruthy();
    expect(confirmed.card?.allowedMccs).toContain("airlines");

    const linked = await travel.linkFund(traveler, trip.id, fundId);
    expect(linked.fundId).toBe(fundId);
    const withExpense = await travel.linkExpense(traveler, trip.id, expenseId);
    expect(withExpense.expenseId).toBe(expenseId);

    const detail = await travel.getDetail(traveler, trip.id);
    expect(detail.trip.status).toBe("CONFIRMED");
    expect(detail.bookings[0]?.status).toBe("CONFIRMED");
    expect(detail.audit.length).toBeGreaterThan(0);
  });

  it("out-of-policy requires approval before mock booking; SOD enforced", async () => {
    const traveler = ctx({ userId: travelerId, organizationId: orgId });
    const approver = ctx({ userId: approverId, organizationId: orgId });
    const trip = await travel.createTrip(traveler, {
      name: `NYC OOP ${suffix}`,
      legalEntityId: entityId,
      destination: "New York",
      startDate: "2026-12-01",
      endDate: "2026-12-04",
      estimatedAmount: "500.00",
      currency: "USD",
    });
    const search = await travel.search(traveler, trip.id, { type: "HOTEL" });
    const oop = search.quotes.find((q) => q.outOfPolicy);
    expect(oop).toBeTruthy();
    const selected = await travel.selectQuote(traveler, trip.id, {
      quoteId: oop!.quoteId,
      type: "HOTEL",
      supplier: oop!.supplier,
      description: oop!.description,
      amount: oop!.amount,
      currency: oop!.currency,
      outOfPolicy: true,
      itinerary: oop!.itinerary,
    });

    const submitted = await travel.submit(traveler, trip.id);
    expect(submitted.requiresApproval).toBe(true);
    expect(submitted.trip.status).toBe("PENDING_APPROVAL");

    await expect(travel.bookMock(traveler, selected.booking.id)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await expect(travel.approve(traveler, trip.id)).rejects.toMatchObject({ code: "SOD_VIOLATION" });

    const approved = await travel.approve(approver, trip.id);
    expect(approved.trip.status).toBe("READY_TO_BOOK");

    const held = await travel.bookMock(traveler, selected.booking.id);
    expect(held.status).toBe("BOOKED_MOCK");
    expect(held.providerStatus).toBe("MOCK_HOLD");
    expect(held.status).not.toBe("CONFIRMED");
  });

  it("reprice above tolerance blocks booking; cancel/refund lifecycle", async () => {
    const traveler = ctx({ userId: travelerId, organizationId: orgId });
    const trip = await travel.createTrip(traveler, {
      name: `Reprice ${suffix}`,
      legalEntityId: entityId,
      destination: "Austin",
      startDate: "2027-01-10",
      endDate: "2027-01-12",
      estimatedAmount: "600.00",
      currency: "USD",
      repriceTolerance: "25",
    });
    const search = await travel.search(traveler, trip.id, { type: "FLIGHT" });
    const quote = search.quotes.find((q) => !q.outOfPolicy)!;
    const selected = await travel.selectQuote(traveler, trip.id, {
      quoteId: quote.quoteId,
      type: "FLIGHT",
      supplier: quote.supplier,
      amount: quote.amount,
      currency: quote.currency,
      outOfPolicy: false,
      providerOfferId: quote.providerOfferId,
      itinerary: quote.itinerary,
    });
    await travel.submit(traveler, trip.id);
    await travel.approve(ctx({ userId: approverId, organizationId: orgId }), trip.id);

    await expect(travel.reprice(traveler, selected.booking.id, { forceHigh: true })).rejects.toMatchObject({
      code: "REPRICE_TOLERANCE_EXCEEDED",
    });
    const blocked = await prisma.travelBooking.findUniqueOrThrow({ where: { id: selected.booking.id } });
    expect(blocked.status).toBe("REPRICE_REQUIRED");

    await prisma.travelBooking.update({
      where: { id: selected.booking.id },
      data: { status: "QUOTED", amount: quote.amount, quotedAmount: quote.amount },
    });
    const held = await travel.bookMock(traveler, selected.booking.id, { skipReprice: true });
    expect(held.status).toBe("BOOKED_MOCK");
    const confirmed = await travel.confirmBooking(traveler, selected.booking.id);
    expect(confirmed.booking.status).toBe("CONFIRMED");

    const cancelled = await travel.cancelBooking(traveler, selected.booking.id);
    expect(["CANCELLED", "REFUND_PENDING"]).toContain(cancelled.status);
    const refunded = await travel.refundBooking(traveler, selected.booking.id);
    expect(refunded.booking.status).toBe("REFUNDED");
    const again = await travel.refundBooking(traveler, selected.booking.id);
    expect(again.booking.status).toBe("REFUNDED");
  });

  it("duplicate book-mock with idempotency key does not create second hold", async () => {
    const traveler = ctx({ userId: travelerId, organizationId: orgId });
    const trip = await travel.createTrip(traveler, {
      name: `Idem ${suffix}`,
      legalEntityId: entityId,
      destination: "Denver",
      startDate: "2027-02-01",
      endDate: "2027-02-03",
      estimatedAmount: "700.00",
      currency: "USD",
    });
    const search = await travel.search(traveler, trip.id, { type: "CAR" });
    const quote = search.quotes.find((q) => !q.outOfPolicy)!;
    const selected = await travel.selectQuote(traveler, trip.id, {
      quoteId: quote.quoteId,
      type: "CAR",
      supplier: quote.supplier,
      amount: quote.amount,
      currency: quote.currency,
      outOfPolicy: false,
      itinerary: quote.itinerary,
    });
    await travel.submit(traveler, trip.id);
    await travel.approve(ctx({ userId: approverId, organizationId: orgId }), trip.id);
    const key = `travel-idem-${suffix}`;
    const first = await travel.bookMock(traveler, selected.booking.id, { idempotencyKey: key, skipReprice: true });
    const second = await travel.bookMock(traveler, selected.booking.id, { idempotencyKey: key, skipReprice: true });
    expect(first.id).toBe(second.id);
    expect(first.providerRef).toBe(second.providerRef);
  });
});
