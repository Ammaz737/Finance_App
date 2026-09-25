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

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "password123", 10);

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
  await prisma.travelTrip.deleteMany();
  await prisma.renewal.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.matchRecord.deleteMany();
  await prisma.receivingRecord.deleteMany();
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
  await prisma.integrationConnection.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({ data: { name: "Acme Manufacturing", slug: "acme" } });
  const us = await prisma.legalEntity.create({
    data: { organizationId: org.id, name: "Acme US LLC", country: "US", currency: "USD" },
  });
  const uk = await prisma.legalEntity.create({
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
  for (const key of ["expense.create", "spend_request.create", "card.read", "reimbursement.create", "travel.book", "procurement.request"]) {
    const perm = permissionRows.find((p) => p.key === key);
    if (perm) await prisma.rolePermission.create({ data: { roleId: employee.id, permissionId: perm.id, scope: "SELF" } });
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
      { organizationId: org.id, name: "Spend request", objectType: "spend_request", steps: [{ type: "manager" }, { type: "finance" }] },
      { organizationId: org.id, name: "Expense", objectType: "expense", steps: [{ type: "manager" }] },
      { organizationId: org.id, name: "Reimbursement", objectType: "reimbursement", steps: [{ type: "manager" }] },
      { organizationId: org.id, name: "Bill", objectType: "bill", steps: [{ type: "ap" }, { type: "finance" }] },
      { organizationId: org.id, name: "Procurement", objectType: "procurement", steps: [{ type: "manager" }, { type: "finance" }] },
      { organizationId: org.id, name: "Travel", objectType: "travel", steps: [{ type: "manager" }, { type: "finance" }] },
    ],
  });
  await prisma.policy.create({
    data: {
      organizationId: org.id,
      name: "Procurement policy",
      objectType: "procurement",
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
      rules: [{ type: "travel_max_amount", threshold: 2500 }, { type: "travel_out_of_policy" }],
    },
  });
  await prisma.policy.create({
    data: {
      organizationId: org.id,
      name: "Receipt required",
      objectType: "expense",
      rules: [{ type: "receipt_required", threshold: 75 }],
    },
  });
  await prisma.policy.create({
    data: {
      organizationId: org.id,
      name: "Reimbursement receipt required",
      objectType: "reimbursement",
      rules: [{ type: "receipt_required", threshold: 75 }, { type: "memo_required", threshold: 0 }],
    },
  });
  await prisma.businessLimit.create({
    data: { organizationId: org.id, legalEntityId: us.id, amount: "200000", currency: "USD" },
  });
  const budget = await prisma.budget.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      name: "Engineering 2026",
      ownerId: mgr.id,
      amount: "100000",
      currency: "USD",
    },
  });
  const program = await prisma.spendProgram.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      name: "Software tools",
      budgetId: budget.id,
      maxAmount: "5000",
      currency: "USD",
    },
  });
  const fund = await prisma.fund.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      name: "Elena software fund",
      ownerId: emp.id,
      availableAmount: "2500",
      limitAmount: "2500",
      currency: "USD",
    },
  });
  const card = await prisma.card.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      fundId: fund.id,
      holderId: emp.id,
      type: "VIRTUAL",
      last4: "4242",
      token: "tok_seed_4242",
      merchantLock: "OpenAI",
    },
  });
  const txn = await prisma.txn.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      cardId: card.id,
      fundId: fund.id,
      amount: "42.00",
      currency: "USD",
      merchant: "OpenAI",
      status: "CLEARED",
      clearedAt: new Date(),
    },
  });
  await prisma.expense.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      userId: emp.id,
      transactionId: txn.id,
      amount: "42.00",
      currency: "USD",
      merchant: "OpenAI",
      status: "INCOMPLETE",
      memo: "ChatGPT team plan",
    },
  });
  const vendor = await prisma.vendor.create({
    data: { organizationId: org.id, legalEntityId: us.id, name: "OpenAI", category: "SaaS", ownerId: emp.id },
  });
  await prisma.bill.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      vendorId: vendor.id,
      invoiceNumber: "INV-10034",
      amount: "4500.00",
      remainingAmount: "4500.00",
      currency: "USD",
      status: "DRAFT",
      createdBy: admin.id,
    },
  });
  const procProgram = await prisma.procurementProgram.create({
    data: { organizationId: org.id, name: "Software intake" },
  });
  await prisma.purchaseRequest.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      programId: procProgram.id,
      requesterId: emp.id,
      name: "Datadog expansion",
      amount: "18000.00",
      currency: "USD",
      outcomeType: "PURCHASE_ORDER",
      status: "DRAFT",
    },
  });
  await prisma.accountingDimension.create({
    data: { organizationId: org.id, key: "category", label: "GL Category", values: ["Software", "Travel", "Meals"] },
  });
  await prisma.accountingEntry.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      sourceType: "CARD_TRANSACTION",
      sourceId: txn.id,
      status: "NEEDS_REVIEW",
      category: "Software",
    },
  });
  await prisma.bankAccount.createMany({
    data: [
      { organizationId: org.id, legalEntityId: us.id, name: "Operating", last4: "1111", currency: "USD", available: "500000" },
      { organizationId: org.id, legalEntityId: us.id, name: "Payroll", last4: "2222", currency: "USD", available: "120000" },
    ],
  });
  const customer = await prisma.customer.create({ data: { organizationId: org.id, name: "Northwind" } });
  await prisma.invoice.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      customerId: customer.id,
      number: "AR-2001",
      amount: "9000.00",
      balance: "9000.00",
      currency: "USD",
      status: "SENT",
    },
  });
  await prisma.travelTrip.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      travelerId: emp.id,
      name: "NYC customer visit",
      destination: "New York",
      purpose: "Customer workshop",
      startDate: new Date("2026-10-10"),
      endDate: new Date("2026-10-12"),
      estimatedAmount: "1200.00",
      currency: "USD",
      status: "DRAFT",
    },
  });
  await prisma.integrationConnection.createMany({
    data: [
      { organizationId: org.id, family: "ERP", provider: "mock-netsuite", status: "CONNECTED", health: "HEALTHY", cursor: "mock_seed_erp", lastSyncAt: new Date() },
      { organizationId: org.id, family: "TRAVEL", provider: "mock-travel", status: "CONNECTED", health: "UNKNOWN", cursor: null },
      { organizationId: org.id, family: "CARD_ISSUER", provider: "mock-issuer", status: "CONNECTED", health: "HEALTHY", cursor: "mock_seed_cards", lastSyncAt: new Date() },
    ],
  });
  await prisma.notification.create({
    data: {
      organizationId: org.id,
      userId: emp.id,
      type: "TRAVEL",
      title: "Complete your trip request",
      body: "Add dates and a quote before submitting NYC customer visit.",
      href: "/app/me/travel",
      objectType: "travel",
    },
  });
  await prisma.agentIdentity.create({
    data: {
      organizationId: org.id,
      legalEntityId: us.id,
      name: "Sourcing agent",
      ownerId: admin.id,
      monthlyBudget: "1000.00",
    },
  });
  await prisma.workbook.create({
    data: { organizationId: org.id, name: "FY26 headcount model", ownerId: admin.id, snapshot: { sheets: ["Assumptions"] } },
  });
  await prisma.integrationConnection.create({
    data: { organizationId: org.id, family: "AccountingProvider", provider: "MOCK_QBO", status: "CONNECTED" },
  });
  await prisma.accountingRule.create({
    data: {
      organizationId: org.id,
      name: "Mileage reimbursements",
      match: { sourceType: "REIMBURSEMENT", memoContains: "mile" },
      coding: { category: "Travel", coding: { glAccount: "6200" } },
      priority: 10,
    },
  });
  await prisma.aiUsageRecord.create({
    data: { organizationId: org.id, provider: "openai", model: "gpt-4.1", userId: emp.id, tokens: 88000, cost: "12.40" },
  });

  console.log("Seeded Acme Manufacturing");
  console.log("Login: admin@acme.test / password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
