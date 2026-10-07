import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  QuickBooksClient,
  buildQuickBooksAuthorizationUrl,
  decryptProviderSecret,
  encryptProviderSecret,
  exchangeQuickBooksCode,
  hashOAuthState,
  refreshQuickBooksTokens,
  revokeQuickBooksToken,
  safeOAuthReturnPath,
  type QuickBooksConfig,
  type QuickBooksEntity,
} from "@finance/quickbooks";
import { prisma } from "../../database/client";
import { env } from "../../config/env";
import { AppError } from "../../platform/http";
import type { RequestContext } from "../../platform/auth/context";

const PROVIDER = "QUICKBOOKS_ONLINE";
const FAMILY = "AccountingProvider";

function config(): QuickBooksConfig {
  if (!env.quickBooksClientId || !env.quickBooksClientSecret) {
    throw new AppError("QUICKBOOKS_NOT_CONFIGURED", "QuickBooks client credentials are not configured", 503);
  }
  if (env.encryptionKey.length < 16) {
    throw new AppError("ENCRYPTION_NOT_CONFIGURED", "Provider credential encryption is not configured", 503);
  }
  return {
    clientId: env.quickBooksClientId,
    clientSecret: env.quickBooksClientSecret,
    redirectUri: env.quickBooksRedirectUri,
    environment: env.quickBooksEnvironment,
  };
}

function assertAccountingAdmin(ctx: RequestContext): void {
  if (!ctx.roles.includes("Owner") && !ctx.permissions.includes("*") && !ctx.permissions.includes("accounting.sync")) {
    throw new AppError("FORBIDDEN", "Accounting administrator access is required", 403);
  }
}

function tokenDates(tokens: { expiresIn: number; refreshTokenExpiresIn?: number }) {
  const now = Date.now();
  return {
    accessTokenExpiresAt: new Date(now + Math.max(60, tokens.expiresIn) * 1000),
    refreshTokenExpiresAt: tokens.refreshTokenExpiresIn
      ? new Date(now + tokens.refreshTokenExpiresIn * 1000)
      : null,
  };
}

export async function beginQuickBooksOAuth(ctx: RequestContext, returnPath?: string) {
  assertAccountingAdmin(ctx);
  const qbConfig = config();
  const state = crypto.randomBytes(32).toString("base64url");
  await prisma.providerOAuthState.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      provider: PROVIDER,
      stateHash: hashOAuthState(state),
      returnPath: safeOAuthReturnPath(returnPath),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return { authorizationUrl: buildQuickBooksAuthorizationUrl(qbConfig, state) };
}

export async function completeQuickBooksOAuth(input: { state: string; code: string; realmId: string }) {
  const stateHash = hashOAuthState(input.state);
  const oauthState = await prisma.providerOAuthState.findUnique({ where: { stateHash } });
  if (!oauthState || oauthState.provider !== PROVIDER || oauthState.consumedAt || oauthState.expiresAt <= new Date()) {
    throw new AppError("INVALID_OAUTH_STATE", "QuickBooks authorization expired or has already been used", 400);
  }
  const consumed = await prisma.providerOAuthState.updateMany({
    where: { id: oauthState.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) throw new AppError("INVALID_OAUTH_STATE", "QuickBooks authorization has already been used", 400);

  const qbConfig = config();
  const tokens = await exchangeQuickBooksCode(qbConfig, input.code);
  const client = new QuickBooksClient(input.realmId, tokens.accessToken, qbConfig.environment);
  const company = await client.companyInfo();
  const companyName = String(company.CompanyName ?? company.LegalName ?? `QuickBooks ${input.realmId}`);
  const dates = tokenDates(tokens);

  const connection = await prisma.$transaction(async (tx) => {
    const current = await tx.integrationConnection.findFirst({
      where: { organizationId: oauthState.organizationId, family: FAMILY },
    });
    const integration = current
      ? await tx.integrationConnection.update({
          where: { id: current.id },
          data: {
            provider: PROVIDER,
            status: "CONNECTED",
            health: "HEALTHY",
            lastError: "",
            config: { realmId: input.realmId, companyName, environment: qbConfig.environment },
          },
        })
      : await tx.integrationConnection.create({
          data: {
            organizationId: oauthState.organizationId,
            family: FAMILY,
            provider: PROVIDER,
            status: "CONNECTED",
            health: "HEALTHY",
            config: { realmId: input.realmId, companyName, environment: qbConfig.environment },
          },
        });

    const qb = await tx.quickBooksConnection.upsert({
      where: { integrationConnectionId: integration.id },
      update: {
        realmId: input.realmId,
        companyName,
        accessTokenEncrypted: encryptProviderSecret(tokens.accessToken, env.encryptionKey),
        refreshTokenEncrypted: encryptProviderSecret(tokens.refreshToken, env.encryptionKey),
        ...dates,
        scopes: tokens.scope,
        environment: qbConfig.environment,
        disconnectedAt: null,
      },
      create: {
        organizationId: oauthState.organizationId,
        integrationConnectionId: integration.id,
        realmId: input.realmId,
        companyName,
        accessTokenEncrypted: encryptProviderSecret(tokens.accessToken, env.encryptionKey),
        refreshTokenEncrypted: encryptProviderSecret(tokens.refreshToken, env.encryptionKey),
        ...dates,
        scopes: tokens.scope,
        environment: qbConfig.environment,
      },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: oauthState.organizationId,
        actorId: oauthState.userId,
        action: "quickbooks.connected",
        objectType: "IntegrationConnection",
        objectId: integration.id,
        newValue: { realmId: input.realmId, companyName, environment: qbConfig.environment },
      },
    });
    return qb;
  });

  await syncQuickBooksCatalog(connection.id);
  return { returnPath: oauthState.returnPath, companyName };
}

export async function quickBooksStatus(ctx: RequestContext) {
  assertAccountingAdmin(ctx);
  const connection = await prisma.quickBooksConnection.findFirst({
    where: { organizationId: ctx.organizationId },
  });
  if (!connection) {
    return { configured: Boolean(env.quickBooksClientId && env.quickBooksClientSecret), connected: false };
  }
  const integration = await prisma.integrationConnection.findFirst({
    where: { id: connection.integrationConnectionId, organizationId: ctx.organizationId },
  });
  const accountMaps = await prisma.quickBooksEntityMap.findMany({
    where: { organizationId: ctx.organizationId, quickBooksConnectionId: connection.id, entityType: "ACCOUNT", active: true },
    orderBy: { displayName: "asc" },
  });
  const integrationConfig = integration?.config && typeof integration.config === "object" && !Array.isArray(integration.config)
    ? integration.config as Record<string, unknown>
    : {};
  return {
    configured: Boolean(env.quickBooksClientId && env.quickBooksClientSecret),
    connected: !connection.disconnectedAt && integration?.status === "CONNECTED",
    companyName: connection.companyName,
    realmId: connection.realmId,
    environment: connection.environment,
    accessTokenExpiresAt: connection.accessTokenExpiresAt,
    refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
    lastCatalogSyncAt: connection.lastCatalogSyncAt,
    health: integration?.health ?? "UNKNOWN",
    lastError: integration?.lastError ?? "",
    mappings: {
      expenseAccountId: String(integrationConfig.expenseAccountId ?? ""),
      cardAccountId: String(integrationConfig.cardAccountId ?? ""),
      apAccountId: String(integrationConfig.apAccountId ?? ""),
      bankAccountId: String(integrationConfig.bankAccountId ?? ""),
    },
    accounts: accountMaps.map((row) => {
      const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {};
      return { id: row.externalId, name: row.displayName, accountType: String(metadata.AccountType ?? "") };
    }),
  };
}

export async function updateQuickBooksMappings(ctx: RequestContext, mappings: {
  expenseAccountId: string;
  cardAccountId: string;
  apAccountId: string;
  bankAccountId: string;
}) {
  assertAccountingAdmin(ctx);
  const connection = await prisma.quickBooksConnection.findFirst({ where: { organizationId: ctx.organizationId, disconnectedAt: null } });
  if (!connection) throw new AppError("QUICKBOOKS_NOT_CONNECTED", "Connect QuickBooks first", 400);
  const ids = Object.values(mappings);
  const accounts = await prisma.quickBooksEntityMap.findMany({
    where: { organizationId: ctx.organizationId, quickBooksConnectionId: connection.id, entityType: "ACCOUNT", active: true, externalId: { in: ids } },
  });
  if (new Set(accounts.map((row) => row.externalId)).size !== new Set(ids).size) {
    throw new AppError("INVALID_ACCOUNT_MAPPING", "One or more QuickBooks account mappings are invalid", 400);
  }
  const integration = await prisma.integrationConnection.findFirst({ where: { id: connection.integrationConnectionId, organizationId: ctx.organizationId } });
  if (!integration) throw new AppError("QUICKBOOKS_NOT_CONNECTED", "QuickBooks integration record is missing", 400);
  const current = integration.config && typeof integration.config === "object" && !Array.isArray(integration.config)
    ? integration.config as Record<string, unknown>
    : {};
  await prisma.$transaction([
    prisma.integrationConnection.update({ where: { id: integration.id }, data: { config: { ...current, ...mappings } } }),
    prisma.auditEvent.create({
      data: {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "quickbooks.mapping_updated",
        objectType: "IntegrationConnection",
        objectId: integration.id,
        oldValue: {
          expenseAccountId: current.expenseAccountId ?? null,
          cardAccountId: current.cardAccountId ?? null,
          apAccountId: current.apAccountId ?? null,
          bankAccountId: current.bankAccountId ?? null,
        },
        newValue: mappings,
        correlationId: ctx.correlationId,
      },
    }),
  ]);
  return mappings;
}

export async function getAuthorizedQuickBooksClient(connectionId: string): Promise<QuickBooksClient> {
  let connection = await prisma.quickBooksConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.disconnectedAt) throw new Error("QuickBooks connection is not active");
  let accessToken = decryptProviderSecret(connection.accessTokenEncrypted, env.encryptionKey);
  if (connection.accessTokenExpiresAt.getTime() <= Date.now() + 2 * 60 * 1000) {
    const previousUpdatedAt = connection.updatedAt;
    const tokens = await refreshQuickBooksTokens(config(), decryptProviderSecret(connection.refreshTokenEncrypted, env.encryptionKey));
    const dates = tokenDates(tokens);
    const updated = await prisma.quickBooksConnection.updateMany({
      where: { id: connection.id, updatedAt: previousUpdatedAt, disconnectedAt: null },
      data: {
        accessTokenEncrypted: encryptProviderSecret(tokens.accessToken, env.encryptionKey),
        refreshTokenEncrypted: encryptProviderSecret(tokens.refreshToken, env.encryptionKey),
        ...dates,
        scopes: tokens.scope,
      },
    });
    if (updated.count === 1) {
      accessToken = tokens.accessToken;
    } else {
      connection = await prisma.quickBooksConnection.findUniqueOrThrow({ where: { id: connection.id } });
      accessToken = decryptProviderSecret(connection.accessTokenEncrypted, env.encryptionKey);
    }
  }
  return new QuickBooksClient(connection.realmId, accessToken, connection.environment === "production" ? "production" : "sandbox");
}

const CATALOGS: Array<{ entity: "Account" | "Vendor" | "Class" | "Department"; dimension: string; label: string }> = [
  { entity: "Account", dimension: "glAccount", label: "QuickBooks account" },
  { entity: "Vendor", dimension: "vendor", label: "QuickBooks vendor" },
  { entity: "Class", dimension: "class", label: "QuickBooks class" },
  { entity: "Department", dimension: "department", label: "QuickBooks location" },
];

export async function syncQuickBooksCatalog(connectionId: string) {
  const connection = await prisma.quickBooksConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.disconnectedAt) throw new Error("QuickBooks connection is not active");
  const client = await getAuthorizedQuickBooksClient(connection.id);
  const synced: Record<string, number> = {};
  for (const catalog of CATALOGS) {
    let entities: QuickBooksEntity[] = [];
    try {
      entities = await client.queryAll(catalog.entity);
    } catch (error) {
      if (catalog.entity === "Account" || catalog.entity === "Vendor") throw error;
      // Class/location tracking may be disabled for the connected QBO company.
    }
    const values = entities.map((entity) => ({
      id: entity.Id,
      label: String(entity.FullyQualifiedName ?? entity.DisplayName ?? entity.Name ?? entity.Id),
      active: entity.Active !== false,
      accountType: entity.AccountType ? String(entity.AccountType) : undefined,
      accountSubType: entity.AccountSubType ? String(entity.AccountSubType) : undefined,
      currency: entity.CurrencyRef?.value,
    }));
    const localVendors = catalog.entity === "Vendor"
      ? await prisma.vendor.findMany({ where: { organizationId: connection.organizationId }, select: { id: true, name: true, displayName: true } })
      : [];
    await prisma.$transaction(async (tx) => {
      for (const entity of entities) {
        const displayName = String(entity.FullyQualifiedName ?? entity.DisplayName ?? entity.Name ?? entity.Id);
        const localVendorId = catalog.entity === "Vendor"
          ? localVendors.find((vendor) => (vendor.displayName || vendor.name).localeCompare(displayName, undefined, { sensitivity: "accent" }) === 0)?.id ?? ""
          : "";
        await tx.quickBooksEntityMap.upsert({
          where: {
            quickBooksConnectionId_entityType_externalId: {
              quickBooksConnectionId: connection.id,
              entityType: catalog.entity.toUpperCase(),
              externalId: entity.Id,
            },
          },
          update: {
            displayName,
            ...(localVendorId ? { localId: localVendorId } : {}),
            syncToken: entity.SyncToken ?? "",
            active: entity.Active !== false,
            metadata: entity as Prisma.InputJsonValue,
          },
          create: {
            organizationId: connection.organizationId,
            quickBooksConnectionId: connection.id,
            entityType: catalog.entity.toUpperCase(),
            externalId: entity.Id,
            displayName,
            localId: localVendorId,
            syncToken: entity.SyncToken ?? "",
            active: entity.Active !== false,
            metadata: entity as Prisma.InputJsonValue,
          },
        });
      }
      await tx.accountingDimension.upsert({
        where: { organizationId_key: { organizationId: connection.organizationId, key: catalog.dimension } },
        update: { label: catalog.label, values, providerSynced: true, source: PROVIDER },
        create: {
          organizationId: connection.organizationId,
          key: catalog.dimension,
          label: catalog.label,
          values,
          providerSynced: true,
          source: PROVIDER,
        },
      });
    });
    synced[catalog.dimension] = entities.length;
  }
  const now = new Date();
  const accountMaps = await prisma.quickBooksEntityMap.findMany({
    where: { quickBooksConnectionId: connection.id, organizationId: connection.organizationId, entityType: "ACCOUNT", active: true },
  });
  const integration = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connection.integrationConnectionId } });
  const currentConfig = integration.config && typeof integration.config === "object" && !Array.isArray(integration.config)
    ? integration.config as Record<string, unknown>
    : {};
  const byType = (types: string[]) => accountMaps.find((row) => {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    return types.includes(String(metadata.AccountType ?? ""));
  })?.externalId ?? "";
  const nextConfig = {
    ...currentConfig,
    expenseAccountId: currentConfig.expenseAccountId || byType(["Expense", "Other Expense"]),
    cardAccountId: currentConfig.cardAccountId || byType(["Credit Card"]),
    apAccountId: currentConfig.apAccountId || byType(["Accounts Payable (A/P)", "Accounts Payable"]),
    bankAccountId: currentConfig.bankAccountId || byType(["Bank"]),
  };
  await prisma.$transaction([
    prisma.quickBooksConnection.update({ where: { id: connection.id }, data: { lastCatalogSyncAt: now } }),
    prisma.integrationConnection.update({
      where: { id: connection.integrationConnectionId },
      data: { health: "HEALTHY", lastError: "", lastSyncAt: now, cursor: now.toISOString(), config: nextConfig },
    }),
  ]);
  return synced;
}

export async function refreshQuickBooksCatalog(ctx: RequestContext) {
  assertAccountingAdmin(ctx);
  const connection = await prisma.quickBooksConnection.findFirst({
    where: { organizationId: ctx.organizationId, disconnectedAt: null },
  });
  if (!connection) throw new AppError("QUICKBOOKS_NOT_CONNECTED", "Connect QuickBooks first", 400);
  return syncQuickBooksCatalog(connection.id);
}

export async function disconnectQuickBooks(ctx: RequestContext) {
  assertAccountingAdmin(ctx);
  const connection = await prisma.quickBooksConnection.findFirst({
    where: { organizationId: ctx.organizationId, disconnectedAt: null },
  });
  if (!connection) throw new AppError("QUICKBOOKS_NOT_CONNECTED", "QuickBooks is not connected", 400);
  const refreshToken = decryptProviderSecret(connection.refreshTokenEncrypted, env.encryptionKey);
  await revokeQuickBooksToken(config(), refreshToken);
  await prisma.$transaction([
    prisma.quickBooksConnection.update({ where: { id: connection.id }, data: { disconnectedAt: new Date() } }),
    prisma.integrationConnection.update({
      where: { id: connection.integrationConnectionId },
      data: { status: "DISCONNECTED", health: "UNKNOWN", cursor: null },
    }),
    prisma.auditEvent.create({
      data: {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "quickbooks.disconnected",
        objectType: "IntegrationConnection",
        objectId: connection.integrationConnectionId,
      },
    }),
  ]);
  return { disconnected: true };
}

export function verifyQuickBooksWebhook(rawBody: Buffer, signature: string): boolean {
  if (!env.quickBooksWebhookVerifierToken) return false;
  const expected = crypto.createHmac("sha256", env.quickBooksWebhookVerifierToken).update(rawBody).digest("base64");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

type NormalizedWebhook = { providerEventId: string; realmId: string; payload: Prisma.InputJsonValue };

export function normalizeQuickBooksWebhooks(body: unknown, rawBody: Buffer): NormalizedWebhook[] {
  const fingerprint = crypto.createHash("sha256").update(rawBody).digest("hex");
  if (Array.isArray(body)) {
    return body.flatMap((item, index) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const realmId = String(row.intuitaccountid ?? "");
      if (!realmId) return [];
      return [{ providerEventId: String(row.id ?? `${fingerprint}:${index}`), realmId, payload: row as Prisma.InputJsonValue }];
    });
  }
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const notifications = Array.isArray(root.eventNotifications) ? root.eventNotifications : [];
  return notifications.flatMap((item, index) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const realmId = String(row.realmId ?? "");
    if (!realmId) return [];
    return [{ providerEventId: `${fingerprint}:${index}`, realmId, payload: row as Prisma.InputJsonValue }];
  });
}

export async function recordQuickBooksWebhook(events: NormalizedWebhook[]) {
  for (const event of events) {
    const connection = await prisma.quickBooksConnection.findFirst({ where: { realmId: event.realmId, disconnectedAt: null } });
    if (!connection) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const stored = await tx.quickBooksWebhookEvent.create({
          data: {
            organizationId: connection.organizationId,
            quickBooksConnectionId: connection.id,
            providerEventId: event.providerEventId,
            payload: event.payload,
          },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: connection.organizationId,
            type: "quickbooks.webhook_received",
            payload: { webhookEventId: stored.id, connectionId: connection.id },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
}
