import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
  "people.read",
  "people.invite",
  "people.edit",
  "roles.assign",
  "card.read",
  "card.issue",
  "card.freeze",
  "fund.create",
  "spend_program.manage",
  "spend_request.create",
  "spend_request.approve",
  "expense.read",
  "expense.create",
  "expense.approve",
  "reimbursement.create",
  "reimbursement.approve",
  "reimbursement.pay",
  "bill.read",
  "bill.create",
  "bill.approve",
  "payment.create",
  "payment.release",
  "payment_run.manage",
  "procurement.request",
  "procurement.review",
  "po.create",
  "travel.book",
  "travel.approve",
  "vendor.read",
  "vendor.create",
  "vendor.bank_details.manage",
  "accounting.read",
  "accounting.code",
  "accounting.sync",
  "treasury.transfer.create",
  "treasury.transfer.approve",
  "treasury.transfer.release",
  "report.read",
  "budget.manage",
  "audit.read",
  "*",
];

const FEATURES = [
  "cards",
  "expenses",
  "bill_pay",
  "procurement",
  "travel",
  "accounting",
  "treasury",
  "receivables",
  "ai_spend",
  "developer_platform",
  "sheets",
  "agent_finance",
  "vendor_portal",
  "advisor_console",
  "stack",
];

/** Wipe transactional / financial rows. Foundation is recreated below. */
async function wipeAll() {
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.oAuthApp.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.cashApplication.deleteMany();
  await prisma.incomingPayment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.bankTransfer.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.travelBooking.deleteMany();
  await prisma.travelerProfile.deleteMany().catch(() => undefined);
  await prisma.travelTrip.deleteMany();
  await prisma.renewal.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.matchRecord.deleteMany();
  await prisma.receivingRecord.deleteMany();
  await prisma.poChangeOrder.deleteMany().catch(() => undefined);
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.procurementProgram.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.paymentRun.deleteMany();
  await prisma.billLine.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.vendorBankAccount.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.syncAttempt.deleteMany().catch(() => undefined);
  await prisma.syncJob.deleteMany();
  await prisma.accountingRule.deleteMany();
  await prisma.accountingEntry.deleteMany();
  await prisma.accountingDimension.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.reimbursement.deleteMany();
  await prisma.txn.deleteMany();
  await prisma.cardAuthorization.deleteMany();
  await prisma.cardEvent.deleteMany().catch(() => undefined);
  await prisma.card.deleteMany();
  await prisma.fund.deleteMany();
  await prisma.spendRequest.deleteMany();
  await prisma.spendProgram.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.businessLimit.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerTransaction.deleteMany();
  await prisma.aiRecommendation.deleteMany();
  await prisma.agentIdentity.deleteMany();
  await prisma.workbook.deleteMany();
  await prisma.rewardLedger.deleteMany();
  await prisma.repayment.deleteMany();
  await prisma.disputeCase.deleteMany();
  await prisma.taxForm.deleteMany();
  await prisma.routerLog.deleteMany();
  await prisma.aiUsageRecord.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.approvalAction.deleteMany();
  await prisma.inboxItem.deleteMany();
  await prisma.approvalInstance.deleteMany();
  await prisma.approvalWorkflow.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.entitlement.deleteMany();
  await prisma.countryCapability.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.location.deleteMany();
  await prisma.legalEntity.deleteMany();
  await prisma.quickBooksWebhookEvent.deleteMany().catch(() => undefined);
  await prisma.quickBooksEntityMap.deleteMany().catch(() => undefined);
  await prisma.quickBooksConnection.deleteMany().catch(() => undefined);
  await prisma.providerOAuthState.deleteMany().catch(() => undefined);
  await prisma.integrationConnection.deleteMany();
  await prisma.organization.deleteMany();
}

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "password123", 10);

  await wipeAll();

  // --- Foundation only: org, entity, users, roles, policies, workflows ---
  // No seed cards, funds, expenses, bills, vendors, travel, bank balances, or demo transactions.
  const org = await prisma.organization.create({ data: { name: "Acme Manufacturing", slug: "acme" } });
  const us = await prisma.legalEntity.create({
    data: { organizationId: org.id, name: "Acme US LLC", country: "US", currency: "USD" },
  });
  await prisma.legalEntity.create({
    data: { organizationId: org.id, name: "Acme UK Ltd", country: "GB", currency: "GBP" },
  });
  await prisma.countryCapability.createMany({
    data: [
      { organizationId: org.id, country: "US", taxCaptureSupported: true, billPaySupported: true, rails: ["ACH", "CHECK", "WIRE"] },
      { organizationId: org.id, country: "GB", billPaySupported: true, rails: ["FPS", "SWIFT"] },
    ],
  });
  const engineering = await prisma.department.create({ data: { organizationId: org.id, name: "Engineering" } });
  await prisma.location.create({ data: { organizationId: org.id, name: "Austin" } });

  const permissionRows = await Promise.all(
    PERMISSIONS.map((key) => prisma.permission.create({ data: { key, label: key } })),
  );
  const owner = await prisma.role.create({ data: { organizationId: org.id, name: "Owner", description: "Full access" } });
  const finance = await prisma.role.create({
    data: { organizationId: org.id, name: "Finance Admin", description: "Finance operations" },
  });
  const manager = await prisma.role.create({
    data: { organizationId: org.id, name: "Manager", description: "Approver" },
  });
  const employee = await prisma.role.create({
    data: { organizationId: org.id, name: "Employee", description: "Cardholder" },
  });
  const ownerPerm = permissionRows.find((p) => p.key === "*");
  if (ownerPerm) {
    await prisma.rolePermission.create({ data: { roleId: owner.id, permissionId: ownerPerm.id, scope: "ORGANIZATION" } });
  }
  for (const key of PERMISSIONS.filter((p) => p !== "*")) {
    const perm = permissionRows.find((p) => p.key === key);
    if (perm) {
      await prisma.rolePermission.create({ data: { roleId: finance.id, permissionId: perm.id, scope: "ORGANIZATION" } });
    }
  }
  for (const key of ["expense.approve", "spend_request.approve", "reimbursement.approve", "travel.approve", "card.read", "expense.read", "procurement.review"]) {
    const perm = permissionRows.find((p) => p.key === key);
    if (perm) await prisma.rolePermission.create({ data: { roleId: manager.id, permissionId: perm.id, scope: "DIRECT_REPORTS" } });
  }
  for (const key of ["expense.create", "expense.read", "spend_request.create", "card.read", "reimbursement.create", "travel.book", "procurement.request"]) {
    const perm = permissionRows.find((p) => p.key === key);
    if (perm) await prisma.rolePermission.create({ data: { roleId: employee.id, permissionId: perm.id, scope: "SELF" } });
  }
  const vendorRead = permissionRows.find((p) => p.key === "vendor.read");
  if (vendorRead) {
    await prisma.rolePermission.create({ data: { roleId: employee.id, permissionId: vendorRead.id, scope: "ENTITY" } });
  }

  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "admin@acme.test",
      passwordHash,
      firstName: "Ava",
      lastName: "Admin",
      status: "ACTIVE",
      departmentId: engineering.id,
    },
  });
  const mgr = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "manager@acme.test",
      passwordHash,
      firstName: "Miles",
      lastName: "Manager",
      status: "ACTIVE",
      managerId: admin.id,
    },
  });
  const emp = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "employee@acme.test",
      passwordHash,
      firstName: "Elena",
      lastName: "Employee",
      status: "ACTIVE",
      managerId: mgr.id,
    },
  });
  const releaser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "treasury@acme.test",
      passwordHash,
      firstName: "Tessa",
      lastName: "Treasury",
      status: "ACTIVE",
    },
  });
  const apApprover = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "ap@acme.test",
      passwordHash,
      firstName: "Aiden",
      lastName: "Payable",
      status: "ACTIVE",
    },
  });
  await prisma.userRole.createMany({
    data: [
      { organizationId: org.id, userId: admin.id, roleId: owner.id, entityId: us.id },
      { organizationId: org.id, userId: mgr.id, roleId: manager.id, entityId: us.id },
      { organizationId: org.id, userId: emp.id, roleId: employee.id, entityId: us.id },
      { organizationId: org.id, userId: releaser.id, roleId: finance.id, entityId: us.id },
      { organizationId: org.id, userId: apApprover.id, roleId: finance.id, entityId: us.id },
    ],
  });
  await prisma.entitlement.createMany({
    data: FEATURES.map((featureKey) => ({ organizationId: org.id, featureKey, enabled: true })),
  });

  await prisma.approvalWorkflow.createMany({
    data: [
      { organizationId: org.id, name: "Spend request", objectType: "spend_request", enabled: true, steps: [{ type: "manager" }, { type: "finance" }] },
      { organizationId: org.id, name: "Expense", objectType: "expense", enabled: true, steps: [{ type: "manager" }] },
      { organizationId: org.id, name: "Reimbursement", objectType: "reimbursement", enabled: true, steps: [{ type: "manager" }] },
      { organizationId: org.id, name: "Bill", objectType: "bill", enabled: true, steps: [{ type: "ap" }, { type: "finance" }] },
      { organizationId: org.id, name: "Procurement", objectType: "procurement", enabled: true, steps: [{ type: "manager" }, { type: "finance" }] },
      { organizationId: org.id, name: "Travel", objectType: "travel", enabled: true, steps: [{ type: "manager" }, { type: "finance" }] },
    ],
  });

  await prisma.policy.create({
    data: {
      organizationId: org.id,
      name: "Procurement policy",
      objectType: "procurement",
      enabled: true,
      rules: [
        { type: "vendor_required" },
        { type: "memo_required", threshold: 0 },
        { type: "quote_required", threshold: 5000 },
        { type: "high_value", threshold: 10000 },
      ],
    },
  });
  await prisma.policy.create({
    data: {
      organizationId: org.id,
      name: "Travel policy",
      objectType: "travel",
      enabled: true,
      rules: [{ type: "travel_max_amount", threshold: 2500 }, { type: "travel_out_of_policy" }],
    },
  });
  await prisma.policy.create({
    data: {
      organizationId: org.id,
      name: "Receipt required",
      objectType: "expense",
      enabled: true,
      rules: [{ type: "receipt_required", threshold: 75 }],
    },
  });
  await prisma.policy.create({
    data: {
      organizationId: org.id,
      name: "Reimbursement receipt required",
      objectType: "reimbursement",
      enabled: true,
      rules: [{ type: "receipt_required", threshold: 75 }, { type: "memo_required", threshold: 0 }],
    },
  });

  // Empty config shells so live forms can create requests (no fake money / transactions).
  await prisma.spendProgram.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      name: "General spend",
      maxAmount: "50000",
      currency: "USD",
      status: "ACTIVE",
      defaultFulfillmentType: "VIRTUAL_CARD",
    },
  });
  await prisma.procurementProgram.create({
    data: { organizationId: org.id, name: "General procurement", status: "ACTIVE" },
  });

  // Accounting coding lists only (no seeded journal entries).
  await prisma.accountingDimension.createMany({
    data: [
      {
        organizationId: org.id,
        key: "glAccount",
        label: "GL Account",
        source: "LOCAL",
        values: [
          { id: "6100", label: "Office equipment", active: true },
          { id: "6200", label: "Software", active: true },
          { id: "6300", label: "Travel", active: true },
          { id: "6400", label: "Meals", active: true },
        ],
      },
      {
        organizationId: org.id,
        key: "department",
        label: "Department",
        source: "LOCAL",
        values: [
          { id: "engineering", label: "Engineering", active: true },
          { id: "finance", label: "Finance", active: true },
          { id: "ops", label: "Ops", active: true },
        ],
      },
      {
        organizationId: org.id,
        key: "location",
        label: "Location",
        source: "LOCAL",
        values: [
          { id: "austin", label: "Austin", active: true },
          { id: "remote", label: "Remote", active: true },
        ],
      },
      {
        organizationId: org.id,
        key: "project",
        label: "Project",
        source: "LOCAL",
        values: [
          { id: "p100", label: "Platform", active: true },
          { id: "p200", label: "Customer success", active: true },
        ],
      },
      {
        organizationId: org.id,
        key: "category",
        label: "Category",
        source: "LOCAL",
        values: [
          { id: "Software", label: "Software", active: true },
          { id: "Travel", label: "Travel", active: true },
          { id: "Meals", label: "Meals", active: true },
          { id: "Office", label: "Office", active: true },
        ],
      },
    ],
  });

  console.log("Seeded foundation only (org / users / roles / policies / workflows).");
  console.log("No financial demo data — create spend, cards, bills, travel live.");
  console.log("Login: admin@acme.test / password123");
  console.log("Note: QuickBooks OAuth was cleared — reconnect under Accounting → Integrations if needed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
