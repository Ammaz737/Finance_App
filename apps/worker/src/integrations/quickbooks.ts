import type { AccountingEntry, Prisma, PrismaClient, QuickBooksConnection } from "@prisma/client";
import {
  QuickBooksClient,
  decryptProviderSecret,
  encryptProviderSecret,
  refreshQuickBooksTokens,
  type QuickBooksConfig,
  type QuickBooksEntity,
} from "@finance/quickbooks";

const PROVIDER = "QUICKBOOKS_ONLINE";

function workerConfig(environment: string): QuickBooksConfig {
  const clientId = (process.env.QUICKBOOKS_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.QUICKBOOKS_CLIENT_SECRET ?? "").trim();
  const encryptionKey = process.env.ENCRYPTION_KEY ?? "";
  if (!clientId || !clientSecret) throw new Error("QuickBooks client credentials are not configured in the worker");
  if (encryptionKey.length < 16) throw new Error("ENCRYPTION_KEY must contain at least 16 characters in the worker");
  return {
    clientId,
    clientSecret,
    redirectUri: (process.env.QUICKBOOKS_REDIRECT_URI ?? "http://localhost:3001/api/v1/integrations/quickbooks/callback").trim(),
    environment: environment === "production" ? "production" : "sandbox",
  };
}

async function clientFor(prisma: PrismaClient, connection: QuickBooksConnection): Promise<QuickBooksClient> {
  const encryptionKey = process.env.ENCRYPTION_KEY ?? "";
  const qbConfig = workerConfig(connection.environment);
  let accessToken = decryptProviderSecret(connection.accessTokenEncrypted, encryptionKey);
  if (connection.accessTokenExpiresAt.getTime() <= Date.now() + 2 * 60 * 1000) {
    const tokens = await refreshQuickBooksTokens(qbConfig, decryptProviderSecret(connection.refreshTokenEncrypted, encryptionKey));
    const now = Date.now();
    const result = await prisma.quickBooksConnection.updateMany({
      where: { id: connection.id, updatedAt: connection.updatedAt, disconnectedAt: null },
      data: {
        accessTokenEncrypted: encryptProviderSecret(tokens.accessToken, encryptionKey),
        refreshTokenEncrypted: encryptProviderSecret(tokens.refreshToken, encryptionKey),
        accessTokenExpiresAt: new Date(now + Math.max(tokens.expiresIn, 60) * 1000),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresIn ? new Date(now + tokens.refreshTokenExpiresIn * 1000) : null,
        scopes: tokens.scope,
      },
    });
    if (result.count === 1) accessToken = tokens.accessToken;
    else {
      const latest = await prisma.quickBooksConnection.findUniqueOrThrow({ where: { id: connection.id } });
      accessToken = decryptProviderSecret(latest.accessTokenEncrypted, encryptionKey);
    }
  }
  return new QuickBooksClient(connection.realmId, accessToken, qbConfig.environment);
}

function objectConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function ref(value: string, name?: string) {
  return { value, ...(name ? { name } : {}) };
}

function dateOnly(value?: Date | null): string | undefined {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

async function activeConnection(prisma: PrismaClient, organizationId: string) {
  const integration = await prisma.integrationConnection.findFirst({
    where: { organizationId, family: "AccountingProvider", provider: PROVIDER, status: "CONNECTED" },
  });
  if (!integration) throw new Error("QuickBooks accounting connection is not active");
  const connection = await prisma.quickBooksConnection.findFirst({
    where: { organizationId, integrationConnectionId: integration.id, disconnectedAt: null },
  });
  if (!connection) throw new Error("QuickBooks OAuth credentials are missing");
  return { integration, connection, config: objectConfig(integration.config) };
}

async function mappedAccount(
  prisma: PrismaClient,
  connectionId: string,
  organizationId: string,
  requested: string | undefined,
  fallback: unknown,
  purpose: string,
) {
  const candidate = requested?.trim() || String(fallback ?? "").trim();
  if (!candidate) throw new Error(`QuickBooks ${purpose} account mapping is required`);
  const mapping = await prisma.quickBooksEntityMap.findFirst({
    where: {
      organizationId,
      quickBooksConnectionId: connectionId,
      entityType: "ACCOUNT",
      active: true,
      OR: [{ externalId: candidate }, { displayName: { equals: candidate, mode: "insensitive" } }],
    },
  });
  if (!mapping) throw new Error(`QuickBooks ${purpose} account mapping '${candidate}' is invalid; refresh accounting dimensions`);
  return ref(mapping.externalId, mapping.displayName);
}

async function ensureVendor(
  prisma: PrismaClient,
  client: QuickBooksClient,
  connection: QuickBooksConnection,
  input: { localId?: string | null; displayName: string; email?: string },
) {
  const existing = await prisma.quickBooksEntityMap.findFirst({
    where: {
      organizationId: connection.organizationId,
      quickBooksConnectionId: connection.id,
      entityType: "VENDOR",
      active: true,
      OR: [
        ...(input.localId ? [{ localId: input.localId }] : []),
        { displayName: { equals: input.displayName, mode: "insensitive" as const } },
      ],
    },
  });
  if (existing) return ref(existing.externalId, existing.displayName);
  const created = await client.create<QuickBooksEntity>("Vendor", {
    DisplayName: input.displayName.slice(0, 100),
    CompanyName: input.displayName.slice(0, 100),
    ...(input.email ? { PrimaryEmailAddr: { Address: input.email } } : {}),
  }, `vendor-${input.localId ?? input.displayName}`);
  const mapping = await prisma.quickBooksEntityMap.create({
    data: {
      organizationId: connection.organizationId,
      quickBooksConnectionId: connection.id,
      entityType: "VENDOR",
      localId: input.localId ?? "",
      externalId: created.Id,
      displayName: String(created.DisplayName ?? input.displayName),
      syncToken: created.SyncToken ?? "",
      active: created.Active !== false,
      metadata: created as Prisma.InputJsonValue,
    },
  });
  return ref(mapping.externalId, mapping.displayName);
}

function classAndDepartment(coding: Record<string, string>) {
  return {
    ...(coding.class ? { ClassRef: ref(coding.class) } : {}),
    ...(coding.department ? { DepartmentRef: ref(coding.department) } : {}),
  };
}

async function postPurchase(
  prisma: PrismaClient,
  client: QuickBooksClient,
  connection: QuickBooksConnection,
  integrationConfig: Record<string, unknown>,
  entry: AccountingEntry,
) {
  const coding = objectConfig(entry.coding) as Record<string, string>;
  const transaction = await prisma.txn.findFirst({ where: { id: entry.sourceId, organizationId: entry.organizationId } });
  if (!transaction) throw new Error("Card transaction source no longer exists");
  const expense = await prisma.expense.findFirst({ where: { organizationId: entry.organizationId, transactionId: transaction.id } });
  const splits = expense ? await prisma.expenseSplit.findMany({ where: { organizationId: entry.organizationId, expenseId: expense.id } }) : [];
  const cardAccount = await mappedAccount(prisma, connection.id, entry.organizationId, coding.cardAccount, integrationConfig.cardAccountId, "card liability");
  const vendor = transaction.vendorId
    ? await prisma.vendor.findFirst({ where: { id: transaction.vendorId, organizationId: entry.organizationId } })
    : null;
  const vendorRef = await ensureVendor(prisma, client, connection, {
    localId: vendor?.id,
    displayName: vendor?.displayName || vendor?.name || transaction.merchant || "Card merchant",
  });
  const baseAccount = await mappedAccount(prisma, connection.id, entry.organizationId, coding.glAccount || entry.category, integrationConfig.expenseAccountId, "expense");
  const lines = splits.length
    ? await Promise.all(splits.map(async (split) => ({
        Amount: Number(split.amount),
        DetailType: "AccountBasedExpenseLineDetail",
        Description: expense?.memo || transaction.memo || transaction.merchant,
        AccountBasedExpenseLineDetail: {
          AccountRef: await mappedAccount(prisma, connection.id, entry.organizationId, split.category, integrationConfig.expenseAccountId, "expense"),
          ...classAndDepartment({ ...coding, department: split.department || coding.department }),
        },
      })))
    : [{
        Amount: Number(entry.amount ?? transaction.capturedAmount ?? transaction.amount),
        DetailType: "AccountBasedExpenseLineDetail",
        Description: entry.memo || transaction.memo || transaction.merchant,
        AccountBasedExpenseLineDetail: { AccountRef: baseAccount, ...classAndDepartment(coding) },
      }];
  return client.create<QuickBooksEntity>("Purchase", {
    PaymentType: "CreditCard",
    AccountRef: cardAccount,
    EntityRef: vendorRef,
    TxnDate: dateOnly(transaction.clearedAt ?? transaction.authorizedAt),
    PrivateNote: (entry.memo || transaction.memo || transaction.merchant).slice(0, 4000),
    Line: lines,
    ...(entry.currency && entry.currency !== "USD" ? { CurrencyRef: ref(entry.currency) } : {}),
  }, entry.id);
}

async function postStandaloneExpense(
  prisma: PrismaClient,
  client: QuickBooksClient,
  connection: QuickBooksConnection,
  integrationConfig: Record<string, unknown>,
  entry: AccountingEntry,
) {
  const coding = objectConfig(entry.coding) as Record<string, string>;
  const expense = await prisma.expense.findFirst({ where: { id: entry.sourceId, organizationId: entry.organizationId } });
  if (!expense) throw new Error("Expense source no longer exists");
  const splits = await prisma.expenseSplit.findMany({ where: { organizationId: entry.organizationId, expenseId: expense.id } });
  const paymentAccount = await mappedAccount(prisma, connection.id, entry.organizationId, coding.bankAccount, integrationConfig.bankAccountId, "expense payment");
  const vendorRef = await ensureVendor(prisma, client, connection, { displayName: expense.merchant || "Expense merchant" });
  const lines = splits.length
    ? await Promise.all(splits.map(async (split) => ({
        Amount: Number(split.amount),
        DetailType: "AccountBasedExpenseLineDetail",
        Description: expense.memo || expense.merchant,
        AccountBasedExpenseLineDetail: {
          AccountRef: await mappedAccount(prisma, connection.id, entry.organizationId, split.category, integrationConfig.expenseAccountId, "expense"),
          ...classAndDepartment({ ...coding, department: split.department || coding.department }),
        },
      })))
    : [{
        Amount: Number(expense.amount),
        DetailType: "AccountBasedExpenseLineDetail",
        Description: expense.memo || expense.merchant,
        AccountBasedExpenseLineDetail: {
          AccountRef: await mappedAccount(prisma, connection.id, entry.organizationId, coding.glAccount || entry.category, integrationConfig.expenseAccountId, "expense"),
          ...classAndDepartment(coding),
        },
      }];
  return client.create<QuickBooksEntity>("Purchase", {
    PaymentType: "Cash",
    AccountRef: paymentAccount,
    EntityRef: vendorRef,
    TxnDate: dateOnly(expense.createdAt),
    PrivateNote: (entry.memo || expense.memo || expense.merchant).slice(0, 4000),
    Line: lines,
    ...(expense.currency !== "USD" ? { CurrencyRef: ref(expense.currency) } : {}),
  }, entry.id);
}

async function postBill(
  prisma: PrismaClient,
  client: QuickBooksClient,
  connection: QuickBooksConnection,
  integrationConfig: Record<string, unknown>,
  entry: AccountingEntry,
) {
  const coding = objectConfig(entry.coding) as Record<string, string>;
  const bill = await prisma.bill.findFirst({ where: { id: entry.sourceId, organizationId: entry.organizationId } });
  if (!bill) throw new Error("Bill source no longer exists");
  const vendor = await prisma.vendor.findFirst({ where: { id: bill.vendorId, organizationId: entry.organizationId } });
  if (!vendor) throw new Error("Bill vendor no longer exists");
  const vendorRef = await ensureVendor(prisma, client, connection, {
    localId: vendor.id,
    displayName: vendor.displayName || vendor.name,
  });
  const lines = await prisma.billLine.findMany({ where: { organizationId: entry.organizationId, billId: bill.id } });
  const qboLines = await Promise.all((lines.length ? lines : [{
    amount: bill.amount,
    description: bill.memo || bill.invoiceNumber,
    glAccount: coding.glAccount || entry.category,
    department: coding.department || "",
    location: "",
  }]).map(async (line) => ({
    Amount: Number(line.amount),
    DetailType: "AccountBasedExpenseLineDetail",
    Description: line.description,
    AccountBasedExpenseLineDetail: {
      AccountRef: await mappedAccount(prisma, connection.id, entry.organizationId, line.glAccount || coding.glAccount || entry.category, integrationConfig.expenseAccountId, "expense"),
      ...classAndDepartment({ ...coding, department: line.department || coding.department }),
    },
  })));
  const apAccount = integrationConfig.apAccountId
    ? await mappedAccount(prisma, connection.id, entry.organizationId, undefined, integrationConfig.apAccountId, "accounts payable")
    : undefined;
  return client.create<QuickBooksEntity>("Bill", {
    VendorRef: vendorRef,
    DocNumber: bill.invoiceNumber.slice(0, 21),
    TxnDate: dateOnly(bill.invoiceDate ?? bill.createdAt),
    DueDate: dateOnly(bill.dueDate),
    PrivateNote: bill.memo.slice(0, 4000),
    Line: qboLines,
    ...(apAccount ? { APAccountRef: apAccount } : {}),
    ...(bill.currency !== "USD" ? { CurrencyRef: ref(bill.currency) } : {}),
  }, entry.id);
}

async function postBillPayment(
  prisma: PrismaClient,
  client: QuickBooksClient,
  connection: QuickBooksConnection,
  integrationConfig: Record<string, unknown>,
  entry: AccountingEntry,
) {
  const payment = await prisma.payment.findFirst({ where: { id: entry.sourceId, organizationId: entry.organizationId } });
  if (!payment) throw new Error("Payment source no longer exists");
  const bill = await prisma.bill.findFirst({ where: { id: payment.billId, organizationId: entry.organizationId } });
  if (!bill) throw new Error("Payment bill no longer exists");
  const billEntry = await prisma.accountingEntry.findFirst({
    where: { organizationId: entry.organizationId, sourceType: "BILL", sourceId: bill.id, status: "SYNCED", externalId: { not: null } },
  });
  if (!billEntry?.externalId) throw new Error("Sync the related bill to QuickBooks before its payment");
  const vendor = await prisma.vendor.findFirst({ where: { id: bill.vendorId, organizationId: entry.organizationId } });
  if (!vendor) throw new Error("Payment vendor no longer exists");
  const vendorRef = await ensureVendor(prisma, client, connection, { localId: vendor.id, displayName: vendor.displayName || vendor.name });
  const bankAccount = await mappedAccount(prisma, connection.id, entry.organizationId, undefined, integrationConfig.bankAccountId, "payment bank");
  return client.create<QuickBooksEntity>("BillPayment", {
    VendorRef: vendorRef,
    TotalAmt: Number(payment.amount),
    TxnDate: dateOnly(payment.settledAt ?? payment.updatedAt),
    PayType: "Check",
    CheckPayment: { BankAccountRef: bankAccount },
    Line: [{ Amount: Number(payment.amount), LinkedTxn: [{ TxnId: billEntry.externalId, TxnType: "Bill" }] }],
    ...(payment.currency !== "USD" ? { CurrencyRef: ref(payment.currency) } : {}),
  }, entry.id);
}

async function postReimbursement(
  prisma: PrismaClient,
  client: QuickBooksClient,
  connection: QuickBooksConnection,
  integrationConfig: Record<string, unknown>,
  entry: AccountingEntry,
) {
  const reimbursement = await prisma.reimbursement.findFirst({ where: { id: entry.sourceId, organizationId: entry.organizationId } });
  if (!reimbursement) throw new Error("Reimbursement source no longer exists");
  const employee = await prisma.user.findFirst({ where: { id: reimbursement.userId, organizationId: entry.organizationId } });
  if (!employee) throw new Error("Reimbursement employee no longer exists");
  const coding = objectConfig(entry.coding) as Record<string, string>;
  const vendorRef = await ensureVendor(prisma, client, connection, {
    localId: employee.id,
    displayName: `${employee.firstName} ${employee.lastName}`.trim() || employee.email,
    email: employee.email,
  });
  const expenseAccount = await mappedAccount(prisma, connection.id, entry.organizationId, coding.glAccount || reimbursement.category || entry.category, integrationConfig.expenseAccountId, "expense");
  const bill = await client.create<QuickBooksEntity>("Bill", {
    VendorRef: vendorRef,
    TxnDate: dateOnly(reimbursement.expenseDate ?? reimbursement.paidAt ?? reimbursement.createdAt),
    PrivateNote: (reimbursement.memo || reimbursement.merchant || "Employee reimbursement").slice(0, 4000),
    Line: [{
      Amount: Number(reimbursement.amount),
      DetailType: "AccountBasedExpenseLineDetail",
      Description: reimbursement.memo || reimbursement.merchant || "Employee reimbursement",
      AccountBasedExpenseLineDetail: { AccountRef: expenseAccount, ...classAndDepartment(coding) },
    }],
    ...(reimbursement.currency !== "USD" ? { CurrencyRef: ref(reimbursement.currency) } : {}),
  }, `${entry.id}-bill`);
  const bankAccount = await mappedAccount(prisma, connection.id, entry.organizationId, undefined, integrationConfig.bankAccountId, "payment bank");
  const payment = await client.create<QuickBooksEntity>("BillPayment", {
    VendorRef: vendorRef,
    TotalAmt: Number(reimbursement.amount),
    TxnDate: dateOnly(reimbursement.paidAt),
    PayType: "Check",
    CheckPayment: { BankAccountRef: bankAccount },
    Line: [{ Amount: Number(reimbursement.amount), LinkedTxn: [{ TxnId: bill.Id, TxnType: "Bill" }] }],
    ...(reimbursement.currency !== "USD" ? { CurrencyRef: ref(reimbursement.currency) } : {}),
  }, `${entry.id}-payment`);
  await prisma.quickBooksEntityMap.upsert({
    where: {
      quickBooksConnectionId_entityType_externalId: {
        quickBooksConnectionId: connection.id,
        entityType: "REIMBURSEMENT_PAYMENT",
        externalId: payment.Id,
      },
    },
    update: { localId: reimbursement.id, syncToken: payment.SyncToken ?? "", metadata: payment as Prisma.InputJsonValue },
    create: {
      organizationId: entry.organizationId,
      quickBooksConnectionId: connection.id,
      entityType: "REIMBURSEMENT_PAYMENT",
      localId: reimbursement.id,
      externalId: payment.Id,
      displayName: reimbursement.memo || "Reimbursement payment",
      syncToken: payment.SyncToken ?? "",
      metadata: payment as Prisma.InputJsonValue,
    },
  });
  return bill;
}

export async function postQuickBooksEntry(prisma: PrismaClient, entry: AccountingEntry) {
  if (entry.externalId) return { externalId: entry.externalId, reused: true };
  const { integration, connection, config } = await activeConnection(prisma, entry.organizationId);
  const client = await clientFor(prisma, connection);
  try {
    const created = entry.sourceType === "CARD_TRANSACTION"
      ? await postPurchase(prisma, client, connection, config, entry)
      : entry.sourceType === "EXPENSE"
        ? await postStandaloneExpense(prisma, client, connection, config, entry)
      : entry.sourceType === "BILL"
        ? await postBill(prisma, client, connection, config, entry)
        : entry.sourceType === "PAYMENT"
          ? await postBillPayment(prisma, client, connection, config, entry)
          : entry.sourceType === "REIMBURSEMENT"
            ? await postReimbursement(prisma, client, connection, config, entry)
            : null;
    if (!created) throw new Error(`QuickBooks mapping for ${entry.sourceType} is not supported`);
    await prisma.integrationConnection.update({ where: { id: integration.id }, data: { health: "HEALTHY", lastError: "", lastSyncAt: new Date() } });
    return { externalId: created.Id, reused: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "QuickBooks sync failed";
    await prisma.integrationConnection.update({ where: { id: integration.id }, data: { health: "DEGRADED", lastError: message.slice(0, 500) } });
    throw error;
  }
}

export async function processQuickBooksWebhook(prisma: PrismaClient, webhookEventId: string, connectionId: string) {
  const event = await prisma.quickBooksWebhookEvent.findUnique({ where: { id: webhookEventId } });
  if (!event || event.processedAt) return;
  const connection = await prisma.quickBooksConnection.findFirst({ where: { id: connectionId, organizationId: event.organizationId, disconnectedAt: null } });
  if (!connection) throw new Error("QuickBooks webhook connection is not active");
  try {
    const client = await clientFor(prisma, connection);
    for (const entityType of ["Account", "Vendor", "Class", "Department"] as const) {
      let entities: QuickBooksEntity[] = [];
      try { entities = await client.queryAll(entityType); }
      catch (error) { if (entityType === "Account" || entityType === "Vendor") throw error; }
      for (const entity of entities) {
        await prisma.quickBooksEntityMap.upsert({
          where: { quickBooksConnectionId_entityType_externalId: { quickBooksConnectionId: connection.id, entityType: entityType.toUpperCase(), externalId: entity.Id } },
          update: {
            displayName: String(entity.FullyQualifiedName ?? entity.DisplayName ?? entity.Name ?? entity.Id),
            syncToken: entity.SyncToken ?? "",
            active: entity.Active !== false,
            metadata: entity as Prisma.InputJsonValue,
          },
          create: {
            organizationId: connection.organizationId,
            quickBooksConnectionId: connection.id,
            entityType: entityType.toUpperCase(),
            externalId: entity.Id,
            displayName: String(entity.FullyQualifiedName ?? entity.DisplayName ?? entity.Name ?? entity.Id),
            syncToken: entity.SyncToken ?? "",
            active: entity.Active !== false,
            metadata: entity as Prisma.InputJsonValue,
          },
        });
      }
    }
    await prisma.$transaction([
      prisma.quickBooksWebhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: "" } }),
      prisma.quickBooksConnection.update({ where: { id: connection.id }, data: { lastCatalogSyncAt: new Date() } }),
      prisma.integrationConnection.update({ where: { id: connection.integrationConnectionId }, data: { health: "HEALTHY", lastError: "", lastSyncAt: new Date() } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "QuickBooks webhook sync failed";
    await prisma.quickBooksWebhookEvent.update({ where: { id: event.id }, data: { error: message.slice(0, 500) } });
    throw error;
  }
}
