import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { assertPositiveMoney, assertSameCurrency, MoneyError } from "@finance/money";
import { prisma } from "../database/client";
import { AppError } from "../platform/http";
import type { RequestContext } from "../platform/auth/context";
import { auditedCommand } from "../platform/database";
import { evaluatePolicy, loadPolicyRules } from "../engines/policy";
import { actOnApproval, eligibleForStep, progressLabel, startApproval } from "../engines/workflow";
import { postLedger } from "../engines/ledger";
import { hashPassword, verifyPassword } from "../platform/auth";
import { env } from "../config/env";
import { hashRequest, withIdempotency } from "../platform/idempotency";
import { assertEntityPermission, scopedWhere } from "../platform/resource-access";
import { CardIssuerError, getCardIssuer, isStripeCardIssuer } from "../integrations/card-issuer";
import { toStripeSpendingCategories } from "../integrations/card-issuer/stripe-spending-categories";
import {
  applyStripeIssuingTransactionCreated,
} from "../modules/cards/application/stripe-issuing-webhook";
import { StripeCardIssuerAdapter } from "../integrations/card-issuer/stripe.card-issuer.adapter";
import { MockOcrAdapter } from "../integrations/ocr/mock.ocr.adapter";
import { MockPayoutAdapter } from "../integrations/payout/mock.payout.adapter";
import { MockPaymentRailAdapter } from "../integrations/payment-rail/mock.payment-rail.adapter";
import { MockAccountingAdapter } from "../integrations/accounting/mock.accounting.adapter";
import { getTravelProvider } from "../integrations/travel";
import { evaluateCardAuthorizationRules } from "../modules/cards/domain/authorization-rules";
import { evaluateExpenseRequirements } from "../modules/expenses/domain/requirements";
import { evaluateBillDuplicate } from "../modules/ap/domain/duplicate-check";
import { matchVendor } from "../modules/ap/domain/vendor-match";
import { calculateReimbursement } from "../modules/reimbursements/domain/calc";
import { evaluateReimbursementDuplicate } from "../modules/reimbursements/domain/duplicate";
import { evaluateReimbursementRequirements } from "../modules/reimbursements/domain/requirements";
import { canApproveReimbursement, canSchedulePayout, canSubmitReimbursement } from "../modules/reimbursements/domain/state-machine";
import { pickAccountingRule } from "../modules/accounting/domain/rules";
import { evaluateMatch, normalizeProcurementLines, resolveTolerance, sumLineAmounts, sumLineQuantities } from "../modules/procurement/domain/match";
import { canReceivePo, isMatchPassing, nextReceiveStatus } from "../modules/procurement/domain/state-machine";
import { canBookTrip, canSearchTrip, evaluateRepriceTolerance, DEFAULT_REPRICE_TOLERANCE } from "../modules/travel/domain/state-machine";
import { budgetCapacity, sumByCurrency } from "../modules/reporting/domain/budget-math";

function mapIssuerError(error: unknown): never {
  if (error instanceof CardIssuerError) {
    // Surface mapped provider messages (never raw secrets / stack).
    throw new AppError("CARD_ISSUER_ERROR", error.message || "Card issuer request failed", error.retryable ? 503 : 400);
  }
  throw error;
}

function providerCardIdOf(card: { stripeCardId?: string | null; providerRef?: string | null; token?: string | null }) {
  return card.stripeCardId || card.providerRef || card.token || null;
}

function cardNeedsIssuerProvisioning(card: {
  stripeCardId?: string | null;
  provider?: string | null;
  providerRef?: string | null;
}) {
  const issuer = getCardIssuer();
  if (issuer.name === "stripe") return !card.stripeCardId;
  if (card.provider === "stripe") return true;
  if (!card.providerRef) return true;
  if (card.providerRef.startsWith("tok_seed_")) return true;
  return false;
}

async function syncIssuerCardStatus(card: {
  stripeCardId?: string | null;
  providerRef?: string | null;
  token?: string | null;
  provider?: string | null;
}, action: "freeze" | "unfreeze" | "cancel") {
  const issuer = getCardIssuer();
  // Seed tokens must never be sent to Stripe.
  const providerCardId = issuer.name === "stripe"
    ? (card.stripeCardId || null)
    : providerCardIdOf(card);
  if (!providerCardId) return;
  if (issuer.name === "stripe" && !providerCardId.startsWith("ic_")) return;
  try {
    if (action === "freeze") await issuer.freezeCard(providerCardId);
    else if (action === "unfreeze") await issuer.unfreezeCard(providerCardId);
    else await issuer.cancelCard(providerCardId);
  } catch (error) {
    mapIssuerError(error);
  }
}

async function provisionIssuerCard(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    legalEntityId: string;
    holderId: string;
    fundId: string;
    appCardId: string;
    allowedMccs?: string | null;
    perTransactionLimit?: Prisma.Decimal | null;
  },
) {
  const holder = await tx.user.findFirst({ where: { id: input.holderId, organizationId: input.organizationId } });
  if (!holder) throw new AppError("NOT_FOUND", "Cardholder user not found", 404);
  const entity = await tx.legalEntity.findFirst({ where: { id: input.legalEntityId, organizationId: input.organizationId } });
  if (!entity) throw new AppError("INVALID_ENTITY", "Entity is unavailable", 400);

  const issuer = getCardIssuer();
  let providerCardholderId = holder.stripeCardholderId;
  if (!providerCardholderId) {
    try {
      const created = await issuer.createCardholder({
        appUserId: holder.id,
        email: holder.email,
        firstName: holder.firstName,
        lastName: holder.lastName,
        billing: {
          line1: "1 Market Street",
          city: "San Francisco",
          state: "CA",
          postalCode: "94105",
          country: entity.country || "US",
        },
      });
      providerCardholderId = created.providerCardholderId;
      await tx.user.update({ where: { id: holder.id }, data: { stripeCardholderId: providerCardholderId } });
    } catch (error) {
      mapIssuerError(error);
    }
  }

  let issued;
  try {
    issued = await issuer.createCard({
      appCardId: input.appCardId,
      appUserId: holder.id,
      businessId: input.legalEntityId,
      providerCardholderId,
      type: "virtual",
      currency: env.stripeIssuingCurrency || entity.currency.toLowerCase(),
      status: "active",
      spendingControls: {
        spendingLimits: input.perTransactionLimit
          ? [{ amount: Math.round(Number(input.perTransactionLimit) * 100), interval: "per_authorization" }]
          : undefined,
        allowedCategories: input.allowedMccs
          ? input.allowedMccs.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
      },
      idempotencyKey: `create-card:v4:${input.appCardId}`,
      metadata: { fund_id: input.fundId },
    });
  } catch (error) {
    mapIssuerError(error);
  }
  return { issuer, issued };
}

/** One live virtual card per holder — new spend tops up the wallet fund instead of issuing another card. */
async function findHolderLiveCard(tx: Prisma.TransactionClient, organizationId: string, holderId: string) {
  const active = await tx.card.findFirst({
    where: { organizationId, holderId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (active) return active;
  return tx.card.findFirst({
    where: { organizationId, holderId, status: "FROZEN" },
    orderBy: { createdAt: "asc" },
  });
}

async function ensureHolderVirtualCard(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    legalEntityId: string;
    holderId: string;
    fundId: string;
    merchantLock?: string | null;
    allowedMccs?: string | null;
    perTransactionLimit?: Prisma.Decimal | null;
    velocityMaxAmount?: Prisma.Decimal | null;
    velocityMaxCount?: number | null;
    providerPrefix?: string;
  },
) {
  const existing = await findHolderLiveCard(tx, input.organizationId, input.holderId);
  if (existing) {
    if (existing.fundId !== input.fundId) {
      const requestFund = await tx.fund.findFirstOrThrow({ where: { id: input.fundId, organizationId: input.organizationId } });
      const move = requestFund.availableAmount;
      if (move.greaterThan(0)) {
        await tx.fund.update({
          where: { id: input.fundId },
          data: { availableAmount: { decrement: move } },
        });
        await tx.fund.update({
          where: { id: existing.fundId },
          data: {
            availableAmount: { increment: move },
            limitAmount: { increment: move },
            status: "ACTIVE",
          },
        });
      }
    }
    const nextLock =
      input.merchantLock && existing.merchantLock && input.merchantLock !== existing.merchantLock
        ? null
        : (input.merchantLock ?? existing.merchantLock);

    // Seed/mock cards are reused for balance, but must be linked to Stripe on first Stripe-mode fulfill.
    if (cardNeedsIssuerProvisioning(existing)) {
      const { issuer, issued } = await provisionIssuerCard(tx, {
        organizationId: input.organizationId,
        legalEntityId: input.legalEntityId,
        holderId: input.holderId,
        fundId: existing.fundId,
        appCardId: existing.id,
        allowedMccs: input.allowedMccs ?? existing.allowedMccs,
        perTransactionLimit: input.perTransactionLimit ?? existing.perTransactionLimit,
      });
      return tx.card.update({
        where: { id: existing.id },
        data: {
          status: issued.status === "active" ? "ACTIVE" : "INACTIVE",
          last4: issued.last4,
          token: issued.providerCardId,
          providerRef: issued.providerCardId,
          stripeCardId: issuer.name === "stripe" ? issued.providerCardId : null,
          provider: issuer.name,
          brand: issued.brand,
          network: issued.network,
          merchantLock: nextLock,
          ...(input.allowedMccs != null ? { allowedMccs: input.allowedMccs } : {}),
          ...(input.perTransactionLimit != null ? { perTransactionLimit: input.perTransactionLimit } : {}),
          ...(input.velocityMaxAmount != null ? { velocityMaxAmount: input.velocityMaxAmount } : {}),
          ...(input.velocityMaxCount != null ? { velocityMaxCount: input.velocityMaxCount } : {}),
        },
      });
    }

    return tx.card.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        merchantLock: nextLock,
        ...(input.allowedMccs != null ? { allowedMccs: input.allowedMccs } : {}),
        ...(input.perTransactionLimit != null ? { perTransactionLimit: input.perTransactionLimit } : {}),
        ...(input.velocityMaxAmount != null ? { velocityMaxAmount: input.velocityMaxAmount } : {}),
        ...(input.velocityMaxCount != null ? { velocityMaxCount: input.velocityMaxCount } : {}),
      },
    });
  }

  const appCardId = crypto.randomUUID();
  const { issuer, issued } = await provisionIssuerCard(tx, {
    organizationId: input.organizationId,
    legalEntityId: input.legalEntityId,
    holderId: input.holderId,
    fundId: input.fundId,
    appCardId,
    allowedMccs: input.allowedMccs,
    perTransactionLimit: input.perTransactionLimit,
  });

  try {
    return await tx.card.create({
      data: {
        id: appCardId,
        organizationId: input.organizationId,
        legalEntityId: input.legalEntityId,
        fundId: input.fundId,
        holderId: input.holderId,
        type: "VIRTUAL",
        last4: issued.last4,
        token: issued.providerCardId,
        providerRef: issued.providerCardId,
        stripeCardId: issuer.name === "stripe" ? issued.providerCardId : null,
        provider: issuer.name,
        brand: issued.brand,
        network: issued.network,
        status: issued.status === "active" ? "ACTIVE" : "INACTIVE",
        merchantLock: input.merchantLock ?? null,
        allowedMccs: input.allowedMccs ?? null,
        perTransactionLimit: input.perTransactionLimit ?? null,
        velocityMaxAmount: input.velocityMaxAmount ?? null,
        velocityMaxCount: input.velocityMaxCount ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const byFund = await tx.card.findFirst({ where: { organizationId: input.organizationId, fundId: input.fundId } });
      if (byFund) return byFund;
      const byHolder = await findHolderLiveCard(tx, input.organizationId, input.holderId);
      if (byHolder) return byHolder;
    }
    throw error;
  }
}

const ocrProvider = new MockOcrAdapter();
const payoutProvider = new MockPayoutAdapter();
const paymentRail = new MockPaymentRailAdapter();
const accountingProvider = new MockAccountingAdapter();

function travelProvider() {
  return getTravelProvider();
}

function dec(value: string | number) {
  return new Prisma.Decimal(value);
}

function n(value: Prisma.Decimal | string | number) {
  return Number(value);
}

function requireMoney(amount: string | number, currency: string) {
  try {
    return assertPositiveMoney(amount, currency);
  } catch (error) {
    if (error instanceof MoneyError) throw new AppError(error.code, error.message, 400);
    throw error;
  }
}

function requireCurrencyMatch(expected: string, actual: string) {
  try {
    return assertSameCurrency(expected, actual);
  } catch (error) {
    if (error instanceof MoneyError) throw new AppError(error.code, error.message, 400);
    throw error;
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function issueActivationToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
}

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/;

function assertPasswordPolicy(password: string) {
  if (!PASSWORD_RULE.test(password)) {
    throw new AppError("WEAK_PASSWORD", "Password needs 12+ characters with mixed case and a number", 400);
  }
}

async function queueAccounting(
  ctx: RequestContext,
  sourceType: string,
  sourceId: string,
  legalEntityId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
  extras: { amount?: string | number | Prisma.Decimal | null; currency?: string | null; memo?: string; category?: string } = {},
) {
  const amount = extras.amount != null && String(extras.amount) !== "" ? dec(String(extras.amount)) : null;
  const currency = extras.currency ?? null;
  const memo = extras.memo?.trim() ?? "";
  const category = extras.category?.trim() ?? "";

  const rules = await db.accountingRule.findMany({
    where: { organizationId: ctx.organizationId, enabled: true },
    orderBy: { priority: "asc" },
  });
  const applied = pickAccountingRule(rules, {
    sourceType,
    category,
    memo,
    amount: amount != null ? Number(amount) : null,
  });
  const nextCategory = applied?.category?.trim() || category;
  const nextMemo = applied?.memo?.trim() || memo;
  const nextCoding = applied?.coding ?? {};

  return db.accountingEntry.upsert({
    where: { organizationId_sourceType_sourceId: { organizationId: ctx.organizationId, sourceType, sourceId } },
    update: {
      status: "NEEDS_REVIEW",
      ...(amount != null ? { amount } : {}),
      ...(currency ? { currency } : {}),
      ...(nextMemo ? { memo: nextMemo } : {}),
      ...(nextCategory ? { category: nextCategory } : {}),
      ...(Object.keys(nextCoding).length ? { coding: nextCoding } : {}),
      syncError: null,
    },
    create: {
      organizationId: ctx.organizationId,
      legalEntityId,
      sourceType,
      sourceId,
      status: "NEEDS_REVIEW",
      amount,
      currency,
      memo: nextMemo,
      category: nextCategory,
      coding: nextCoding,
    },
  });
}

export const people = {
  async list(ctx: RequestContext) {
    return prisma.user.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        managerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },
  async create(ctx: RequestContext, body: { email: string; firstName: string; lastName: string; roleId: string; managerId?: string }) {
    const activation = issueActivationToken();
    const placeholderHash = await hashPassword(crypto.randomBytes(32).toString("base64url"));
    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { organizationId: ctx.organizationId, email: body.email.toLowerCase() }, select: { id: true } });
      if (existing) throw new AppError("DUPLICATE_PERSON", "A person with this email already exists", 409);
      const role = await tx.role.findFirst({ where: { id: body.roleId, organizationId: ctx.organizationId } });
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { slug: true } });
      const manager = body.managerId ? await tx.user.findFirst({ where: { id: body.managerId, organizationId: ctx.organizationId, status: "ACTIVE" } }) : null;
      if (!role || (body.managerId && !manager)) throw new AppError("INVALID_REFERENCE", "Role or manager is unavailable", 400);
      if (role.name === "Owner" && !ctx.roles.includes("Owner")) throw new AppError("FORBIDDEN", "Only an owner can assign owner access", 403);
      const user = await tx.user.create({ data: {
        organizationId: ctx.organizationId, email: body.email.toLowerCase(),
        firstName: body.firstName.trim(), lastName: body.lastName.trim(), passwordHash: placeholderHash,
        managerId: manager?.id, status: "DRAFT", passwordMustChange: true,
        activationTokenHash: activation.tokenHash, activationExpiresAt: activation.expiresAt,
      } });
      await tx.userRole.create({ data: { organizationId: ctx.organizationId, userId: user.id, roleId: role.id } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "people.create", objectType: "User", objectId: user.id, newValue: { email: user.email, status: user.status, role: role.name, managerId: user.managerId, activationIssued: true }, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "user.created", payload: { userId: user.id } } });
      const params = new URLSearchParams({ token: activation.token, email: user.email, workspace: organization.slug });
      return {
        id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
        status: user.status, role: role.name, managerId: user.managerId,
        activationPath: `/activate?${params.toString()}`, activationToken: activation.token, activationExpiresAt: activation.expiresAt,
      };
    });
  },
  async publish(ctx: RequestContext, id: string) {
    return auditedCommand(ctx, { action: "people.publish", objectType: "User", objectId: id, event: "user.published" }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true, status: true, email: true, activationTokenHash: true } });
      if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
      if (user.status !== "DRAFT") throw new AppError("INVALID_STATE", "Only draft people can be published", 409);
      if (user.activationTokenHash) {
        throw new AppError("ACTIVATION_REQUIRED", "This person must activate with their invite token before publish is allowed", 409);
      }
      const claim = await tx.user.updateMany({ where: { id, organizationId: ctx.organizationId, status: "DRAFT" }, data: { status: "ACTIVE", passwordMustChange: false } });
      if (claim.count !== 1) throw new AppError("PERSON_CONFLICT", "Person changed; refresh and try again", 409);
      const updated = await tx.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, firstName: true, lastName: true, status: true, managerId: true } });
      return { result: updated, oldValue: { status: user.status }, newValue: { status: updated.status } };
    });
  },
  async resetCredentials(ctx: RequestContext, id: string) {
    if (id === ctx.userId) throw new AppError("SOD_VIOLATION", "Use password change for your own account", 403);
    const activation = issueActivationToken();
    const placeholderHash = await hashPassword(crypto.randomBytes(32).toString("base64url"));
    return auditedCommand(ctx, { action: "people.reset_credentials", objectType: "User", objectId: id, event: "user.credentials_reset" }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true, status: true, email: true } });
      if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
      if (user.status === "TERMINATED") throw new AppError("INVALID_STATE", "Terminated people cannot be reset", 409);
      const claim = await tx.user.updateMany({
        where: { id, organizationId: ctx.organizationId, status: user.status },
        data: {
          passwordHash: placeholderHash,
          passwordMustChange: true,
          activationTokenHash: activation.tokenHash,
          activationExpiresAt: activation.expiresAt,
          status: user.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
        },
      });
      if (claim.count !== 1) throw new AppError("PERSON_CONFLICT", "Person changed; refresh and try again", 409);
      await tx.session.deleteMany({ where: { userId: id, organizationId: ctx.organizationId } });
      const updated = await tx.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, firstName: true, lastName: true, status: true } });
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { slug: true } });
      const params = new URLSearchParams({ token: activation.token, email: updated.email, workspace: organization.slug });
      return {
        result: { ...updated, activationPath: `/activate?${params.toString()}`, activationToken: activation.token, activationExpiresAt: activation.expiresAt },
        oldValue: { status: user.status },
        newValue: { status: updated.status, credentialsReset: true },
      };
    });
  },
  async activate(input: { email: string; workspace: string; token: string; password: string }) {
    assertPasswordPolicy(input.password);
    const organization = await prisma.organization.findUnique({ where: { slug: input.workspace.toLowerCase() }, select: { id: true } });
    if (!organization) throw new AppError("INVALID_CREDENTIALS", "Invalid activation details", 401);
    const tokenHash = hashToken(input.token);
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { organizationId: organization.id, email: input.email.toLowerCase() },
      });
      if (!user || !user.activationTokenHash || user.activationTokenHash !== tokenHash) {
        throw new AppError("INVALID_ACTIVATION", "Activation token is invalid", 401);
      }
      if (!user.activationExpiresAt || user.activationExpiresAt < new Date()) {
        throw new AppError("ACTIVATION_EXPIRED", "Activation token has expired", 401);
      }
      if (user.status === "TERMINATED") throw new AppError("INVALID_STATE", "Account cannot be activated", 409);
      const passwordHash = await hashPassword(input.password);
      const claim = await tx.user.updateMany({
        where: { id: user.id, organizationId: organization.id, activationTokenHash: tokenHash },
        data: {
          passwordHash,
          status: "ACTIVE",
          passwordMustChange: false,
          activationTokenHash: null,
          activationExpiresAt: null,
        },
      });
      if (claim.count !== 1) throw new AppError("ACTIVATION_CONFLICT", "Activation already used; request a new invite", 409);
      await tx.session.deleteMany({ where: { userId: user.id, organizationId: organization.id } });
      await tx.auditEvent.create({ data: {
        organizationId: organization.id, actorId: user.id, action: "people.activate",
        objectType: "User", objectId: user.id, newValue: { status: "ACTIVE" },
      } });
      await tx.outboxEvent.create({ data: { organizationId: organization.id, type: "user.activated", payload: { userId: user.id } } });
      return { id: user.id, email: user.email, status: "ACTIVE", organizationId: organization.id };
    });
  },
  async terminate(ctx: RequestContext, id: string) {
    if (id === ctx.userId) throw new AppError("SOD_VIOLATION", "You cannot terminate your own account", 403);
    return auditedCommand(ctx, { action: "people.terminate", objectType: "User", objectId: id, event: "user.terminated" }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true, status: true, email: true } });
      if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
      if (user.status === "TERMINATED") throw new AppError("INVALID_STATE", "Person is already terminated", 409);
      const ownerRole = await tx.role.findFirst({ where: { organizationId: ctx.organizationId, name: "Owner" }, select: { id: true } });
      if (ownerRole) {
        const targetOwner = await tx.userRole.findFirst({ where: { organizationId: ctx.organizationId, userId: id, roleId: ownerRole.id }, select: { id: true } });
        if (targetOwner && !ctx.roles.includes("Owner")) throw new AppError("FORBIDDEN", "Only an owner can terminate another owner", 403);
        if (targetOwner) {
          const assignments = await tx.userRole.findMany({ where: { organizationId: ctx.organizationId, roleId: ownerRole.id }, select: { userId: true } });
          const activeOwners = await tx.user.count({ where: { id: { in: assignments.map((item) => item.userId) }, organizationId: ctx.organizationId, status: "ACTIVE" } });
          if (activeOwners <= 1) throw new AppError("LAST_OWNER", "The last active owner cannot be terminated", 409);
        }
      }
      const claim = await tx.user.updateMany({ where: { id, organizationId: ctx.organizationId, status: user.status }, data: { status: "TERMINATED" } });
      if (claim.count !== 1) throw new AppError("PERSON_CONFLICT", "Person changed; refresh and try again", 409);
      await tx.session.deleteMany({ where: { userId: id, organizationId: ctx.organizationId } });
      const frozenCards = await tx.card.updateMany({ where: { holderId: id, organizationId: ctx.organizationId, status: "ACTIVE" }, data: { status: "FROZEN" } });
      const updated = await tx.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, firstName: true, lastName: true, status: true, managerId: true } });
      return { result: updated, oldValue: { status: user.status }, newValue: { status: updated.status, frozenCards: frozenCards.count } };
    });
  },
};

export const credentials = {
  async forgotPassword(input: { email: string; workspace: string }) {
    const organization = await prisma.organization.findUnique({
      where: { slug: input.workspace.toLowerCase() },
      select: { id: true, slug: true },
    });
    const user = organization ? await prisma.user.findFirst({
      where: { organizationId: organization.id, email: input.email.toLowerCase(), status: "ACTIVE" },
      select: { id: true, email: true },
    }) : null;
    if (!organization || !user) return { accepted: true };

    const reset = issueActivationToken();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordResetTokenHash: reset.tokenHash, passwordResetExpiresAt: reset.expiresAt },
      });
      await tx.auditEvent.create({ data: {
        organizationId: organization.id, actorId: user.id, actorType: "INTERNAL_USER",
        action: "credentials.reset_requested", objectType: "User", objectId: user.id,
        newValue: { expiresAt: reset.expiresAt },
      } });
      await tx.outboxEvent.create({ data: {
        organizationId: organization.id, type: "user.password_reset_requested",
        payload: { userId: user.id, email: user.email, workspace: organization.slug },
      } });
    });
    const params = new URLSearchParams({ token: reset.token, email: user.email, workspace: organization.slug });
    return {
      accepted: true,
      ...(env.nodeEnv !== "production" ? { sandboxResetPath: `/reset-password?${params.toString()}`, expiresAt: reset.expiresAt } : {}),
    };
  },
  async getDetail(ctx: RequestContext, id: string) {
    const user = await prisma.user.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true, email: true, firstName: true, lastName: true, status: true, managerId: true, departmentId: true, locationId: true, legalEntityId: true, createdAt: true } });
    if (!user) throw new AppError("NOT_FOUND", "Person not found", 404);
    const assignments = await prisma.userRole.findMany({ where: { organizationId: ctx.organizationId, userId: id } });
    const roles = await prisma.role.findMany({ where: { organizationId: ctx.organizationId, id: { in: assignments.map((item) => item.roleId) } } });
    return { user, roles: assignments.map((assignment) => ({ ...roles.find((role) => role.id === assignment.roleId), assignmentId: assignment.id, entityId: assignment.entityId })), audit: await prisma.auditEvent.findMany({ where: { organizationId: ctx.organizationId, objectType: "User", objectId: id }, orderBy: { createdAt: "desc" }, take: 50 }) };
  },
  async update(ctx: RequestContext, id: string, body: { managerId?: string | null; departmentId?: string | null; locationId?: string | null; legalEntityId?: string | null }) {
    return auditedCommand(ctx, { action: "people.update", objectType: "User", objectId: id, event: "user.updated" }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!user) throw new AppError("NOT_FOUND", "Person not found", 404);
      if (body.managerId === id) throw new AppError("INVALID_MANAGER", "A person cannot manage themselves", 400);
      const [manager, department, location, entity] = await Promise.all([
        body.managerId ? tx.user.findFirst({ where: { id: body.managerId, organizationId: ctx.organizationId, status: "ACTIVE" } }) : Promise.resolve(null),
        body.departmentId ? tx.department.findFirst({ where: { id: body.departmentId, organizationId: ctx.organizationId, status: "ACTIVE" } }) : Promise.resolve(null),
        body.locationId ? tx.location.findFirst({ where: { id: body.locationId, organizationId: ctx.organizationId, status: "ACTIVE" } }) : Promise.resolve(null),
        body.legalEntityId ? tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } }) : Promise.resolve(null),
      ]);
      if ((body.managerId && !manager) || (body.departmentId && !department) || (body.locationId && !location) || (body.legalEntityId && !entity)) throw new AppError("INVALID_REFERENCE", "One or more people assignments are unavailable", 400);
      const updated = await tx.user.update({ where: { id }, data: { managerId: body.managerId || null, departmentId: body.departmentId || null, locationId: body.locationId || null, legalEntityId: body.legalEntityId || null } });
      return { result: updated, oldValue: { managerId: user.managerId, departmentId: user.departmentId, locationId: user.locationId, legalEntityId: user.legalEntityId }, newValue: { managerId: updated.managerId, departmentId: updated.departmentId, locationId: updated.locationId, legalEntityId: updated.legalEntityId } };
    });
  },
  async assignRole(ctx: RequestContext, id: string, body: { roleId: string; entityId?: string | null }) {
    return auditedCommand(ctx, { action: "people.role_assign", objectType: "User", objectId: id, event: "user.role_assigned" }, async (tx) => {
      const [user, role, entity] = await Promise.all([tx.user.findFirst({ where: { id, organizationId: ctx.organizationId } }), tx.role.findFirst({ where: { id: body.roleId, organizationId: ctx.organizationId } }), body.entityId ? tx.legalEntity.findFirst({ where: { id: body.entityId, organizationId: ctx.organizationId } }) : Promise.resolve(null)]);
      if (!user || !role || (body.entityId && !entity)) throw new AppError("INVALID_REFERENCE", "Person, role, or entity is unavailable", 400);
      if (role.name === "Owner" && !ctx.roles.includes("Owner")) throw new AppError("FORBIDDEN", "Only an owner can assign owner access", 403);
      const assignment = await tx.userRole.findFirst({ where: { organizationId: ctx.organizationId, userId: id, roleId: role.id, entityId: body.entityId ?? null } })
        ?? await tx.userRole.create({ data: { organizationId: ctx.organizationId, userId: id, roleId: role.id, entityId: body.entityId ?? null } });
      return { result: assignment, newValue: { role: role.name, entityId: body.entityId ?? null } };
    });
  },
  async removeRole(ctx: RequestContext, id: string, body: { assignmentId: string }) {
    return auditedCommand(ctx, { action: "people.role_remove", objectType: "User", objectId: id, event: "user.role_removed" }, async (tx) => {
      const assignment = await tx.userRole.findFirst({ where: { id: body.assignmentId, userId: id, organizationId: ctx.organizationId } });
      if (!assignment) throw new AppError("NOT_FOUND", "Role assignment not found", 404);
      const role = await tx.role.findFirst({ where: { id: assignment.roleId, organizationId: ctx.organizationId } });
      if (role?.name === "Owner") {
        if (!ctx.roles.includes("Owner")) throw new AppError("FORBIDDEN", "Only an owner can remove owner access", 403);
        const count = await tx.userRole.count({ where: { organizationId: ctx.organizationId, roleId: role.id } });
        if (count <= 1) throw new AppError("LAST_OWNER", "The last owner role cannot be removed", 409);
      }
      await tx.userRole.delete({ where: { id: assignment.id } });
      return { result: { removed: true }, oldValue: { roleId: assignment.roleId, entityId: assignment.entityId } };
    });
  },
  async suspend(ctx: RequestContext, id: string) {
    if (id === ctx.userId) throw new AppError("SOD_VIOLATION", "You cannot suspend your own account", 403);
    return auditedCommand(ctx, { action: "people.suspend", objectType: "User", objectId: id, event: "user.suspended" }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!user || user.status !== "ACTIVE") throw new AppError("INVALID_STATE", "Only active people can be suspended", 409);
      const updated = await tx.user.update({ where: { id }, data: { status: "SUSPENDED" } });
      await tx.session.deleteMany({ where: { organizationId: ctx.organizationId, userId: id } });
      await tx.card.updateMany({ where: { organizationId: ctx.organizationId, holderId: id, status: "ACTIVE" }, data: { status: "FROZEN" } });
      return { result: updated, oldValue: { status: user.status }, newValue: { status: updated.status } };
    });
  },

  async resetPassword(input: { email: string; workspace: string; token: string; password: string }) {
    assertPasswordPolicy(input.password);
    const organization = await prisma.organization.findUnique({ where: { slug: input.workspace.toLowerCase() }, select: { id: true } });
    if (!organization) throw new AppError("INVALID_RESET", "Password reset link is invalid or expired", 401);
    const tokenHash = hashToken(input.token);
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { organizationId: organization.id, email: input.email.toLowerCase(), passwordResetTokenHash: tokenHash },
      });
      if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date() || user.status !== "ACTIVE") {
        throw new AppError("INVALID_RESET", "Password reset link is invalid or expired", 401);
      }
      const passwordHash = await hashPassword(input.password);
      const claim = await tx.user.updateMany({
        where: { id: user.id, organizationId: organization.id, passwordResetTokenHash: tokenHash },
        data: { passwordHash, passwordMustChange: false, passwordResetTokenHash: null, passwordResetExpiresAt: null },
      });
      if (claim.count !== 1) throw new AppError("RESET_CONFLICT", "Password reset link has already been used", 409);
      await tx.session.deleteMany({ where: { organizationId: organization.id, userId: user.id } });
      await tx.auditEvent.create({ data: { organizationId: organization.id, actorId: user.id, action: "credentials.password_reset", objectType: "User", objectId: user.id } });
      await tx.outboxEvent.create({ data: { organizationId: organization.id, type: "user.password_reset", payload: { userId: user.id } } });
      return { reset: true };
    });
  },

  async changePassword(ctx: RequestContext, input: { currentPassword: string; newPassword: string }) {
    assertPasswordPolicy(input.newPassword);
    const user = await prisma.user.findFirst({ where: { id: ctx.userId, organizationId: ctx.organizationId } });
    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new AppError("INVALID_CREDENTIALS", "Current password is incorrect", 401);
    }
    if (await verifyPassword(input.newPassword, user.passwordHash)) {
      throw new AppError("PASSWORD_REUSE", "Choose a password different from your current password", 400);
    }
    const passwordHash = await hashPassword(input.newPassword);
    return prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordMustChange: false } });
      await tx.session.deleteMany({ where: { organizationId: ctx.organizationId, userId: ctx.userId, id: { not: ctx.sessionId } } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "credentials.password_changed", objectType: "User", objectId: user.id, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "user.password_changed", payload: { userId: user.id } } });
      return { changed: true };
    });
  },
};

const POLICY_RULE_TYPES = new Set(["receipt_required", "memo_required", "vendor_required", "quote_required", "high_value", "category_amount", "manager_approval", "hard_policy_block", "block", "travel_max_amount", "travel_out_of_policy"]);
const WORKFLOW_STEP_TYPES = new Set(["manager", "budget", "finance", "ap", "controller", "legal", "cfo", "department_head", "entity"]);

export const adminConfiguration = {
  async createPolicy(ctx: RequestContext, body: { name: string; objectType: string; priority: number; effectiveFrom?: string; enabled?: boolean; rules: Array<Record<string, unknown>> }) {
    if (!body.rules.length || body.rules.some((rule) => !POLICY_RULE_TYPES.has(String(rule.type)))) throw new AppError("INVALID_RULE", "Policy contains an unsupported rule", 400);
    const id = crypto.randomUUID();
    return auditedCommand(ctx, { action: "policy.create", objectType: "Policy", objectId: id, event: "policy.created" }, async (tx) => {
      const policy = await tx.policy.create({ data: { id, organizationId: ctx.organizationId, name: body.name.trim(), objectType: body.objectType, priority: body.priority, effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(), enabled: body.enabled ?? false, rules: body.rules as Prisma.InputJsonValue } });
      return { result: policy, newValue: { name: policy.name, version: policy.version, enabled: policy.enabled } };
    });
  },
  async versionPolicy(ctx: RequestContext, id: string, body: { name: string; objectType: string; priority: number; effectiveFrom?: string; enabled?: boolean; rules: Array<Record<string, unknown>> }) {
    if (!body.rules.length || body.rules.some((rule) => !POLICY_RULE_TYPES.has(String(rule.type)))) throw new AppError("INVALID_RULE", "Policy contains an unsupported rule", 400);
    return prisma.$transaction(async (tx) => {
      const current = await tx.policy.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!current) throw new AppError("NOT_FOUND", "Policy not found", 404);
      const now = new Date();
      await tx.policy.update({ where: { id }, data: { enabled: false, effectiveTo: now } });
      const next = await tx.policy.create({ data: { organizationId: ctx.organizationId, name: body.name.trim(), objectType: body.objectType, priority: body.priority, version: current.version + 1, effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : now, enabled: body.enabled ?? false, rules: body.rules as Prisma.InputJsonValue } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "policy.version", objectType: "Policy", objectId: next.id, oldValue: { id: current.id, version: current.version }, newValue: { version: next.version, enabled: next.enabled }, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "policy.versioned", payload: { policyId: next.id, priorPolicyId: current.id } } });
      return next;
    });
  },
  async disablePolicy(ctx: RequestContext, id: string) {
    return auditedCommand(ctx, { action: "policy.disable", objectType: "Policy", objectId: id, event: "policy.disabled" }, async (tx) => {
      const policy = await tx.policy.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!policy) throw new AppError("NOT_FOUND", "Policy not found", 404);
      const updated = await tx.policy.update({ where: { id }, data: { enabled: false, effectiveTo: new Date() } });
      return { result: updated, oldValue: { enabled: policy.enabled }, newValue: { enabled: false } };
    });
  },
  async createWorkflow(ctx: RequestContext, body: { name: string; objectType: string; enabled?: boolean; effectiveFrom?: string; steps: Array<Record<string, unknown>> }) {
    if (!body.steps.length || body.steps.some((step) => !WORKFLOW_STEP_TYPES.has(String(step.type ?? step.role)))) throw new AppError("INVALID_STEP", "Workflow contains an unsupported approval step", 400);
    const id = crypto.randomUUID();
    return auditedCommand(ctx, { action: "approval_workflow.create", objectType: "ApprovalWorkflow", objectId: id, event: "approval_workflow.created" }, async (tx) => {
      const workflow = await tx.approvalWorkflow.create({ data: { id, organizationId: ctx.organizationId, name: body.name.trim(), objectType: body.objectType, enabled: body.enabled ?? false, effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(), steps: body.steps as Prisma.InputJsonValue } });
      return { result: workflow, newValue: { name: workflow.name, version: workflow.version, enabled: workflow.enabled } };
    });
  },
  async versionWorkflow(ctx: RequestContext, id: string, body: { name: string; objectType: string; enabled?: boolean; effectiveFrom?: string; steps: Array<Record<string, unknown>> }) {
    if (!body.steps.length || body.steps.some((step) => !WORKFLOW_STEP_TYPES.has(String(step.type ?? step.role)))) throw new AppError("INVALID_STEP", "Workflow contains an unsupported approval step", 400);
    return prisma.$transaction(async (tx) => {
      const current = await tx.approvalWorkflow.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!current) throw new AppError("NOT_FOUND", "Approval workflow not found", 404);
      const now = new Date();
      await tx.approvalWorkflow.update({ where: { id }, data: { enabled: false, effectiveTo: now } });
      const next = await tx.approvalWorkflow.create({ data: { organizationId: ctx.organizationId, name: body.name.trim(), objectType: body.objectType, version: current.version + 1, enabled: body.enabled ?? false, effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : now, steps: body.steps as Prisma.InputJsonValue } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "approval_workflow.version", objectType: "ApprovalWorkflow", objectId: next.id, oldValue: { id: current.id, version: current.version }, newValue: { version: next.version, enabled: next.enabled }, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "approval_workflow.versioned", payload: { workflowId: next.id, priorWorkflowId: current.id } } });
      return next;
    });
  },
  async setWorkflowEnabled(ctx: RequestContext, id: string, enabled: boolean) {
    return auditedCommand(ctx, { action: enabled ? "approval_workflow.enable" : "approval_workflow.disable", objectType: "ApprovalWorkflow", objectId: id, event: enabled ? "approval_workflow.enabled" : "approval_workflow.disabled" }, async (tx) => {
      const workflow = await tx.approvalWorkflow.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!workflow) throw new AppError("NOT_FOUND", "Approval workflow not found", 404);
      if (enabled) await tx.approvalWorkflow.updateMany({ where: { organizationId: ctx.organizationId, objectType: workflow.objectType, enabled: true }, data: { enabled: false, effectiveTo: new Date() } });
      const updated = await tx.approvalWorkflow.update({ where: { id }, data: { enabled, effectiveTo: enabled ? null : new Date() } });
      return { result: updated, oldValue: { enabled: workflow.enabled }, newValue: { enabled } };
    });
  },
};

export const spend = {
  async createRequest(ctx: RequestContext, body: {
    programId: string; name: string; amount: string; currency: string; legalEntityId: string;
    purpose?: string; vendorId?: string; fulfillmentType?: "VIRTUAL_CARD" | "FUND_ONLY";
    recurrence?: string; expiresAt?: string; category?: string; attachmentId?: string; comments?: string;
  }) {
    const money = requireMoney(body.amount, body.currency);
    assertEntityPermission(ctx, "spend_request.create", body.legalEntityId);
    return prisma.$transaction(async (tx) => {
      const program = await tx.spendProgram.findFirst({ where: { id: body.programId, organizationId: ctx.organizationId, legalEntityId: body.legalEntityId, status: "ACTIVE" } });
      if (!program) throw new AppError("INVALID_PROGRAM", "Spend program is unavailable", 400);
      requireCurrencyMatch(program.currency, money.currency);
      if (dec(money.amount).greaterThan(program.maxAmount)) {
        throw new AppError("INVALID_AMOUNT", "Amount must be within the program limit", 400);
      }
      const now = new Date();
      if (program.startDate && program.startDate > now) throw new AppError("PROGRAM_NOT_STARTED", "Spend program has not started", 400);
      if (program.endDate && program.endDate < now) throw new AppError("PROGRAM_EXPIRED", "Spend program has ended", 400);

      const requester = await tx.user.findFirst({ where: { id: ctx.userId, organizationId: ctx.organizationId } });
      if (!requester || requester.status !== "ACTIVE") throw new AppError("USER_INACTIVE", "Requester is inactive", 403);
      const eligibleUsers = Array.isArray(program.eligibleUserIds) ? program.eligibleUserIds as string[] : [];
      const eligibleDepts = Array.isArray(program.eligibleDepartmentIds) ? program.eligibleDepartmentIds as string[] : [];
      const eligibleLocs = Array.isArray(program.eligibleLocationIds) ? program.eligibleLocationIds as string[] : [];
      const eligibleRoles = Array.isArray(program.eligibleRoleNames) ? program.eligibleRoleNames as string[] : [];
      if (eligibleUsers.length && !eligibleUsers.includes(ctx.userId)) {
        throw new AppError("NOT_ELIGIBLE", "You are not assigned to this spend program", 403);
      }
      if (eligibleDepts.length && (!requester.departmentId || !eligibleDepts.includes(requester.departmentId))) {
        throw new AppError("NOT_ELIGIBLE", "Your department is not eligible for this spend program", 403);
      }
      if (eligibleLocs.length && (!requester.locationId || !eligibleLocs.includes(requester.locationId))) {
        throw new AppError("NOT_ELIGIBLE", "Your location is not eligible for this spend program", 403);
      }
      if (eligibleRoles.length) {
        const assignments = await tx.userRole.findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId } });
        const roles = await tx.role.findMany({ where: { id: { in: assignments.map((a) => a.roleId) }, organizationId: ctx.organizationId } });
        if (!roles.some((role) => eligibleRoles.includes(role.name))) {
          throw new AppError("NOT_ELIGIBLE", "Your role is not eligible for this spend program", 403);
        }
      }

      const entity = await tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity) throw new AppError("INVALID_ENTITY", "Entity is unavailable", 400);
      requireCurrencyMatch(entity.currency, money.currency);
      if (body.vendorId) {
        const vendor = await tx.vendor.findFirst({ where: { id: body.vendorId, organizationId: ctx.organizationId } });
        if (!vendor) throw new AppError("INVALID_VENDOR", "Vendor is unavailable", 400);
      }
      if (body.attachmentId) {
        const attachment = await tx.attachment.findFirst({ where: { id: body.attachmentId, organizationId: ctx.organizationId } });
        if (!attachment) throw new AppError("ATTACHMENT_NOT_FOUND", "Supporting document not found", 404);
      }
      const fulfillmentType = body.fulfillmentType
        ?? (program.defaultFulfillmentType === "FUND_ONLY" ? "FUND_ONLY" : "VIRTUAL_CARD");
      let expiresAt: Date | null = body.expiresAt ? new Date(body.expiresAt) : null;
      if (!expiresAt && program.defaultValidDays && program.defaultValidDays > 0) {
        expiresAt = new Date(Date.now() + program.defaultValidDays * 24 * 60 * 60 * 1000);
      }
      if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new AppError("INVALID_EXPIRY", "expiresAt is invalid", 400);
      if (expiresAt && expiresAt.getTime() <= Date.now()) throw new AppError("INVALID_EXPIRY", "expiresAt must be in the future", 400);

      const loaded = await loadPolicyRules(tx.policy.findMany.bind(tx.policy), ctx.organizationId, "spend_request");
      const policy = evaluatePolicy({
        objectType: "spend_request",
        amount: Number(money.amount),
        hasMemo: Boolean((body.purpose ?? "").trim()),
        category: body.category,
        rules: loaded.rules.length ? loaded.rules : [{ type: "high_value", threshold: 10000 }],
      });
      const policyVersion = loaded.policyNames.length
        ? Number((loaded.policyNames[0].match(/v(\d+)$/) ?? [])[1] ?? 1)
        : 0;

      if (policy.result === "BLOCK") {
        const blocked = await tx.spendRequest.create({
          data: {
            organizationId: ctx.organizationId,
            legalEntityId: body.legalEntityId,
            programId: body.programId,
            requesterId: ctx.userId,
            name: body.name.trim(),
            purpose: (body.purpose ?? "").trim(),
            category: (body.category ?? "").trim(),
            vendorId: body.vendorId || null,
            amount: dec(money.amount),
            currency: money.currency,
            status: "BLOCKED",
            fulfillmentType,
            recurrence: body.recurrence?.trim() || "NONE",
            expiresAt,
            attachmentId: body.attachmentId || null,
            comments: (body.comments ?? "").trim(),
            policyResult: policy.result,
            policyReason: policy.reason,
            policyMatchedRules: policy.matchedRules,
            policyRequiredActions: policy.requiredActions,
            policyVersion,
            policyEvaluatedAt: now,
          },
        });
        await tx.auditEvent.create({ data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "spend_request.policy_blocked",
          objectType: "SpendRequest", objectId: blocked.id,
          newValue: { policyResult: policy.result, reason: policy.reason, matchedRules: policy.matchedRules },
          correlationId: ctx.correlationId,
        } });
        await tx.outboxEvent.create({ data: {
          organizationId: ctx.organizationId, type: "request.policy_blocked",
          payload: { objectType: "SpendRequest", objectId: blocked.id, policyResult: policy.result },
        } });
        return { ...blocked, policy, blocked: true as const };
      }

      const request = await tx.spendRequest.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: body.legalEntityId,
          programId: body.programId,
          requesterId: ctx.userId,
          name: body.name.trim(),
          purpose: (body.purpose ?? "").trim(),
          category: (body.category ?? "").trim(),
          vendorId: body.vendorId || null,
          amount: dec(money.amount),
          currency: money.currency,
          status: "IN_REVIEW",
          fulfillmentType,
          recurrence: body.recurrence?.trim() || "NONE",
          expiresAt,
          attachmentId: body.attachmentId || null,
          comments: (body.comments ?? "").trim(),
          policyResult: policy.result,
          policyReason: policy.reason,
          policyMatchedRules: policy.matchedRules,
          policyRequiredActions: policy.requiredActions,
          policyVersion,
          policyEvaluatedAt: now,
        },
      });
      await startApproval({
        organizationId: ctx.organizationId,
        workflowId: program.workflowId,
        objectType: "spend_request",
        objectId: request.id,
        requesterId: ctx.userId,
        title: request.name,
        amount: money.amount,
        currency: money.currency,
        legalEntityId: body.legalEntityId,
        departmentId: requester.departmentId,
        policySummary: `${policy.result}: ${policy.reason}`,
        priority: policy.result === "REVIEW" || policy.result === "WARN" ? "HIGH" : undefined,
      }, tx);
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "spend_request.submit",
        objectType: "SpendRequest", objectId: request.id,
        newValue: {
          name: request.name, amount: money.amount, currency: money.currency, status: request.status,
          fulfillmentType, policyResult: policy.result, matchedRules: policy.matchedRules,
        },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "request.submitted", payload: { objectType: "SpendRequest", objectId: request.id, policyResult: policy.result } } });
      return { ...request, policy };
    });
  },
  async approveRequest(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.spendRequest.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!request) throw new AppError("NOT_FOUND", "Spend request not found", 404);
      if (request.status === "FULFILLED" || request.status === "APPROVED") {
        const fund = await tx.fund.findFirst({ where: { organizationId: ctx.organizationId, spendRequestId: id } });
        const fulfillmentType = request.fulfillmentType === "FUND_ONLY" ? "FUND_ONLY" : "VIRTUAL_CARD";
        let card = null;
        if (fulfillmentType === "VIRTUAL_CARD") {
          card =
            (fund ? await tx.card.findFirst({ where: { organizationId: ctx.organizationId, fundId: fund.id } }) : null)
            ?? (await findHolderLiveCard(tx, ctx.organizationId, request.requesterId));
        }
        return { request, fund, card, approval: null };
      }
      if (request.status !== "SUBMITTED" && request.status !== "IN_REVIEW") throw new AppError("INVALID_STATE", "Request is not pending approval", 409);
      assertEntityPermission(ctx, "spend_request.approve", request.legalEntityId);
      const instance = await tx.approvalInstance.findFirst({
        where: { organizationId: ctx.organizationId, objectId: id, objectType: "spend_request", status: { in: ["IN_REVIEW", "INFO_REQUESTED", "ESCALATED"] } },
        orderBy: { createdAt: "desc" },
      });
      if (!instance) throw new AppError("NOT_FOUND", "Approval was not started", 404);
      const updatedInstance = await actOnApproval({ instanceId: instance.id, actorId: ctx.userId, action: "approve" }, tx);
      if (updatedInstance.status !== "APPROVED") {
        await tx.spendRequest.updateMany({ where: { id, organizationId: ctx.organizationId, status: { in: ["SUBMITTED", "IN_REVIEW"] } }, data: { status: "IN_REVIEW" } });
        return { request: await tx.spendRequest.findUniqueOrThrow({ where: { id } }), approval: updatedInstance };
      }

      const claim = await tx.spendRequest.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["SUBMITTED", "IN_REVIEW"] } },
        data: { status: "APPROVED" },
      });
      if (claim.count !== 1) throw new AppError("REQUEST_CONFLICT", "Request changed; refresh and try again", 409);

      const program = await tx.spendProgram.findFirst({ where: { id: request.programId, organizationId: ctx.organizationId } });
      const fulfillmentType = request.fulfillmentType === "FUND_ONLY" ? "FUND_ONLY" : "VIRTUAL_CARD";

      if (program?.budgetId) {
        const budget = await tx.budget.findFirst({
          where: { id: program.budgetId, organizationId: ctx.organizationId, legalEntityId: request.legalEntityId },
        });
        if (!budget) throw new AppError("BUDGET_UNAVAILABLE", "Linked budget is unavailable", 400);
        if (budget.committedAmount.plus(budget.actualAmount).plus(request.amount).greaterThan(budget.amount)) {
          throw new AppError("BUDGET_EXCEEDED", "Request would exceed remaining budget capacity", 400);
        }
        const reserved = await tx.budget.updateMany({
          where: { id: budget.id, committedAmount: budget.committedAmount, actualAmount: budget.actualAmount },
          data: { committedAmount: { increment: request.amount }, freshness: new Date() },
        });
        if (reserved.count !== 1) throw new AppError("BUDGET_CONFLICT", "Budget changed; refresh and try again", 409);
      }

      let fund = await tx.fund.findFirst({ where: { organizationId: ctx.organizationId, spendRequestId: request.id } });
      if (!fund) {
        try {
          fund = await tx.fund.create({
            data: {
              organizationId: ctx.organizationId,
              legalEntityId: request.legalEntityId,
              name: `${request.name} fund`,
              ownerId: request.requesterId,
              spendRequestId: request.id,
              availableAmount: request.amount,
              limitAmount: request.amount,
              currency: request.currency,
              validFrom: new Date(),
              validTo: request.expiresAt,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            fund = await tx.fund.findFirstOrThrow({ where: { organizationId: ctx.organizationId, spendRequestId: request.id } });
          } else {
            throw error;
          }
        }
      }

      let card = null;
      if (fulfillmentType === "VIRTUAL_CARD") {
        let lock: string | null = program?.merchantLockDefault?.trim() || null;
        if (request.vendorId) {
          const vendor = await tx.vendor.findFirst({ where: { id: request.vendorId, organizationId: ctx.organizationId } });
          lock = vendor?.name ?? lock;
        }
        card = await ensureHolderVirtualCard(tx, {
          organizationId: ctx.organizationId,
          legalEntityId: request.legalEntityId,
          holderId: request.requesterId,
          fundId: fund.id,
          merchantLock: lock,
          allowedMccs: program?.allowedMccsDefault || null,
          perTransactionLimit: program?.perTransactionLimitDefault ?? null,
          velocityMaxAmount: program?.velocityMaxAmountDefault ?? null,
          velocityMaxCount: program?.velocityMaxCountDefault ?? null,
          providerPrefix: "mock",
        });
      }

      await tx.spendRequest.update({ where: { id }, data: { status: "FULFILLED" } });
      const updated = await tx.spendRequest.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "spend_request.approve",
        objectType: "SpendRequest", objectId: id,
        oldValue: { status: request.status },
        newValue: { status: updated.status, fulfillmentType, fundId: fund.id, cardId: card?.id ?? null },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "request.approved", payload: { objectType: "SpendRequest", objectId: id, fundId: fund.id, cardId: card?.id ?? null, fulfillmentType } } });
      return { request: updated, fund, card, approval: updatedInstance };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async getRequestDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "spend-requests");
    const request = await prisma.spendRequest.findFirst({ where: { ...scope, id } });
    if (!request) throw new AppError("NOT_FOUND", "Spend request not found", 404);
    const [program, requester, vendor, entity, fund, instance, actions, audit] = await Promise.all([
      prisma.spendProgram.findFirst({ where: { id: request.programId, organizationId: ctx.organizationId } }),
      prisma.user.findFirst({ where: { id: request.requesterId, organizationId: ctx.organizationId }, select: { id: true, firstName: true, lastName: true, email: true, departmentId: true } }),
      request.vendorId ? prisma.vendor.findFirst({ where: { id: request.vendorId, organizationId: ctx.organizationId } }) : null,
      prisma.legalEntity.findFirst({ where: { id: request.legalEntityId, organizationId: ctx.organizationId } }),
      prisma.fund.findFirst({ where: { organizationId: ctx.organizationId, spendRequestId: id } }),
      prisma.approvalInstance.findFirst({ where: { organizationId: ctx.organizationId, objectType: "spend_request", objectId: id }, orderBy: { createdAt: "desc" } }),
      prisma.approvalAction.findMany({
        where: { instanceId: { in: (await prisma.approvalInstance.findMany({ where: { organizationId: ctx.organizationId, objectType: "spend_request", objectId: id }, select: { id: true } })).map((row) => row.id) } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, OR: [{ objectType: "SpendRequest", objectId: id }, { objectId: id }] },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
    ]);
    let card = null;
    if (request.fulfillmentType !== "FUND_ONLY") {
      const byFund = fund
        ? await prisma.card.findFirst({ where: { organizationId: ctx.organizationId, fundId: fund.id } })
        : null;
      // After one-card-per-holder reuse the wallet card may not sit on this request's fund.
      card =
        byFund
        ?? (request.status === "FULFILLED"
          ? await findHolderLiveCard(prisma, ctx.organizationId, request.requesterId)
          : null);
    }
    const steps = Array.isArray(instance?.resolvedSteps) ? instance!.resolvedSteps as Array<{ type?: string; role?: string }> : [];
    const approveCount = actions.filter((row) => row.action === "approve").length;
    const approvalProgress = steps.map((step, index) => ({
      label: (step.type ?? step.role ?? `Step ${index + 1}`).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      status: instance?.status === "REJECTED" && index === instance.currentStep
        ? "Rejected"
        : instance?.status === "INFO_REQUESTED" && index === instance.currentStep
          ? "Info requested"
        : index < approveCount || instance?.status === "APPROVED"
          ? "Approved"
          : index === (instance?.currentStep ?? 0)
            ? "Pending"
            : "Waiting",
    }));
    return {
      request,
      program,
      requester,
      vendor,
      entity,
      fund,
      card,
      approval: instance,
      approvalProgress,
      approvalLabel: instance ? progressLabel(instance.currentStep, steps.length || 1, instance.status) : "",
      policy: {
        result: request.policyResult,
        reason: request.policyReason,
        matchedRules: request.policyMatchedRules,
        requiredActions: request.policyRequiredActions,
        version: request.policyVersion,
        evaluatedAt: request.policyEvaluatedAt,
      },
      timeline: audit,
      sandbox: env.nodeEnv !== "production",
    };
  },

  async deactivateProgram(ctx: RequestContext, id: string) {
    return auditedCommand(ctx, { action: "spend_program.deactivate", objectType: "SpendProgram", objectId: id, event: "spend_program.deactivated" }, async (tx) => {
      const program = await tx.spendProgram.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!program) throw new AppError("NOT_FOUND", "Spend program not found", 404);
      assertEntityPermission(ctx, "spend_program.manage", program.legalEntityId);
      if (program.status === "INACTIVE") {
        return { result: program, oldValue: { status: program.status }, newValue: { status: program.status } };
      }
      const updated = await tx.spendProgram.update({ where: { id }, data: { status: "INACTIVE" } });
      return { result: updated, oldValue: { status: program.status }, newValue: { status: "INACTIVE" } };
    });
  },
};

export const cards = {
  /** Non-prod Stripe path: force-capture so Financial Account is actually debited (no RTA webhook required). */
  async authorizeStripeSandbox(ctx: RequestContext, body: {
    cardId: string; amount: string; currency: string; merchant: string; merchantCategory: string; idempotencyKey: string;
  }) {
    const money = requireMoney(body.amount, body.currency);
    const scopedKey = `${ctx.organizationId}:${body.idempotencyKey}`;
    const existing = await prisma.cardAuthorization.findFirst({
      where: { organizationId: ctx.organizationId, idempotencyKey: { in: [scopedKey, body.idempotencyKey] } },
    });
    if (existing) {
      const priorTxn = await prisma.txn.findFirst({
        where: { organizationId: ctx.organizationId, authorizationId: existing.id },
        select: { id: true },
      });
      return { ...existing, transactionId: priorTxn?.id };
    }

    const card = await prisma.card.findFirst({ where: { id: body.cardId, organizationId: ctx.organizationId } });
    if (!card) throw new AppError("NOT_FOUND", "Card not found", 404);
    assertEntityPermission(ctx, "card.issue", card.legalEntityId);
    const providerCardId = providerCardIdOf(card);
    if (!providerCardId || !providerCardId.startsWith("ic_")) {
      throw new AppError(
        "CARD_NOT_PROVISIONED",
        "This card is not linked to Stripe Issuing yet. Re-approve/fulfill a spend request so the card gets a Stripe id (ic_…).",
        409,
      );
    }

    let stripeCategories: string[] | undefined;
    try {
      stripeCategories = toStripeSpendingCategories([body.merchantCategory]);
    } catch (error) {
      throw new AppError(
        "INVALID_CATEGORY",
        error instanceof Error ? error.message : "Invalid merchant category for Stripe Issuing",
        400,
      );
    }
    const merchantCategory = stripeCategories?.[0] ?? "miscellaneous";

    const holder = await prisma.user.findFirst({ where: { id: card.holderId, organizationId: ctx.organizationId } });
    const fund = await prisma.fund.findFirst({ where: { id: card.fundId, organizationId: ctx.organizationId } });
    const amount = dec(money.amount);
    const now = new Date();
    const windowHours = Math.max(1, card.velocityWindowHours || 24);
    const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const velocityTxns = await prisma.txn.findMany({
      where: {
        organizationId: ctx.organizationId,
        cardId: card.id,
        status: { in: ["PENDING", "CLEARED"] },
        authorizedAt: { gte: since },
      },
      select: { amount: true },
    });
    const rule = evaluateCardAuthorizationRules({
      cardStatus: card.status,
      holderStatus: holder?.status ?? "INACTIVE",
      fundStatus: fund?.status ?? "INACTIVE",
      fundAvailable: fund?.availableAmount ?? 0,
      fundValidFrom: fund?.validFrom ?? now,
      fundValidTo: fund?.validTo ?? null,
      amount,
      currency: money.currency,
      fundCurrency: fund?.currency ?? money.currency,
      merchant: body.merchant,
      merchantCategory: body.merchantCategory,
      merchantLock: card.merchantLock,
      allowedMccs: card.allowedMccs,
      blockedMccs: card.blockedMccs,
      allowedCountries: card.allowedCountries,
      blockedCountries: card.blockedCountries,
      perTransactionLimit: card.perTransactionLimit,
      dailyLimit: card.dailyLimit,
      weeklyLimit: card.weeklyLimit,
      monthlyLimit: card.monthlyLimit,
      velocityMaxAmount: card.velocityMaxAmount,
      velocityMaxCount: card.velocityMaxCount,
      windowSpendAmount: velocityTxns.reduce((sum, row) => sum.plus(row.amount), dec(0)),
      windowSpendCount: velocityTxns.length,
      now,
    });

    if (rule.decision === "DECLINED") {
      const declined = await prisma.cardAuthorization.create({
        data: {
          organizationId: ctx.organizationId,
          cardId: card.id,
          fundId: card.fundId,
          amount,
          currency: money.currency,
          merchant: body.merchant,
          merchantCategory: body.merchantCategory,
          decision: "DECLINED",
          reason: rule.reason,
          providerEventId: `stripe_declined_${scopedKey}`,
          idempotencyKey: scopedKey,
        },
      });
      return { ...declined, transactionId: undefined as string | undefined };
    }

    if (!fund || fund.availableAmount.lessThan(amount)) {
      throw new AppError("INSUFFICIENT_FUND", "Insufficient local fund available for this capture", 409);
    }

    const issuer = getCardIssuer();
    if (!(issuer instanceof StripeCardIssuerAdapter)) {
      throw new AppError("PROVIDER_REQUIRED", "Stripe adapter is not active", 500);
    }

    let stripeTxn;
    try {
      stripeTxn = await issuer.createForceCaptureRaw({
        providerCardId,
        amountCents: Math.round(Number(money.amount) * 100),
        currency: money.currency,
        merchant: body.merchant,
        merchantCategory,
      });
    } catch (error) {
      mapIssuerError(error);
    }

    const stripeAuthId = typeof stripeTxn.authorization === "string"
      ? stripeTxn.authorization
      : stripeTxn.authorization?.id ?? null;

    // Reserve local fund capacity (force-capture has no prior auth hold).
    const reserved = await prisma.fund.updateMany({
      where: {
        id: card.fundId,
        organizationId: ctx.organizationId,
        status: "ACTIVE",
        availableAmount: { gte: amount },
      },
      data: { availableAmount: { decrement: amount } },
    });
    if (reserved.count !== 1) {
      throw new AppError("INSUFFICIENT_FUND", "Insufficient fund available after Stripe capture; reconcile balances", 409);
    }

    try {
      const localAuth = await prisma.cardAuthorization.create({
        data: {
          organizationId: ctx.organizationId,
          cardId: card.id,
          fundId: card.fundId,
          amount,
          currency: money.currency,
          merchant: body.merchant,
          merchantCategory: body.merchantCategory,
          decision: "APPROVED",
          reason: "stripe_force_capture",
          providerEventId: stripeTxn.id,
          stripeAuthorizationId: stripeAuthId,
          idempotencyKey: scopedKey,
        },
      });

      await applyStripeIssuingTransactionCreated(stripeTxn);

      await prisma.txn.updateMany({
        where: {
          organizationId: ctx.organizationId,
          stripeTransactionId: stripeTxn.id,
          authorizationId: null,
        },
        data: { authorizationId: localAuth.id },
      });

      const localTxn = await prisma.txn.findFirst({
        where: { organizationId: ctx.organizationId, stripeTransactionId: stripeTxn.id },
      });

      return { ...localAuth, transactionId: localTxn?.id };
    } catch (error) {
      await prisma.fund.update({
        where: { id: card.fundId },
        data: { availableAmount: { increment: amount } },
      }).catch(() => undefined);
      throw error;
    }
  },

  /** Local auth+capture ledger used by mock issuer and as Stripe sandbox fallback. */
  async authorizeLocalLedger(ctx: RequestContext, body: {
    cardId: string; amount: string; currency: string; merchant: string; merchantCategory: string; idempotencyKey: string;
  }) {
    const money = requireMoney(body.amount, body.currency);
    const scopedKey = `${ctx.organizationId}:${body.idempotencyKey}`;
    return prisma.$transaction(async (tx) => {
      const existing = await tx.cardAuthorization.findFirst({
        where: { organizationId: ctx.organizationId, idempotencyKey: { in: [scopedKey, body.idempotencyKey] } },
      });
      if (existing) {
        if (existing.cardId !== body.cardId || !existing.amount.equals(money.amount) || existing.currency !== money.currency || existing.merchant !== body.merchant || existing.merchantCategory !== body.merchantCategory) {
          throw new AppError("IDEMPOTENCY_CONFLICT", "This idempotency key was used for a different authorization", 409);
        }
        const priorTxn = await tx.txn.findFirst({ where: { organizationId: ctx.organizationId, authorizationId: existing.id }, select: { id: true } });
        return { ...existing, transactionId: priorTxn?.id };
      }

      const decline = async (input: { cardId: string; fundId: string; reason: string }) => {
        const declined = await tx.cardAuthorization.create({
          data: {
            organizationId: ctx.organizationId,
            cardId: input.cardId,
            fundId: input.fundId,
            amount: dec(money.amount),
            currency: money.currency,
            merchant: body.merchant,
            merchantCategory: body.merchantCategory,
            decision: "DECLINED",
            reason: input.reason,
            idempotencyKey: scopedKey,
          },
        });
        await tx.auditEvent.create({ data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "card.authorize",
          objectType: "CardAuthorization", objectId: declined.id,
          newValue: { decision: declined.decision, reason: declined.reason }, correlationId: ctx.correlationId,
        } });
        return declined;
      };

      const card = await tx.card.findFirst({ where: { id: body.cardId, organizationId: ctx.organizationId } });
      if (!card) {
        return decline({ cardId: body.cardId, fundId: "none", reason: "CARD_INACTIVE" });
      }
      assertEntityPermission(ctx, "card.issue", card.legalEntityId);
      const entity = await tx.legalEntity.findFirst({ where: { id: card.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity) throw new AppError("INVALID_ENTITY", "Entity is unavailable", 400);
      requireCurrencyMatch(entity.currency, money.currency);

      const holder = await tx.user.findFirst({ where: { id: card.holderId, organizationId: ctx.organizationId } });
      const fund = await tx.fund.findFirst({ where: { id: card.fundId, organizationId: ctx.organizationId } });
      const amount = dec(money.amount);
      const now = new Date();
      const windowHours = Math.max(1, card.velocityWindowHours || 24);
      const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
      const velocityTxns = await tx.txn.findMany({
        where: {
          organizationId: ctx.organizationId,
          cardId: card.id,
          status: { in: ["PENDING", "CLEARED"] },
          authorizedAt: { gte: since },
        },
        select: { amount: true },
      });
      const dayTxns = await tx.txn.findMany({
        where: { organizationId: ctx.organizationId, cardId: card.id, status: { in: ["PENDING", "CLEARED"] }, authorizedAt: { gte: new Date(now.getTime() - 86400000) } },
        select: { amount: true },
      });
      const weekTxns = await tx.txn.findMany({
        where: { organizationId: ctx.organizationId, cardId: card.id, status: { in: ["PENDING", "CLEARED"] }, authorizedAt: { gte: new Date(now.getTime() - 7 * 86400000) } },
        select: { amount: true },
      });
      const monthTxns = await tx.txn.findMany({
        where: { organizationId: ctx.organizationId, cardId: card.id, status: { in: ["PENDING", "CLEARED"] }, authorizedAt: { gte: new Date(now.getTime() - 30 * 86400000) } },
        select: { amount: true },
      });
      const businessLimit = await tx.businessLimit.findFirst({
        where: { organizationId: ctx.organizationId, legalEntityId: card.legalEntityId, currency: money.currency },
      });
      let businessUsed: Prisma.Decimal | null = null;
      if (businessLimit) {
        const usage = await tx.txn.aggregate({
          where: {
            organizationId: ctx.organizationId,
            legalEntityId: card.legalEntityId,
            currency: money.currency,
            status: { in: ["PENDING", "CLEARED"] },
          },
          _sum: { amount: true },
        });
        businessUsed = usage._sum.amount ?? dec(0);
      }

      const rule = evaluateCardAuthorizationRules({
        cardStatus: card.status,
        holderStatus: holder?.status ?? "INACTIVE",
        fundStatus: fund?.status ?? "INACTIVE",
        fundAvailable: fund?.availableAmount ?? 0,
        fundValidFrom: fund?.validFrom ?? now,
        fundValidTo: fund?.validTo ?? null,
        amount,
        currency: money.currency,
        fundCurrency: fund?.currency ?? money.currency,
        merchant: body.merchant,
        merchantCategory: body.merchantCategory,
        merchantLock: card.merchantLock,
        allowedMccs: card.allowedMccs,
        blockedMccs: card.blockedMccs,
        allowedCountries: card.allowedCountries,
        blockedCountries: card.blockedCountries,
        perTransactionLimit: card.perTransactionLimit,
        dailyLimit: card.dailyLimit,
        weeklyLimit: card.weeklyLimit,
        monthlyLimit: card.monthlyLimit,
        velocityMaxAmount: card.velocityMaxAmount,
        velocityMaxCount: card.velocityMaxCount,
        windowSpendAmount: velocityTxns.reduce((sum, row) => sum.plus(row.amount), dec(0)),
        windowSpendCount: velocityTxns.length,
        dailySpendAmount: dayTxns.reduce((sum, row) => sum.plus(row.amount), dec(0)),
        weeklySpendAmount: weekTxns.reduce((sum, row) => sum.plus(row.amount), dec(0)),
        monthlySpendAmount: monthTxns.reduce((sum, row) => sum.plus(row.amount), dec(0)),
        businessLimitAmount: businessLimit?.amount ?? null,
        businessUsedAmount: businessUsed,
        now,
      });
      if (rule.decision === "DECLINED") {
        return decline({ cardId: card.id, fundId: card.fundId, reason: rule.reason });
      }

      const reserved = await tx.fund.updateMany({
        where: { id: card.fundId, organizationId: ctx.organizationId, status: "ACTIVE", availableAmount: { gte: amount } },
        data: { availableAmount: { decrement: amount } },
      });
      if (reserved.count === 0) {
        return decline({ cardId: card.id, fundId: card.fundId, reason: "INSUFFICIENT_FUND" });
      }

      const loaded = await loadPolicyRules(tx.policy.findMany.bind(tx.policy), ctx.organizationId, "card");
      const policy = evaluatePolicy({
        objectType: "card",
        amount: Number(money.amount),
        merchant: body.merchant,
        category: body.merchantCategory,
        rules: loaded.rules.length ? loaded.rules : undefined,
      });
      if (policy.result === "BLOCK") {
        await tx.fund.update({ where: { id: card.fundId }, data: { availableAmount: { increment: amount } } });
        return decline({ cardId: card.id, fundId: card.fundId, reason: policy.rule || "POLICY_BLOCK" });
      }

      const auth = await tx.cardAuthorization.create({
        data: {
          organizationId: ctx.organizationId,
          cardId: card.id,
          fundId: card.fundId,
          amount,
          currency: money.currency,
          merchant: body.merchant,
          merchantCategory: body.merchantCategory,
          decision: "APPROVED",
          reason: policy.rule,
          providerEventId: `mock_auth_${scopedKey}`,
          idempotencyKey: scopedKey,
        },
      });
      const txn = await tx.txn.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: card.legalEntityId,
          cardId: card.id,
          fundId: card.fundId,
          authorizationId: auth.id,
          amount,
          currency: money.currency,
          merchant: body.merchant,
          status: "PENDING",
        },
      });
      await postLedger(ctx.organizationId, `auth ${auth.id}`, [
        { account: `fund:${card.fundId}`, direction: "DEBIT", amount: money.amount, currency: money.currency },
        { account: "card.pending", direction: "CREDIT", amount: money.amount, currency: money.currency },
      ], tx);
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "card.authorize",
        objectType: "CardAuthorization", objectId: auth.id,
        newValue: { decision: auth.decision, transactionId: txn.id, amount: money.amount }, correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: {
        organizationId: ctx.organizationId, type: "transaction.authorized",
        payload: { objectType: "CardAuthorization", objectId: auth.id, transactionId: txn.id },
      } });
      return { ...auth, transactionId: txn.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async authorize(ctx: RequestContext, body: { cardId: string; amount: string; currency: string; merchant: string; merchantCategory: string; idempotencyKey: string }) {
    if (env.nodeEnv === "production") {
      throw new AppError("PROVIDER_REQUIRED", "Card authorization must come from the certified issuer (Stripe Issuing webhooks).", 403);
    }
    if (isStripeCardIssuer()) {
      return cards.authorizeStripeSandbox(ctx, body);
    }
    return cards.authorizeLocalLedger(ctx, body);
  },

  async capture(ctx: RequestContext, transactionId: string, body: { amount?: string } = {}) {
    if (env.nodeEnv === "production") {
      throw new AppError("PROVIDER_REQUIRED", "Transaction capture must come from the certified issuer. Sandbox capture is mock-only.", 403);
    }
    if (isStripeCardIssuer()) {
      const pending = await prisma.txn.findFirst({
        where: { id: transactionId, organizationId: ctx.organizationId },
        select: { stripeTransactionId: true, status: true },
      });
      // Stripe live clearing uses webhooks; allow capture only for local sandbox holds (no stripe txn id).
      if (pending?.stripeTransactionId || pending?.status !== "PENDING") {
        throw new AppError("PROVIDER_REQUIRED", "Stripe card captures arrive via Issuing webhooks (or Authorize & capture). Manual capture is for local holds only.", 403);
      }
    }
    return prisma.$transaction(async (tx) => {
      let txn = await tx.txn.findFirst({ where: { id: transactionId, organizationId: ctx.organizationId } });
      if (!txn) throw new AppError("NOT_FOUND", "Transaction not found", 404);
      assertEntityPermission(ctx, "card.issue", txn.legalEntityId);
      if (txn.status === "CLEARED") {
        const existingExpense = await tx.expense.findFirst({ where: { organizationId: ctx.organizationId, transactionId: txn.id } });
        return { transaction: txn, expense: existingExpense };
      }
      if (txn.status !== "PENDING") throw new AppError("INVALID_STATE", "Only pending holds can be captured", 409);

      const captureAmount = body.amount ? dec(requireMoney(body.amount, txn.currency).amount) : txn.amount;
      if (captureAmount.lessThanOrEqualTo(0) || captureAmount.greaterThan(txn.amount)) {
        throw new AppError("INVALID_AMOUNT", "Capture amount must be within the authorized hold", 400);
      }

      const release = txn.amount.minus(captureAmount);
      const claim = await tx.txn.updateMany({
        where: { id: txn.id, organizationId: ctx.organizationId, status: "PENDING" },
        data: {
          status: "CLEARED",
          amount: captureAmount,
          capturedAmount: captureAmount,
          clearedAt: new Date(),
        },
      });
      if (claim.count !== 1) throw new AppError("TRANSACTION_CONFLICT", "Transaction changed; refresh and try again", 409);

      if (txn.fundId && release.greaterThan(0)) {
        await tx.fund.update({
          where: { id: txn.fundId },
          data: { availableAmount: { increment: release } },
        });
        await postLedger(ctx.organizationId, `capture release ${txn.id}`, [
          { account: "card.pending", direction: "DEBIT", amount: String(release), currency: txn.currency },
          { account: `fund:${txn.fundId}`, direction: "CREDIT", amount: String(release), currency: txn.currency },
        ], tx);
      }

      await applyBudgetCapture(tx, ctx.organizationId, txn.legalEntityId, txn.fundId, captureAmount);

      let holderId = ctx.userId;
      if (txn.cardId) {
        const card = await tx.card.findFirst({ where: { id: txn.cardId, organizationId: ctx.organizationId } });
        if (card) holderId = card.holderId;
      }

      // Normalize merchant to an existing vendor when names match (no duplicate vendor creation).
      if (!txn.vendorId && txn.merchant.trim()) {
        const merchant = txn.merchant.trim().toLowerCase();
        const vendors = await tx.vendor.findMany({
          where: { organizationId: ctx.organizationId, status: "ACTIVE" },
          select: { id: true, name: true },
          take: 500,
        });
        const match = vendors.find((vendor) => {
          const name = vendor.name.trim().toLowerCase();
          return name === merchant || name.includes(merchant) || merchant.includes(name);
        });
        if (match) {
          await tx.txn.update({ where: { id: txn.id }, data: { vendorId: match.id } });
          txn = { ...txn, vendorId: match.id };
        }
      }

      let expense = await tx.expense.findFirst({ where: { organizationId: ctx.organizationId, transactionId: txn.id } });
      if (!expense) {
        const tripOr: Array<{ cardId?: string; fundId?: string }> = [];
        if (txn.cardId) tripOr.push({ cardId: txn.cardId });
        if (txn.fundId) tripOr.push({ fundId: txn.fundId });
        const travelTrip = tripOr.length
          ? await tx.travelTrip.findFirst({
              where: {
                organizationId: ctx.organizationId,
                OR: tripOr,
                status: { in: ["CONFIRMED", "BOOKING", "BOOKED"] },
              },
              orderBy: { updatedAt: "desc" },
            })
          : null;
        const travelBooking = travelTrip
          ? await tx.travelBooking.findFirst({
              where: { organizationId: ctx.organizationId, tripId: travelTrip.id, status: { in: ["CONFIRMED", "BOOKED_MOCK"] } },
              orderBy: { createdAt: "desc" },
            })
          : null;
        const categoryByType: Record<string, string> = {
          FLIGHT: "Airfare",
          HOTEL: "Hotel",
          CAR: "Car",
        };
        const tripMemo = travelTrip
          ? `Travel · ${travelTrip.destination}${travelTrip.purpose ? ` · ${travelTrip.purpose}` : ""}${travelBooking ? ` · ${travelBooking.confirmationNumber || travelBooking.supplier}` : ""}`
          : txn.merchant;
        try {
          expense = await tx.expense.create({
            data: {
              organizationId: ctx.organizationId,
              legalEntityId: txn.legalEntityId,
              userId: holderId,
              transactionId: txn.id,
              amount: captureAmount,
              currency: txn.currency,
              merchant: txn.merchant,
              memo: tripMemo,
              status: "INCOMPLETE",
            },
          });
          if (travelTrip) {
            await tx.travelTrip.update({
              where: { id: travelTrip.id },
              data: { expenseId: expense.id },
            });
            try {
              await tx.expenseSplit.create({
                data: {
                  organizationId: ctx.organizationId,
                  expenseId: expense.id,
                  amount: captureAmount,
                  category: categoryByType[travelBooking?.type ?? ""] ?? "Travel",
                  department: travelTrip.department || "",
                },
              });
            } catch {
              /* split is best-effort metadata */
            }
          }
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            expense = await tx.expense.findFirstOrThrow({ where: { organizationId: ctx.organizationId, transactionId: txn.id } });
          } else {
            throw error;
          }
        }
      }
      await queueAccounting(ctx, "CARD_TRANSACTION", txn.id, txn.legalEntityId, tx, {
        amount: captureAmount,
        currency: txn.currency,
        memo: txn.merchant,
      });
      const updated = await tx.txn.update({
        where: { id: txn.id },
        data: { providerClearEventId: `mock_clear_${txn.id}` },
      });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "transaction.capture",
        objectType: "Transaction", objectId: txn.id,
        oldValue: { status: "PENDING", amount: String(txn.amount) },
        newValue: { status: "CLEARED", amount: String(captureAmount), expenseId: expense.id },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: {
        organizationId: ctx.organizationId, type: "transaction.cleared",
        payload: { objectType: "Transaction", objectId: txn.id, expenseId: expense.id, capturedAmount: String(captureAmount) },
      } });
      return { transaction: updated, expense };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async clear(ctx: RequestContext, transactionId: string) {
    return cards.capture(ctx, transactionId, {});
  },

  async void(ctx: RequestContext, transactionId: string) {
    if (env.nodeEnv === "production" || isStripeCardIssuer()) {
      throw new AppError("PROVIDER_REQUIRED", "Transaction void must come from the certified issuer. Sandbox void is mock-only.", 403);
    }
    return prisma.$transaction(async (tx) => {
      const txn = await tx.txn.findFirst({ where: { id: transactionId, organizationId: ctx.organizationId } });
      if (!txn) throw new AppError("NOT_FOUND", "Transaction not found", 404);
      assertEntityPermission(ctx, "card.issue", txn.legalEntityId);
      if (txn.status === "VOIDED") return { transaction: txn };
      if (txn.status !== "PENDING") throw new AppError("INVALID_STATE", "Only pending holds can be voided", 409);
      const claim = await tx.txn.updateMany({
        where: { id: txn.id, organizationId: ctx.organizationId, status: "PENDING" },
        data: { status: "VOIDED", voidedAt: new Date() },
      });
      if (claim.count !== 1) throw new AppError("TRANSACTION_CONFLICT", "Transaction changed; refresh and try again", 409);
      if (txn.fundId) {
        await tx.fund.update({
          where: { id: txn.fundId },
          data: { availableAmount: { increment: txn.amount } },
        });
        await postLedger(ctx.organizationId, `void ${txn.id}`, [
          { account: "card.pending", direction: "DEBIT", amount: String(txn.amount), currency: txn.currency },
          { account: `fund:${txn.fundId}`, direction: "CREDIT", amount: String(txn.amount), currency: txn.currency },
        ], tx);
      }
      const updated = await tx.txn.findUniqueOrThrow({ where: { id: txn.id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "transaction.void",
        objectType: "Transaction", objectId: txn.id,
        oldValue: { status: "PENDING" }, newValue: { status: "VOIDED" },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: {
        organizationId: ctx.organizationId, type: "transaction.voided",
        payload: { objectType: "Transaction", objectId: txn.id },
      } });
      return { transaction: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async reverse(ctx: RequestContext, transactionId: string) {
    if (env.nodeEnv === "production" || isStripeCardIssuer()) {
      throw new AppError("PROVIDER_REQUIRED", "Transaction reversal must come from the certified issuer. Sandbox reverse is mock-only.", 403);
    }
    return prisma.$transaction(async (tx) => {
      const txn = await tx.txn.findFirst({ where: { id: transactionId, organizationId: ctx.organizationId } });
      if (!txn) throw new AppError("NOT_FOUND", "Transaction not found", 404);
      assertEntityPermission(ctx, "card.issue", txn.legalEntityId);
      if (txn.status === "REVERSED") return { transaction: txn };
      if (txn.status !== "CLEARED") throw new AppError("INVALID_STATE", "Only cleared transactions can be reversed", 409);
      const captured = txn.capturedAmount ?? txn.amount;
      const claim = await tx.txn.updateMany({
        where: { id: txn.id, organizationId: ctx.organizationId, status: "CLEARED" },
        data: { status: "REVERSED", reversedAt: new Date() },
      });
      if (claim.count !== 1) throw new AppError("TRANSACTION_CONFLICT", "Transaction changed; refresh and try again", 409);
      if (txn.fundId) {
        await tx.fund.update({
          where: { id: txn.fundId },
          data: { availableAmount: { increment: captured } },
        });
        await postLedger(ctx.organizationId, `reverse ${txn.id}`, [
          { account: "card.cleared", direction: "DEBIT", amount: String(captured), currency: txn.currency },
          { account: `fund:${txn.fundId}`, direction: "CREDIT", amount: String(captured), currency: txn.currency },
        ], tx);
      }
      await applyBudgetReverse(tx, ctx.organizationId, txn.legalEntityId, txn.fundId, captured);
      await tx.expense.updateMany({
        where: { organizationId: ctx.organizationId, transactionId: txn.id, status: { not: "CANCELLED" } },
        data: { status: "CANCELLED" },
      });
      const updated = await tx.txn.findUniqueOrThrow({ where: { id: txn.id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "transaction.reverse",
        objectType: "Transaction", objectId: txn.id,
        oldValue: { status: "CLEARED" }, newValue: { status: "REVERSED" },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: {
        organizationId: ctx.organizationId, type: "transaction.reversed",
        payload: { objectType: "Transaction", objectId: txn.id },
      } });
      return { transaction: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async freeze(ctx: RequestContext, cardId: string) {
    return auditedCommand(ctx, { action: "card.freeze", objectType: "Card", objectId: cardId, event: "card.frozen" }, async (tx) => {
      const existing = await tx.card.findFirst({ where: { id: cardId, organizationId: ctx.organizationId } });
      if (!existing) throw new AppError("NOT_FOUND", "Card not found", 404);
      assertEntityPermission(ctx, "card.freeze", existing.legalEntityId);
      if (existing.status === "TERMINATED") throw new AppError("INVALID_STATE", "Terminated cards cannot be frozen", 409);
      if (existing.status === "FROZEN") {
        return { result: existing, oldValue: { status: existing.status }, newValue: { status: existing.status } };
      }
      await syncIssuerCardStatus(existing, "freeze");
      const claim = await tx.card.updateMany({ where: { id: cardId, organizationId: ctx.organizationId, status: existing.status }, data: { status: "FROZEN" } });
      if (claim.count !== 1) throw new AppError("CARD_CONFLICT", "Card changed; refresh and try again", 409);
      const card = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
      return { result: card, oldValue: { status: existing.status }, newValue: { status: card.status } };
    });
  },

  async unfreeze(ctx: RequestContext, cardId: string) {
    return auditedCommand(ctx, { action: "card.unfreeze", objectType: "Card", objectId: cardId, event: "card.unfrozen" }, async (tx) => {
      const existing = await tx.card.findFirst({ where: { id: cardId, organizationId: ctx.organizationId } });
      if (!existing) throw new AppError("NOT_FOUND", "Card not found", 404);
      assertEntityPermission(ctx, "card.freeze", existing.legalEntityId);
      if (existing.status === "TERMINATED") throw new AppError("INVALID_STATE", "Terminated cards cannot be unfrozen", 409);
      if (existing.status === "ACTIVE") {
        return { result: existing, oldValue: { status: existing.status }, newValue: { status: existing.status } };
      }
      if (existing.status !== "FROZEN") throw new AppError("INVALID_STATE", "Only frozen cards can be unfrozen", 409);
      await syncIssuerCardStatus(existing, "unfreeze");
      const claim = await tx.card.updateMany({ where: { id: cardId, organizationId: ctx.organizationId, status: "FROZEN" }, data: { status: "ACTIVE" } });
      if (claim.count !== 1) throw new AppError("CARD_CONFLICT", "Card changed; refresh and try again", 409);
      const card = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
      return { result: card, oldValue: { status: "FROZEN" }, newValue: { status: "ACTIVE" } };
    });
  },

  async terminate(ctx: RequestContext, cardId: string) {
    return auditedCommand(ctx, { action: "card.terminate", objectType: "Card", objectId: cardId, event: "card.terminated" }, async (tx) => {
      const existing = await tx.card.findFirst({ where: { id: cardId, organizationId: ctx.organizationId } });
      if (!existing) throw new AppError("NOT_FOUND", "Card not found", 404);
      assertEntityPermission(ctx, "card.freeze", existing.legalEntityId);
      if (existing.status === "TERMINATED") {
        return { result: existing, oldValue: { status: existing.status }, newValue: { status: existing.status } };
      }
      await syncIssuerCardStatus(existing, "cancel");
      const claim = await tx.card.updateMany({
        where: { id: cardId, organizationId: ctx.organizationId, status: { in: ["ACTIVE", "FROZEN", "INACTIVE"] } },
        data: { status: "TERMINATED" },
      });
      if (claim.count !== 1) throw new AppError("CARD_CONFLICT", "Card changed; refresh and try again", 409);
      const card = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
      return { result: card, oldValue: { status: existing.status }, newValue: { status: "TERMINATED" } };
    });
  },

  async setControls(ctx: RequestContext, cardId: string, body: {
    merchantLock?: string | null;
    allowedMccs?: string | null;
    blockedMccs?: string | null;
    allowedCountries?: string | null;
    blockedCountries?: string | null;
    perTransactionLimit?: string | null;
    dailyLimit?: string | null;
    weeklyLimit?: string | null;
    monthlyLimit?: string | null;
    velocityMaxAmount?: string | null;
    velocityMaxCount?: number | null;
    velocityWindowHours?: number;
  }) {
    return auditedCommand(ctx, { action: "card.set_controls", objectType: "Card", objectId: cardId, event: "card.controls_updated" }, async (tx) => {
      const existing = await tx.card.findFirst({ where: { id: cardId, organizationId: ctx.organizationId } });
      if (!existing) throw new AppError("NOT_FOUND", "Card not found", 404);
      assertEntityPermission(ctx, "card.issue", existing.legalEntityId);
      const moneyOrNull = (value: string | null | undefined) => {
        if (value === undefined) return undefined;
        if (value === null || value === "") return null;
        return dec(requireMoney(value, "USD").amount);
      };
      const perTxn = moneyOrNull(body.perTransactionLimit);
      const velocityAmt = moneyOrNull(body.velocityMaxAmount);
      const daily = moneyOrNull(body.dailyLimit);
      const weekly = moneyOrNull(body.weeklyLimit);
      const monthly = moneyOrNull(body.monthlyLimit);
      if (body.velocityMaxCount != null && (body.velocityMaxCount < 1 || body.velocityMaxCount > 10_000)) {
        throw new AppError("INVALID_VELOCITY", "velocityMaxCount must be between 1 and 10000", 400);
      }
      if (body.velocityWindowHours != null && (body.velocityWindowHours < 1 || body.velocityWindowHours > 720)) {
        throw new AppError("INVALID_VELOCITY", "velocityWindowHours must be between 1 and 720", 400);
      }

      const providerCardId = providerCardIdOf(existing);
      const issuer = getCardIssuer();
      if (providerCardId && issuer.updateSpendingControls) {
        const spendingLimits: Array<{ amount: number; interval: "per_authorization" | "daily" | "weekly" | "monthly" }> = [];
        const nextPerTxn = perTxn === undefined ? existing.perTransactionLimit : perTxn;
        const nextDaily = daily === undefined ? existing.dailyLimit : daily;
        const nextWeekly = weekly === undefined ? existing.weeklyLimit : weekly;
        const nextMonthly = monthly === undefined ? existing.monthlyLimit : monthly;
        if (nextPerTxn) spendingLimits.push({ amount: Math.round(Number(nextPerTxn) * 100), interval: "per_authorization" });
        if (nextDaily) spendingLimits.push({ amount: Math.round(Number(nextDaily) * 100), interval: "daily" });
        if (nextWeekly) spendingLimits.push({ amount: Math.round(Number(nextWeekly) * 100), interval: "weekly" });
        if (nextMonthly) spendingLimits.push({ amount: Math.round(Number(nextMonthly) * 100), interval: "monthly" });
        const nextAllowed = body.allowedMccs === undefined ? existing.allowedMccs : body.allowedMccs;
        const nextBlocked = body.blockedMccs === undefined ? existing.blockedMccs : body.blockedMccs;
        const nextAllowedCountries = body.allowedCountries === undefined ? existing.allowedCountries : body.allowedCountries;
        const nextBlockedCountries = body.blockedCountries === undefined ? existing.blockedCountries : body.blockedCountries;
        try {
          await issuer.updateSpendingControls(providerCardId, {
            spendingLimits,
            allowedCategories: nextAllowed ? nextAllowed.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
            blockedCategories: nextBlocked ? nextBlocked.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
            allowedMerchantCountries: nextAllowedCountries ? nextAllowedCountries.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
            blockedMerchantCountries: nextBlockedCountries ? nextBlockedCountries.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
          });
        } catch (error) {
          mapIssuerError(error);
        }
      }

      const card = await tx.card.update({
        where: { id: cardId },
        data: {
          ...(body.merchantLock !== undefined ? { merchantLock: body.merchantLock?.trim() || null } : {}),
          ...(body.allowedMccs !== undefined ? { allowedMccs: body.allowedMccs?.trim() || null } : {}),
          ...(body.blockedMccs !== undefined ? { blockedMccs: body.blockedMccs?.trim() || null } : {}),
          ...(body.allowedCountries !== undefined ? { allowedCountries: body.allowedCountries?.trim() || null } : {}),
          ...(body.blockedCountries !== undefined ? { blockedCountries: body.blockedCountries?.trim() || null } : {}),
          ...(perTxn !== undefined ? { perTransactionLimit: perTxn } : {}),
          ...(daily !== undefined ? { dailyLimit: daily } : {}),
          ...(weekly !== undefined ? { weeklyLimit: weekly } : {}),
          ...(monthly !== undefined ? { monthlyLimit: monthly } : {}),
          ...(velocityAmt !== undefined ? { velocityMaxAmount: velocityAmt } : {}),
          ...(body.velocityMaxCount !== undefined ? { velocityMaxCount: body.velocityMaxCount } : {}),
          ...(body.velocityWindowHours !== undefined ? { velocityWindowHours: body.velocityWindowHours } : {}),
        },
      });
      return {
        result: card,
        oldValue: {
          merchantLock: existing.merchantLock,
          allowedMccs: existing.allowedMccs,
          blockedMccs: existing.blockedMccs,
          allowedCountries: existing.allowedCountries,
          blockedCountries: existing.blockedCountries,
          perTransactionLimit: existing.perTransactionLimit ? String(existing.perTransactionLimit) : null,
          dailyLimit: existing.dailyLimit ? String(existing.dailyLimit) : null,
          weeklyLimit: existing.weeklyLimit ? String(existing.weeklyLimit) : null,
          monthlyLimit: existing.monthlyLimit ? String(existing.monthlyLimit) : null,
          velocityMaxAmount: existing.velocityMaxAmount ? String(existing.velocityMaxAmount) : null,
          velocityMaxCount: existing.velocityMaxCount,
          velocityWindowHours: existing.velocityWindowHours,
        },
        newValue: {
          merchantLock: card.merchantLock,
          allowedMccs: card.allowedMccs,
          blockedMccs: card.blockedMccs,
          allowedCountries: card.allowedCountries,
          blockedCountries: card.blockedCountries,
          perTransactionLimit: card.perTransactionLimit ? String(card.perTransactionLimit) : null,
          dailyLimit: card.dailyLimit ? String(card.dailyLimit) : null,
          weeklyLimit: card.weeklyLimit ? String(card.weeklyLimit) : null,
          monthlyLimit: card.monthlyLimit ? String(card.monthlyLimit) : null,
          velocityMaxAmount: card.velocityMaxAmount ? String(card.velocityMaxAmount) : null,
          velocityMaxCount: card.velocityMaxCount,
          velocityWindowHours: card.velocityWindowHours,
        },
      };
    });
  },

  async getDetail(ctx: RequestContext, cardId: string) {
    const scope = await scopedWhere(ctx, "cards");
    const card = await prisma.card.findFirst({ where: { ...scope, id: cardId } });
    if (!card) throw new AppError("NOT_FOUND", "Card not found", 404);
    const [fund, holder, authIds, transactions] = await Promise.all([
      prisma.fund.findFirst({ where: { id: card.fundId, organizationId: ctx.organizationId } }),
      prisma.user.findFirst({
        where: { id: card.holderId, organizationId: ctx.organizationId },
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
      }),
      prisma.cardAuthorization.findMany({ where: { cardId: card.id, organizationId: ctx.organizationId }, select: { id: true } }),
      prisma.txn.findMany({
        where: { organizationId: ctx.organizationId, cardId: card.id },
        orderBy: { authorizedAt: "desc" },
        take: 50,
      }),
    ]);
    const authorizations = await prisma.cardAuthorization.findMany({
      where: { organizationId: ctx.organizationId, cardId: card.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const audit = await prisma.auditEvent.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { objectType: "Card", objectId: card.id },
          ...(authIds.length ? [{ objectType: "CardAuthorization", objectId: { in: authIds.map((row) => row.id) } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    let spendRequest = null;
    if (fund?.spendRequestId) {
      spendRequest = await prisma.spendRequest.findFirst({
        where: { id: fund.spendRequestId, organizationId: ctx.organizationId },
      });
    }
    const pending = transactions.filter((row) => row.status === "PENDING").reduce((sum, row) => sum + Number(row.amount), 0);
    const cleared = transactions.filter((row) => row.status === "CLEARED").reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      card,
      fund,
      holder,
      spendRequest,
      controls: {
        merchantLock: card.merchantLock,
        allowedMccs: card.allowedMccs,
        blockedMccs: card.blockedMccs,
        allowedCountries: card.allowedCountries,
        blockedCountries: card.blockedCountries,
        perTransactionLimit: card.perTransactionLimit ? String(card.perTransactionLimit) : null,
        dailyLimit: card.dailyLimit ? String(card.dailyLimit) : null,
        weeklyLimit: card.weeklyLimit ? String(card.weeklyLimit) : null,
        monthlyLimit: card.monthlyLimit ? String(card.monthlyLimit) : null,
        velocityMaxAmount: card.velocityMaxAmount ? String(card.velocityMaxAmount) : null,
        velocityMaxCount: card.velocityMaxCount,
        velocityWindowHours: card.velocityWindowHours,
      },
      issuer: {
        provider: card.provider,
        sandboxAuthorizeEnabled: env.nodeEnv !== "production",
        sandboxMode: isStripeCardIssuer() ? "stripe_test_helpers" : "mock",
      },
      totals: {
        currency: fund?.currency ?? "USD",
        available: fund ? String(fund.availableAmount) : "0",
        pending: pending.toFixed(2),
        cleared: cleared.toFixed(2),
      },
      authorizations,
      transactions,
      audit,
    };
  },

  async getFundDetail(ctx: RequestContext, fundId: string) {
    const scope = await scopedWhere(ctx, "funds");
    const fund = await prisma.fund.findFirst({ where: { ...scope, id: fundId } });
    if (!fund) throw new AppError("NOT_FOUND", "Fund not found", 404);
    const [owner, spendRequest, transactions, authorizations] = await Promise.all([
      prisma.user.findFirst({
        where: { id: fund.ownerId, organizationId: ctx.organizationId },
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
      }),
      fund.spendRequestId
        ? prisma.spendRequest.findFirst({ where: { id: fund.spendRequestId, organizationId: ctx.organizationId } })
        : Promise.resolve(null),
      prisma.txn.findMany({
        where: { organizationId: ctx.organizationId, fundId: fund.id },
        orderBy: { authorizedAt: "desc" },
        take: 50,
      }),
      prisma.cardAuthorization.findMany({
        where: { organizationId: ctx.organizationId, fundId: fund.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    // One-card-per-holder: later approvals top up the live card’s wallet fund, so this
    // request fund may no longer own the card row — fall back to the holder’s live card.
    let card = await prisma.card.findFirst({ where: { organizationId: ctx.organizationId, fundId: fund.id } });
    let cardLink: "FUND" | "HOLDER" | null = card ? "FUND" : null;
    if (!card) {
      card = await findHolderLiveCard(prisma, ctx.organizationId, fund.ownerId);
      if (card) cardLink = "HOLDER";
    }
    const pending = transactions.filter((row) => row.status === "PENDING").reduce((sum, row) => sum + Number(row.amount), 0);
    const cleared = transactions.filter((row) => row.status === "CLEARED").reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      fund,
      owner,
      card,
      cardLink,
      spendRequest,
      totals: {
        currency: fund.currency,
        available: String(fund.availableAmount),
        limit: String(fund.limitAmount),
        pending: pending.toFixed(2),
        cleared: cleared.toFixed(2),
      },
      transactions,
      authorizations,
    };
  },

  async getTransactionDetail(ctx: RequestContext, transactionId: string) {
    const scope = await scopedWhere(ctx, "transactions");
    const txn = await prisma.txn.findFirst({ where: { ...scope, id: transactionId } });
    if (!txn) throw new AppError("NOT_FOUND", "Transaction not found", 404);

    const [card, fund, expense, authorization, vendor, audit] = await Promise.all([
      txn.cardId
        ? prisma.card.findFirst({
            where: { id: txn.cardId, organizationId: ctx.organizationId },
            select: {
              id: true,
              last4: true,
              status: true,
              type: true,
              network: true,
              holderId: true,
              fundId: true,
              merchantLock: true,
            },
          })
        : Promise.resolve(null),
      txn.fundId
        ? prisma.fund.findFirst({
            where: { id: txn.fundId, organizationId: ctx.organizationId },
            select: {
              id: true,
              name: true,
              status: true,
              availableAmount: true,
              limitAmount: true,
              currency: true,
              ownerId: true,
            },
          })
        : Promise.resolve(null),
      prisma.expense.findFirst({
        where: { organizationId: ctx.organizationId, transactionId: txn.id },
        select: {
          id: true,
          merchant: true,
          amount: true,
          currency: true,
          status: true,
          policyResult: true,
          userId: true,
          receiptId: true,
        },
      }),
      txn.authorizationId
        ? prisma.cardAuthorization.findFirst({
            where: { id: txn.authorizationId, organizationId: ctx.organizationId },
            select: {
              id: true,
              decision: true,
              reason: true,
              amount: true,
              currency: true,
              merchant: true,
              createdAt: true,
            },
          })
        : Promise.resolve(null),
      txn.vendorId
        ? prisma.vendor.findFirst({
            where: { id: txn.vendorId, organizationId: ctx.organizationId },
            select: { id: true, name: true, status: true },
          })
        : Promise.resolve(null),
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, objectType: "Transaction", objectId: txn.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const holder = card
      ? await prisma.user.findFirst({
          where: { id: card.holderId, organizationId: ctx.organizationId },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : null;

    return {
      transaction: txn,
      card,
      holder,
      fund,
      expense,
      authorization,
      vendor,
      audit,
    };
  },
};

async function resolveBudgetForFund(
  tx: Prisma.TransactionClient,
  organizationId: string,
  legalEntityId: string,
  fundId: string | null | undefined,
) {
  if (!fundId) return null;
  const fund = await tx.fund.findFirst({ where: { id: fundId, organizationId } });
  if (!fund?.spendRequestId) return null;
  const request = await tx.spendRequest.findFirst({ where: { id: fund.spendRequestId, organizationId } });
  if (!request) return null;
  const program = await tx.spendProgram.findFirst({ where: { id: request.programId, organizationId } });
  if (!program?.budgetId) return null;
  return tx.budget.findFirst({
    where: { id: program.budgetId, organizationId, legalEntityId },
  });
}

async function applyBudgetCapture(
  tx: Prisma.TransactionClient,
  organizationId: string,
  legalEntityId: string,
  fundId: string | null | undefined,
  amount: Prisma.Decimal,
) {
  const budget = await resolveBudgetForFund(tx, organizationId, legalEntityId, fundId);
  // No linked program budget → do not spill actuals onto every entity budget.
  if (!budget) return;
  const committedRelease = Prisma.Decimal.min(budget.committedAmount, amount);
  await tx.budget.update({
    where: { id: budget.id },
    data: {
      actualAmount: { increment: amount },
      committedAmount: { decrement: committedRelease },
      freshness: new Date(),
    },
  });
}

async function applyBudgetReverse(
  tx: Prisma.TransactionClient,
  organizationId: string,
  legalEntityId: string,
  fundId: string | null | undefined,
  amount: Prisma.Decimal,
) {
  const budget = await resolveBudgetForFund(tx, organizationId, legalEntityId, fundId);
  if (!budget) return;
  const actualRelease = Prisma.Decimal.min(budget.actualAmount, amount);
  await tx.budget.update({
    where: { id: budget.id },
    data: {
      actualAmount: { decrement: actualRelease },
      committedAmount: { increment: actualRelease },
      freshness: new Date(),
    },
  });
}

export const expenses = {
  async submit(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!expense) throw new AppError("NOT_FOUND", "Expense not found", 404);
      if (!["INCOMPLETE", "REJECTED"].includes(expense.status)) throw new AppError("INVALID_STATE", "Expense cannot be submitted from this state", 409);
      assertEntityPermission(ctx, "expense.create", expense.legalEntityId);
      if (expense.userId !== ctx.userId && !ctx.roles.includes("Owner") && !ctx.permissions.includes("*")) {
        throw new AppError("FORBIDDEN", "You can only submit your own expenses", 403);
      }
      const linkedReceipt = expense.receiptId
        ? await tx.receipt.findFirst({ where: { id: expense.receiptId, organizationId: ctx.organizationId } })
        : await tx.receipt.findFirst({ where: { organizationId: ctx.organizationId, expenseId: expense.id } });
      const hasReceipt = Boolean(linkedReceipt);
      const { rules } = await loadPolicyRules(
        (args) => tx.policy.findMany(args as never),
        ctx.organizationId,
        "expense",
      );
      const policy = evaluatePolicy({
        objectType: "expense",
        amount: n(expense.amount),
        hasReceipt,
        hasMemo: Boolean(expense.memo?.trim()),
        rules,
      });
      if (policy.result === "BLOCK") {
        throw new AppError("EXPENSE_POLICY_BLOCK", policy.explanation, 400);
      }
      if (!hasReceipt && policy.matchedRules.includes("receipt_required")) {
        throw new AppError("RECEIPT_REQUIRED", "Attach a receipt before submitting this expense", 400);
      }
      if (!expense.memo?.trim() && policy.matchedRules.includes("memo_required")) {
        throw new AppError("MEMO_REQUIRED", "Add a business purpose before submitting this expense", 400);
      }
      const nextStatus = policy.result === "PASS" ? "SUBMITTED" : "IN_REVIEW";
      const claim = await tx.expense.updateMany({
        where: { id, organizationId: ctx.organizationId, status: expense.status },
        data: {
          status: nextStatus,
          policyResult: policy.result,
          ...(linkedReceipt && !expense.receiptId ? { receiptId: linkedReceipt.id } : {}),
        },
      });
      if (claim.count !== 1) throw new AppError("EXPENSE_CONFLICT", "Expense changed; refresh and try again", 409);
      if (linkedReceipt && linkedReceipt.expenseId !== id) {
        await tx.receipt.update({
          where: { id: linkedReceipt.id },
          data: { expenseId: id, transactionId: expense.transactionId, matchStatus: "MATCHED" },
        });
      }
      await startApproval({
        organizationId: ctx.organizationId,
        objectType: "expense",
        objectId: id,
        requesterId: expense.userId,
        title: expense.merchant || "Expense",
        amount: String(expense.amount),
        currency: expense.currency,
        legalEntityId: expense.legalEntityId,
        policySummary: `Policy ${policy.result}: ${policy.explanation}`,
      }, tx);
      await tx.aiRecommendation.create({
        data: {
          organizationId: ctx.organizationId,
          objectType: "expense",
          objectId: id,
          agent: "policy-agent",
          recommendation: policy.explanation,
          confidence: dec("0.82"),
          evidence: policy,
          humanReviewRequired: policy.result !== "PASS",
        },
      });
      const updated = await tx.expense.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "expense.submit",
        objectType: "Expense", objectId: id,
        oldValue: { status: expense.status }, newValue: { status: updated.status, policyResult: policy.result },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "expense.submitted", payload: { objectType: "Expense", objectId: id } } });
      return { expense: updated, policy };
    });
  },
  async approve(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!expense) throw new AppError("NOT_FOUND", "Expense not found", 404);
      assertEntityPermission(ctx, "expense.approve", expense.legalEntityId);
      const instance = await tx.approvalInstance.findFirst({
        where: { organizationId: ctx.organizationId, objectId: id, objectType: "expense", status: "IN_REVIEW" },
        orderBy: { createdAt: "desc" },
      });
      if (!instance) throw new AppError("NOT_FOUND", "Approval was not started", 404);
      const decision = await actOnApproval({ instanceId: instance.id, actorId: ctx.userId, action: "approve" }, tx);
      if (decision.status !== "APPROVED") return { expense, approval: decision };
      const claim = await tx.expense.updateMany({ where: { id, organizationId: ctx.organizationId, status: { in: ["SUBMITTED", "IN_REVIEW"] } }, data: { status: "APPROVED" } });
      if (claim.count !== 1) throw new AppError("EXPENSE_CONFLICT", "Expense changed; refresh and try again", 409);
      if (expense.transactionId) {
        await queueAccounting(ctx, "CARD_TRANSACTION", expense.transactionId, expense.legalEntityId, tx, {
          amount: expense.amount,
          currency: expense.currency,
          memo: expense.merchant,
        });
      } else {
        await queueAccounting(ctx, "EXPENSE", expense.id, expense.legalEntityId, tx, {
          amount: expense.amount,
          currency: expense.currency,
          memo: expense.merchant,
        });
      }
      const updated = await tx.expense.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "expense.approve",
        objectType: "Expense", objectId: id, oldValue: { status: expense.status }, newValue: { status: updated.status },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "expense.approved", payload: { objectType: "Expense", objectId: id } } });
      return updated;
    });
  },
  async updateMemo(ctx: RequestContext, id: string, body: { memo: string }) {
    return auditedCommand(ctx, { action: "expense.update_memo", objectType: "Expense", objectId: id, event: "expense.updated" }, async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!expense) throw new AppError("NOT_FOUND", "Expense not found", 404);
      assertEntityPermission(ctx, "expense.create", expense.legalEntityId);
      if (expense.userId !== ctx.userId && !ctx.roles.includes("Owner") && !ctx.permissions.includes("*")) {
        throw new AppError("FORBIDDEN", "You can only edit your own expenses", 403);
      }
      if (!["INCOMPLETE", "REJECTED"].includes(expense.status)) {
        throw new AppError("INVALID_STATE", "Only incomplete expenses can be edited", 409);
      }
      const memo = body.memo.trim();
      if (memo.length > 500) throw new AppError("INVALID_MEMO", "Memo must be 500 characters or fewer", 400);
      const updated = await tx.expense.update({ where: { id }, data: { memo } });
      return { result: updated, oldValue: { memo: expense.memo }, newValue: { memo: updated.memo } };
    });
  },
  async split(ctx: RequestContext, id: string, splits: Array<{ amount: string; category: string; department?: string }>) {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!expense) throw new AppError("NOT_FOUND", "Expense not found", 404);
      assertEntityPermission(ctx, "expense.create", expense.legalEntityId);
      if (expense.userId !== ctx.userId && !ctx.roles.includes("Owner") && !ctx.permissions.includes("*")) {
        throw new AppError("FORBIDDEN", "You can only split your own expenses", 403);
      }
      if (!["INCOMPLETE", "REJECTED", "SUBMITTED", "IN_REVIEW"].includes(expense.status)) {
        throw new AppError("INVALID_STATE", "Splits cannot be changed in this state", 409);
      }
      if (!splits.length) throw new AppError("INVALID_SPLITS", "At least one split is required", 400);
      const total = splits.reduce((sum, split) => sum.plus(dec(requireMoney(split.amount, expense.currency).amount)), dec(0));
      if (!total.equals(expense.amount)) {
        throw new AppError("SPLIT_IMBALANCE", "Splits must balance the expense amount exactly", 400);
      }
      await tx.expenseSplit.deleteMany({ where: { organizationId: ctx.organizationId, expenseId: id } });
      await tx.expenseSplit.createMany({
        data: splits.map((split) => ({
          organizationId: ctx.organizationId,
          expenseId: id,
          amount: dec(requireMoney(split.amount, expense.currency).amount),
          category: split.category.trim() || "UNCATEGORIZED",
          department: split.department?.trim() ?? "",
        })),
      });
      const rows = await tx.expenseSplit.findMany({ where: { organizationId: ctx.organizationId, expenseId: id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "expense.split",
        objectType: "Expense", objectId: id,
        newValue: { splits: rows.map((row) => ({ amount: String(row.amount), category: row.category, department: row.department })) },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "expense.split", payload: { objectType: "Expense", objectId: id } } });
      return rows;
    });
  },
  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "expenses");
    const expense = await prisma.expense.findFirst({ where: { ...scope, id } });
    if (!expense) throw new AppError("NOT_FOUND", "Expense not found", 404);
    const [receipt, splits, transaction, audit] = await Promise.all([
      expense.receiptId
        ? prisma.receipt.findFirst({ where: { id: expense.receiptId, organizationId: ctx.organizationId } })
        : prisma.receipt.findFirst({ where: { organizationId: ctx.organizationId, expenseId: expense.id } }),
      prisma.expenseSplit.findMany({ where: { organizationId: ctx.organizationId, expenseId: expense.id } }),
      expense.transactionId
        ? prisma.txn.findFirst({ where: { id: expense.transactionId, organizationId: ctx.organizationId } })
        : Promise.resolve(null),
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, objectType: "Expense", objectId: id },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
    ]);
    const file = receipt
      ? await prisma.attachment.findFirst({ where: { id: receipt.attachmentId, organizationId: ctx.organizationId } })
      : null;
    const requirements = evaluateExpenseRequirements({
      hasReceipt: Boolean(receipt || expense.receiptId),
      hasMemo: Boolean(expense.memo?.trim()),
      hasCategory: Boolean(expense.merchant?.trim()),
    });
    return { expense, receipt, attachment: file, splits, transaction, requirements, timeline: audit };
  },
};

export const receipts = {
  async getLinkCandidates(ctx: RequestContext, id: string, query = "") {
    const receipt = await prisma.receipt.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!receipt) throw new AppError("NOT_FOUND", "Receipt not found", 404);
    const expenses = await prisma.expense.findMany({ where: { organizationId: ctx.organizationId, ...(query ? { OR: [{ merchant: { contains: query, mode: "insensitive" } }, { memo: { contains: query, mode: "insensitive" } }, { id: { contains: query } }] } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
    const users = await prisma.user.findMany({ where: { organizationId: ctx.organizationId, id: { in: [...new Set(expenses.map((expense) => expense.userId))] } }, select: { id: true, firstName: true, lastName: true, email: true } });
    const candidates = expenses.map((expense) => {
      let score = 0; const reasons: string[] = [];
      if (receipt.merchantGuess && expense.merchant.toLowerCase().includes(receipt.merchantGuess.toLowerCase())) { score += 60; reasons.push("merchant"); }
      if (receipt.amountGuess && Math.abs(Number(receipt.amountGuess) - Number(expense.amount)) < 0.01) { score += 35; reasons.push("amount"); }
      if (expense.transactionId) { score += 5; reasons.push("transaction"); }
      return { ...expense, employee: users.find((user) => user.id === expense.userId), score, reasons };
    }).sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime());
    return { receipt, candidates };
  },
  async updateProgram(ctx: RequestContext, id: string, body: { name: string; description?: string; maxAmount: string; currency: string; merchantLockDefault?: string; allowedMccsDefault?: string; perTransactionLimitDefault?: string; velocityMaxAmountDefault?: string; velocityMaxCountDefault?: number }) {
    const amount = requireMoney(body.maxAmount, body.currency);
    return auditedCommand(ctx, { action: "spend_program.update", objectType: "SpendProgram", objectId: id, event: "spend_program.updated" }, async (tx) => {
      const program = await tx.spendProgram.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!program) throw new AppError("NOT_FOUND", "Spend program not found", 404);
      assertEntityPermission(ctx, "spend_program.manage", program.legalEntityId); requireCurrencyMatch(program.currency, amount.currency);
      const programRequests = await tx.spendRequest.findMany({ where: { organizationId: ctx.organizationId, programId: id }, select: { id: true } });
      const activeFund = await tx.fund.findFirst({ where: { organizationId: ctx.organizationId, status: "ACTIVE", spendRequestId: { in: programRequests.map((request) => request.id) }, limitAmount: { gt: amount.amount } } });
      if (activeFund) throw new AppError("ACTIVE_FINANCIAL_STATE", "Maximum cannot be reduced below an active issued fund", 409);
      const updated = await tx.spendProgram.update({ where: { id }, data: { name: body.name.trim(), description: (body.description ?? "").trim(), maxAmount: amount.amount, merchantLockDefault: body.merchantLockDefault || null, allowedMccsDefault: body.allowedMccsDefault || null, perTransactionLimitDefault: body.perTransactionLimitDefault ? dec(body.perTransactionLimitDefault) : null, velocityMaxAmountDefault: body.velocityMaxAmountDefault ? dec(body.velocityMaxAmountDefault) : null, velocityMaxCountDefault: body.velocityMaxCountDefault ?? null } });
      return { result: updated, oldValue: { name: program.name, maxAmount: program.maxAmount }, newValue: { name: updated.name, maxAmount: updated.maxAmount } };
    });
  },
  async createFromAttachment(ctx: RequestContext, body: {
    attachmentId: string;
    expenseId?: string;
    transactionId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.findFirst({
        where: { id: body.attachmentId, organizationId: ctx.organizationId },
      });
      if (!attachment) throw new AppError("NOT_FOUND", "Attachment not found", 404);
      if (attachment.classification !== "RECEIPT" && attachment.classification !== "attachment") {
        throw new AppError("INVALID_ATTACHMENT", "Only receipt attachments can create receipts", 400);
      }
      if (attachment.malwareStatus !== "CLEAN") {
        if (env.nodeEnv === "production") {
          throw new AppError("ATTACHMENT_QUARANTINED", "Attachment must be scanned clean before use", 409);
        }
        // Local sandbox: acknowledge clean so the receipt journey can be tested without a worker.
        await tx.attachment.update({ where: { id: attachment.id }, data: { malwareStatus: "CLEAN" } });
      }

      let expense = body.expenseId
        ? await tx.expense.findFirst({ where: { id: body.expenseId, organizationId: ctx.organizationId } })
        : null;
      if (body.expenseId && !expense) throw new AppError("NOT_FOUND", "Expense not found", 404);
      if (expense) {
        assertEntityPermission(ctx, "expense.create", expense.legalEntityId);
        if (expense.userId !== ctx.userId && !ctx.roles.includes("Owner") && !ctx.permissions.includes("*")) {
          throw new AppError("FORBIDDEN", "You can only attach receipts to your own expenses", 403);
        }
      }

      let transactionId = body.transactionId ?? expense?.transactionId ?? null;
      if (body.transactionId) {
        const txn = await tx.txn.findFirst({ where: { id: body.transactionId, organizationId: ctx.organizationId } });
        if (!txn) throw new AppError("NOT_FOUND", "Transaction not found", 404);
        transactionId = txn.id;
        if (!expense) {
          expense = await tx.expense.findFirst({ where: { organizationId: ctx.organizationId, transactionId: txn.id } });
        }
      }

      const existing = await tx.receipt.findFirst({
        where: { organizationId: ctx.organizationId, attachmentId: attachment.id },
      });
      if (existing) {
        if (expense && existing.expenseId && existing.expenseId !== expense.id) {
          throw new AppError("RECEIPT_LINKED", "This receipt is already linked to another expense", 409);
        }
        const updated = await tx.receipt.update({
          where: { id: existing.id },
          data: {
            expenseId: expense?.id ?? existing.expenseId,
            transactionId: transactionId ?? existing.transactionId,
            matchStatus: expense || transactionId ? "MATCHED" : existing.matchStatus,
          },
        });
        if (expense && expense.receiptId !== updated.id) {
          await tx.expense.update({ where: { id: expense.id }, data: { receiptId: updated.id } });
        }
        return updated;
      }

      const ocr = await ocrProvider.extract({
        attachmentId: attachment.id,
        mimeType: attachment.mimeType,
        originalName: attachment.originalName,
        checksum: attachment.checksum,
      });

      const receipt = await tx.receipt.create({
        data: {
          organizationId: ctx.organizationId,
          attachmentId: attachment.id,
          expenseId: expense?.id ?? null,
          transactionId,
          merchantGuess: ocr.merchantGuess,
          amountGuess: ocr.amountGuess,
          matchStatus: expense || transactionId ? "MATCHED" : "UNMATCHED",
          ocrStatus: "COMPLETED",
          ocrPayload: ocr as never,
        },
      });
      if (expense) {
        await tx.expense.update({ where: { id: expense.id }, data: { receiptId: receipt.id } });
      }
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "receipt.create",
        objectType: "Receipt", objectId: receipt.id,
        newValue: { attachmentId: attachment.id, expenseId: expense?.id ?? null, transactionId },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: {
        organizationId: ctx.organizationId, type: "receipt.created",
        payload: { objectType: "Receipt", objectId: receipt.id, expenseId: expense?.id ?? null },
      } });
      return receipt;
    });
  },

  async link(ctx: RequestContext, id: string, body: { expenseId?: string; transactionId?: string }) {
    return prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!receipt) throw new AppError("NOT_FOUND", "Receipt not found", 404);
      let expense = body.expenseId
        ? await tx.expense.findFirst({ where: { id: body.expenseId, organizationId: ctx.organizationId } })
        : null;
      if (body.expenseId && !expense) throw new AppError("NOT_FOUND", "Expense not found", 404);
      if (expense) {
        assertEntityPermission(ctx, "expense.create", expense.legalEntityId);
      }
      let transactionId = body.transactionId ?? expense?.transactionId ?? receipt.transactionId;
      if (body.transactionId) {
        const txn = await tx.txn.findFirst({ where: { id: body.transactionId, organizationId: ctx.organizationId } });
        if (!txn) throw new AppError("NOT_FOUND", "Transaction not found", 404);
        transactionId = txn.id;
        if (!expense) {
          expense = await tx.expense.findFirst({ where: { organizationId: ctx.organizationId, transactionId: txn.id } });
        }
      }
      if (!expense && !transactionId) throw new AppError("INVALID_LINK", "Provide an expenseId or transactionId", 400);
      const updated = await tx.receipt.update({
        where: { id },
        data: {
          expenseId: expense?.id ?? receipt.expenseId,
          transactionId,
          matchStatus: "MATCHED",
        },
      });
      if (expense) {
        await tx.expense.update({ where: { id: expense.id }, data: { receiptId: updated.id } });
      }
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "receipt.link",
        objectType: "Receipt", objectId: id,
        newValue: { expenseId: updated.expenseId, transactionId: updated.transactionId },
        correlationId: ctx.correlationId,
      } });
      return updated;
    });
  },
};

export const reimbursements = {
  async create(ctx: RequestContext, body: {
    legalEntityId: string;
    type: "STANDARD" | "MILEAGE" | "PER_DIEM";
    currency: string;
    memo: string;
    amount?: string;
    merchant?: string;
    category?: string;
    expenseDate?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    eligibleDays?: number;
    department?: string;
    project?: string;
    paymentDestination?: string;
    receiptId?: string;
    attachmentId?: string;
    distanceMiles?: string;
    mileageRate?: string;
    perDiemNights?: number;
    perDiemRate?: string;
  }) {
    if (!ctx.roles.includes("Owner") && !ctx.permissions.includes("*") && !ctx.permissions.includes("reimbursement.create")) {
      throw new AppError("FORBIDDEN", "Missing reimbursement.create", 403);
    }
    const allowCustomRate = false;
    let calc;
    try {
      calc = calculateReimbursement({
        type: body.type,
        currency: body.currency,
        amount: body.type === "STANDARD" ? body.amount : undefined,
        distanceMiles: body.distanceMiles,
        mileageRate: body.mileageRate,
        perDiemNights: body.perDiemNights,
        eligibleDays: body.eligibleDays,
        perDiemRate: body.perDiemRate,
        allowCustomRate,
        startDate: body.startDate,
        endDate: body.endDate,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_AMOUNT";
      throw new AppError(code, "Reimbursement amount could not be calculated", 400);
    }

    return prisma.$transaction(async (tx) => {
      const entity = await tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity) throw new AppError("INVALID_ENTITY", "Entity is unavailable", 400);
      requireCurrencyMatch(entity.currency, body.currency);

      let receiptId = body.receiptId ?? null;
      let receiptFingerprint = "";
      if (body.attachmentId) {
        const attachment = await tx.attachment.findFirst({
          where: { id: body.attachmentId, organizationId: ctx.organizationId },
        });
        if (!attachment) throw new AppError("NOT_FOUND", "Attachment not found", 404);
        if (attachment.malwareStatus !== "CLEAN" && env.nodeEnv !== "production") {
          await tx.attachment.update({ where: { id: attachment.id }, data: { malwareStatus: "CLEAN" } });
        }
        if ((await tx.attachment.findUniqueOrThrow({ where: { id: attachment.id } })).malwareStatus !== "CLEAN") {
          throw new AppError("ATTACHMENT_QUARANTINED", "Attachment must be scanned clean before use", 409);
        }
        receiptFingerprint = `${attachment.id}:${attachment.checksum ?? ""}`;
        let receipt = await tx.receipt.findFirst({ where: { organizationId: ctx.organizationId, attachmentId: attachment.id } });
        if (!receipt) {
          const ocr = await ocrProvider.extract({
            attachmentId: attachment.id,
            mimeType: attachment.mimeType,
            originalName: attachment.originalName,
            checksum: attachment.checksum,
          });
          receipt = await tx.receipt.create({
            data: {
              organizationId: ctx.organizationId,
              attachmentId: attachment.id,
              merchantGuess: ocr.merchantGuess,
              amountGuess: ocr.amountGuess,
              matchStatus: "UNMATCHED",
              ocrStatus: "COMPLETED",
              ocrPayload: ocr as never,
            },
          });
        }
        receiptId = receipt.id;
      } else if (receiptId) {
        const receipt = await tx.receipt.findFirst({ where: { id: receiptId, organizationId: ctx.organizationId } });
        if (!receipt) throw new AppError("NOT_FOUND", "Receipt not found", 404);
        const attachment = await tx.attachment.findFirst({ where: { id: receipt.attachmentId, organizationId: ctx.organizationId } });
        receiptFingerprint = attachment ? `${attachment.id}:${attachment.checksum ?? ""}` : "";
      }

      const { rules } = await loadPolicyRules(
        (args) => tx.policy.findMany(args as never),
        ctx.organizationId,
        "reimbursement",
      );
      const policy = evaluatePolicy({
        objectType: "reimbursement",
        amount: n(calc.amount),
        hasReceipt: Boolean(receiptId),
        hasMemo: Boolean(body.memo?.trim()),
        reimbursementType: body.type,
        rules: rules.length ? rules : [
          { type: "receipt_required", threshold: 75 },
          { type: "memo_required", threshold: 0 },
        ],
      });

      const requireReceipt = body.type === "STANDARD" && (
        policy.matchedRules.includes("receipt_required")
        || n(calc.amount) >= 75
      );
      const requirements = evaluateReimbursementRequirements({
        type: body.type,
        hasReceipt: Boolean(receiptId),
        hasMemo: Boolean(body.memo?.trim()),
        hasCategory: Boolean(body.category?.trim()) || body.type !== "STANDARD",
        hasDistance: calc.distanceMiles != null,
        hasPerDiemDays: (calc.eligibleDays ?? calc.perDiemNights) != null,
        hasDestination: Boolean(body.destination?.trim()) || body.type !== "PER_DIEM",
        requireReceipt,
        policyRequiredActions: policy.requiredActions,
      });

      const peers = await tx.reimbursement.findMany({
        where: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
        take: 200,
        orderBy: { createdAt: "desc" },
      });
      const duplicate = evaluateReimbursementDuplicate({
        userId: ctx.userId,
        type: body.type,
        amount: n(calc.amount),
        currency: body.currency,
        merchant: (body.merchant ?? "").trim(),
        expenseDate: body.expenseDate ?? null,
        receiptFingerprint,
        existing: peers.map((row) => ({
          id: row.id,
          userId: row.userId,
          type: row.type,
          amount: Number(row.amount),
          currency: row.currency,
          merchant: row.merchant,
          expenseDate: row.expenseDate,
          receiptFingerprint: row.receiptFingerprint,
          status: row.status,
        })),
      });

      const record = await tx.reimbursement.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: entity.id,
          userId: ctx.userId,
          type: body.type,
          amount: calc.amount,
          currency: body.currency,
          memo: body.memo.trim(),
          merchant: (body.merchant ?? "").trim(),
          category: (body.category ?? "").trim(),
          expenseDate: body.expenseDate ? new Date(body.expenseDate) : null,
          destination: (body.destination ?? "").trim(),
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          eligibleDays: calc.eligibleDays,
          department: (body.department ?? "").trim(),
          project: (body.project ?? "").trim(),
          paymentDestination: (body.paymentDestination ?? "").trim(),
          receiptId,
          receiptFingerprint,
          distanceMiles: calc.distanceMiles,
          mileageRate: calc.mileageRate,
          perDiemNights: calc.perDiemNights,
          perDiemRate: calc.perDiemRate,
          rateSource: calc.rateSource,
          rateVersion: calc.rateVersion,
          calcBreakdown: calc.breakdown as never,
          policyResult: policy.result,
          policyReason: policy.reason,
          policyMatchedRules: policy.matchedRules as never,
          policyRequiredActions: policy.requiredActions as never,
          policyVersion: 1,
          policyEvaluatedAt: new Date(),
          duplicateStatus: duplicate.decision,
          duplicateOfId: duplicate.matchedId ?? null,
          status: "DRAFT",
        },
      });
      if (receiptId) {
        await tx.receipt.update({
          where: { id: receiptId },
          data: { reimbursementId: record.id, matchStatus: "MATCHED" },
        });
      }
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "reimbursement.create",
          objectType: "Reimbursement", objectId: record.id,
          newValue: {
            type: record.type, amount: String(calc.amount), currency: body.currency,
            status: "DRAFT", calc: calc.breakdown, requirements, duplicate: duplicate.decision,
          },
          correlationId: ctx.correlationId,
        },
      });
      return { ...record, requirements, duplicate };
    });
  },

  async attachReceipt(ctx: RequestContext, id: string, body: { attachmentId: string }) {
    return prisma.$transaction(async (tx) => {
      if (!body.attachmentId?.trim()) throw new AppError("INVALID_ATTACHMENT", "attachmentId is required", 400);
      const record = await tx.reimbursement.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!record) throw new AppError("NOT_FOUND", "Reimbursement not found", 404);
      if (record.userId !== ctx.userId && !ctx.roles.includes("Owner") && !ctx.permissions.includes("*")) {
        throw new AppError("FORBIDDEN", "Only the employee (or an owner) can attach a receipt", 403);
      }
      if (!["DRAFT", "NEEDS_INFO"].includes(record.status)) {
        throw new AppError("INVALID_STATE", "Receipts can only be attached while the reimbursement is a draft", 409);
      }
      assertEntityPermission(ctx, "reimbursement.create", record.legalEntityId);

      const attachment = await tx.attachment.findFirst({
        where: { id: body.attachmentId, organizationId: ctx.organizationId },
      });
      if (!attachment) throw new AppError("NOT_FOUND", "Attachment not found", 404);
      if (attachment.malwareStatus !== "CLEAN" && env.nodeEnv !== "production") {
        await tx.attachment.update({ where: { id: attachment.id }, data: { malwareStatus: "CLEAN" } });
      }
      if ((await tx.attachment.findUniqueOrThrow({ where: { id: attachment.id } })).malwareStatus !== "CLEAN") {
        throw new AppError("ATTACHMENT_QUARANTINED", "Attachment must be scanned clean before use", 409);
      }

      let receipt = await tx.receipt.findFirst({ where: { organizationId: ctx.organizationId, attachmentId: attachment.id } });
      if (!receipt) {
        const ocr = await ocrProvider.extract({
          attachmentId: attachment.id,
          mimeType: attachment.mimeType,
          originalName: attachment.originalName,
          checksum: attachment.checksum,
        });
        receipt = await tx.receipt.create({
          data: {
            organizationId: ctx.organizationId,
            attachmentId: attachment.id,
            reimbursementId: id,
            merchantGuess: ocr.merchantGuess,
            amountGuess: ocr.amountGuess,
            matchStatus: "MATCHED",
            ocrStatus: "COMPLETED",
            ocrPayload: ocr as never,
          },
        });
      } else if (receipt.reimbursementId !== id) {
        receipt = await tx.receipt.update({
          where: { id: receipt.id },
          data: { reimbursementId: id, matchStatus: "MATCHED" },
        });
      }

      const updated = await tx.reimbursement.update({
        where: { id },
        data: { receiptId: receipt.id },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: "reimbursement.attach_receipt",
          objectType: "Reimbursement",
          objectId: id,
          oldValue: { receiptId: record.receiptId },
          newValue: { receiptId: receipt.id, attachmentId: attachment.id },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },

  async submit(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.reimbursement.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!record) throw new AppError("NOT_FOUND", "Reimbursement not found", 404);
      if (record.userId !== ctx.userId && !ctx.roles.includes("Owner") && !ctx.permissions.includes("*")) {
        throw new AppError("FORBIDDEN", "Only the employee (or an owner) can submit this reimbursement", 403);
      }
      if (!canSubmitReimbursement(record.status)) {
        throw new AppError("INVALID_STATE", "Only draft reimbursements can be submitted", 409);
      }
      if (record.duplicateStatus === "BLOCKED_DUPLICATE") {
        throw new AppError("DUPLICATE_BLOCKED", "This reimbursement looks like a duplicate and cannot be submitted", 409);
      }

      const { rules } = await loadPolicyRules(
        (args) => tx.policy.findMany(args as never),
        ctx.organizationId,
        "reimbursement",
      );
      const policy = evaluatePolicy({
        objectType: "reimbursement",
        amount: Number(record.amount),
        hasReceipt: Boolean(record.receiptId),
        hasMemo: Boolean(record.memo?.trim()),
        reimbursementType: record.type,
        rules: rules.length ? rules : [
          { type: "receipt_required", threshold: 75 },
          { type: "memo_required", threshold: 0 },
        ],
      });
      if (policy.result === "BLOCK") {
        throw new AppError("REIMBURSEMENT_POLICY_BLOCK", policy.explanation, 400);
      }

      const requireReceipt = record.type === "STANDARD" && (
        policy.matchedRules.includes("receipt_required")
        || Number(record.amount) >= 75
      );
      const requirements = evaluateReimbursementRequirements({
        type: record.type as "STANDARD" | "MILEAGE" | "PER_DIEM",
        hasReceipt: Boolean(record.receiptId),
        hasMemo: Boolean(record.memo?.trim()),
        hasCategory: Boolean(record.category?.trim()) || record.type !== "STANDARD",
        hasDistance: record.distanceMiles != null,
        hasPerDiemDays: (record.eligibleDays ?? record.perDiemNights) != null,
        hasDestination: Boolean(record.destination?.trim()) || record.type !== "PER_DIEM",
        requireReceipt,
        policyRequiredActions: policy.requiredActions,
      });
      if (!requirements.complete) {
        throw new AppError("REQUIREMENTS_INCOMPLETE", `Missing: ${requirements.missing.join(", ")}`, 400);
      }
      if (requireReceipt && !record.receiptId) {
        throw new AppError("RECEIPT_REQUIRED", "Attach a receipt before submitting this reimbursement", 400);
      }

      const workflow = await tx.approvalWorkflow.findFirst({ where: { organizationId: ctx.organizationId, objectType: "reimbursement" } });
      const claim = await tx.reimbursement.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["DRAFT", "NEEDS_INFO"] } },
        data: {
          status: "IN_REVIEW",
          policyResult: policy.result,
          policyReason: policy.reason,
          policyMatchedRules: policy.matchedRules as never,
          policyRequiredActions: policy.requiredActions as never,
          policyVersion: 1,
          policyEvaluatedAt: new Date(),
          approvalProgress: "0 of 1",
        },
      });
      if (claim.count !== 1) throw new AppError("REIMBURSEMENT_CONFLICT", "Reimbursement changed; refresh and try again", 409);

      await startApproval({
        organizationId: ctx.organizationId,
        workflowId: workflow?.id,
        objectType: "reimbursement",
        objectId: id,
        requesterId: record.userId,
        title: record.memo.trim() || `${record.type} reimbursement`,
        amount: String(record.amount),
        currency: record.currency,
        legalEntityId: record.legalEntityId,
        policySummary: `Policy ${policy.result}: ${policy.explanation}`,
      }, tx);

      const updated = await tx.reimbursement.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "reimbursement.submit",
          objectType: "Reimbursement", objectId: id,
          oldValue: { status: record.status },
          newValue: { status: "IN_REVIEW", policyResult: policy.result, requirements },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "reimbursement.submitted", payload: { reimbursementId: id } },
      });
      return updated;
    });
  },

  async approve(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.reimbursement.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!record) throw new AppError("NOT_FOUND", "Reimbursement not found", 404);
      if (!canApproveReimbursement(record.status)) throw new AppError("INVALID_STATE", "Reimbursement is no longer in review", 409);
      assertEntityPermission(ctx, "reimbursement.approve", record.legalEntityId);
      const instance = await tx.approvalInstance.findFirst({
        where: { organizationId: ctx.organizationId, objectType: "reimbursement", objectId: id, status: "IN_REVIEW" },
        orderBy: { createdAt: "desc" },
      });
      if (!instance) throw new AppError("NOT_FOUND", "Approval task not found", 404);
      const decision = await actOnApproval({ instanceId: instance.id, actorId: ctx.userId, action: "approve" }, tx);
      const steps = Array.isArray(instance.resolvedSteps) ? instance.resolvedSteps as unknown[] : [];
      const approveCount = await tx.approvalAction.count({ where: { instanceId: instance.id, action: "approve" } });
      if (decision.status !== "APPROVED") {
        await tx.reimbursement.update({
          where: { id },
          data: { approvalProgress: progressLabel(instance.currentStep, steps.length || 1, decision.status) },
        });
        return { reimbursement: record, approval: decision };
      }
      const claim = await tx.reimbursement.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["IN_REVIEW", "AWAITING_APPROVAL", "POLICY_REVIEW"] } },
        data: {
          status: "APPROVED",
          payoutStatus: "AWAITING_RELEASE",
          approvalProgress: `${approveCount} of ${steps.length || 1} approvals completed`,
        },
      });
      if (claim.count !== 1) throw new AppError("REIMBURSEMENT_CONFLICT", "Reimbursement changed; refresh and try again", 409);
      const updated = await tx.reimbursement.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "reimbursement.approve",
          objectType: "Reimbursement", objectId: id,
          oldValue: { status: record.status }, newValue: { status: updated.status, payoutStatus: "AWAITING_RELEASE" },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "reimbursement.approved", payload: { reimbursementId: id } },
      });
      return updated;
    });
  },

  async schedule(ctx: RequestContext, id: string, body: { rail?: string; idempotencyKey?: string } = {}) {
    const rail = (body.rail ?? "ACH").toUpperCase();
    const run = async (tx: Prisma.TransactionClient) => {
      const record = await tx.reimbursement.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!record) throw new AppError("NOT_FOUND", "Reimbursement not found", 404);
      assertEntityPermission(ctx, "reimbursement.pay", record.legalEntityId);
      if (record.status === "SCHEDULED" || record.status === "PAID" || record.status === "PROCESSING") {
        return record;
      }
      if (!canSchedulePayout(record.status)) {
        throw new AppError("INVALID_STATE", "Only approved reimbursements can be scheduled for payout", 409);
      }
      if (!["ACH", "WIRE", "CHECK"].includes(rail)) {
        throw new AppError("INVALID_RAIL", "Payout rail must be ACH, WIRE, or CHECK", 400);
      }
      const scheduled = payoutProvider.schedule({
        reimbursementId: record.id,
        amount: String(record.amount),
        currency: record.currency,
        rail,
      });
      const claim = await tx.reimbursement.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["APPROVED", "READY_FOR_PAYOUT", "FAILED"] } },
        data: {
          status: "SCHEDULED",
          payoutStatus: "SCHEDULED",
          payoutRail: rail,
          providerRef: scheduled.providerRef,
          releasedBy: ctx.userId,
          scheduledAt: new Date(),
          failureReason: "",
        },
      });
      if (claim.count !== 1) throw new AppError("REIMBURSEMENT_CONFLICT", "Reimbursement changed; refresh and try again", 409);
      const updated = await tx.reimbursement.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "reimbursement.schedule",
          objectType: "Reimbursement", objectId: id,
          oldValue: { status: record.status },
          newValue: { status: "SCHEDULED", providerRef: scheduled.providerRef, rail, sandbox: "SANDBOX / MOCK PAYOUT" },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId, type: "reimbursement.scheduled",
          payload: { reimbursementId: id, objectId: id, providerRef: scheduled.providerRef },
        },
      });
      return updated;
    };
    if (body.idempotencyKey) {
      return withIdempotency({
        organizationId: ctx.organizationId,
        operation: "reimbursement.schedule",
        key: body.idempotencyKey,
        requestHash: hashRequest({ reimbursementId: id, rail }),
      }, run);
    }
    return prisma.$transaction(run);
  },

  async confirmPayout(ctx: RequestContext, id: string) {
    if (env.nodeEnv === "production") {
      throw new AppError("PROVIDER_REQUIRED", "Payout confirmation must come from the payment provider", 403);
    }
    return prisma.$transaction(async (tx) => reimbursements.settleInTx(ctx, id, tx));
  },

  /** Shared settle used by sandbox confirm-payout and worker callback. Idempotent. */
  async settleInTx(ctx: RequestContext, id: string, tx: Prisma.TransactionClient) {
    const record = await tx.reimbursement.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!record) throw new AppError("NOT_FOUND", "Reimbursement not found", 404);
    assertEntityPermission(ctx, "reimbursement.pay", record.legalEntityId);
    if (record.status === "PAID") {
      const existing = await tx.accountingEntry.findFirst({
        where: { organizationId: ctx.organizationId, sourceType: "REIMBURSEMENT", sourceId: id },
      });
      return { reimbursement: record, accounting: existing };
    }
    if (record.status !== "SCHEDULED" && record.status !== "PROCESSING") {
      throw new AppError("INVALID_STATE", "Only scheduled reimbursements can be confirmed as paid", 409);
    }
    if (!record.providerRef) throw new AppError("MISSING_PROVIDER_REF", "Payout was not scheduled with a provider reference", 409);
    const confirmed = payoutProvider.confirm({ providerRef: record.providerRef });
    if (confirmed.status === "FAILED" || confirmed.status === "DECLINED") {
      await tx.reimbursement.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["SCHEDULED", "PROCESSING"] } },
        data: {
          status: "FAILED",
          payoutStatus: "FAILED",
          failureReason: confirmed.failureReason ?? "Payout provider declined",
        },
      });
      const failed = await tx.reimbursement.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "reimbursement.payout_failed",
          objectType: "Reimbursement", objectId: id,
          newValue: { status: "FAILED", failureReason: failed.failureReason },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "reimbursement.payout_failed", payload: { reimbursementId: id } },
      });
      return { reimbursement: failed, accounting: null };
    }
    if (confirmed.status !== "PAID") throw new AppError("PROVIDER_DECLINED", "Payout provider declined confirmation", 409);

    const claim = await tx.reimbursement.updateMany({
      where: { id, organizationId: ctx.organizationId, status: { in: ["SCHEDULED", "PROCESSING"] } },
      data: {
        status: "PAID",
        payoutStatus: "SETTLED",
        paidAt: new Date(),
        settlementRef: confirmed.settlementRef ?? `mock_settle_${record.providerRef}`,
        failureReason: "",
      },
    });
    if (claim.count !== 1) {
      const again = await tx.reimbursement.findUniqueOrThrow({ where: { id } });
      const existing = await tx.accountingEntry.findFirst({
        where: { organizationId: ctx.organizationId, sourceType: "REIMBURSEMENT", sourceId: id },
      });
      return { reimbursement: again, accounting: existing };
    }

    const accounting = await queueAccounting(ctx, "REIMBURSEMENT", id, record.legalEntityId, tx, {
      amount: record.amount,
      currency: record.currency,
      memo: record.memo,
    });
    const updated = await tx.reimbursement.findUniqueOrThrow({ where: { id } });
    await tx.auditEvent.create({
      data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "reimbursement.payout_confirm",
        objectType: "Reimbursement", objectId: id,
        oldValue: { status: record.status },
        newValue: { status: "PAID", accountingId: accounting.id, settlementRef: updated.settlementRef },
        correlationId: ctx.correlationId,
      },
    });
    await tx.outboxEvent.create({
      data: {
        organizationId: ctx.organizationId, type: "reimbursement.paid",
        payload: { reimbursementId: id, accountingId: accounting.id },
      },
    });
    return { reimbursement: updated, accounting };
  },

  async failPayout(ctx: RequestContext, id: string, body: { reason?: string } = {}) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.reimbursement.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!record) throw new AppError("NOT_FOUND", "Reimbursement not found", 404);
      assertEntityPermission(ctx, "reimbursement.pay", record.legalEntityId);
      if (!["SCHEDULED", "PROCESSING"].includes(record.status)) {
        throw new AppError("INVALID_STATE", "Only scheduled payouts can fail", 409);
      }
      await tx.reimbursement.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["SCHEDULED", "PROCESSING"] } },
        data: {
          status: "FAILED",
          payoutStatus: "FAILED",
          failureReason: (body.reason ?? "Payout failed").slice(0, 500),
        },
      });
      const updated = await tx.reimbursement.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "reimbursement.payout_failed",
          objectType: "Reimbursement", objectId: id,
          newValue: { status: "FAILED", failureReason: updated.failureReason },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },

  async markReturned(ctx: RequestContext, id: string, body: { reason?: string } = {}) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.reimbursement.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!record) throw new AppError("NOT_FOUND", "Reimbursement not found", 404);
      assertEntityPermission(ctx, "reimbursement.pay", record.legalEntityId);
      if (record.status !== "PAID") throw new AppError("INVALID_STATE", "Only paid reimbursements can be marked returned", 409);
      const updated = await tx.reimbursement.update({
        where: { id },
        data: {
          status: "RETURNED",
          payoutStatus: "RETURNED",
          returnedAt: new Date(),
          failureReason: (body.reason ?? "Funds returned").slice(0, 500),
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "reimbursement.returned",
          objectType: "Reimbursement", objectId: id,
          newValue: { status: "RETURNED", reason: updated.failureReason },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },

  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "reimbursements");
    const reimbursement = await prisma.reimbursement.findFirst({ where: { ...scope, id } });
    if (!reimbursement) throw new AppError("NOT_FOUND", "Reimbursement not found", 404);
    const receipt = reimbursement.receiptId
      ? await prisma.receipt.findFirst({ where: { id: reimbursement.receiptId, organizationId: ctx.organizationId } })
      : await prisma.receipt.findFirst({ where: { organizationId: ctx.organizationId, reimbursementId: id } });
    const attachment = receipt
      ? await prisma.attachment.findFirst({ where: { id: receipt.attachmentId, organizationId: ctx.organizationId } })
      : null;
    const accounting = await prisma.accountingEntry.findFirst({
      where: { organizationId: ctx.organizationId, sourceType: "REIMBURSEMENT", sourceId: id },
    });
    const [instance, actions, timeline, employee] = await Promise.all([
      prisma.approvalInstance.findFirst({
        where: { organizationId: ctx.organizationId, objectType: "reimbursement", objectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.approvalAction.findMany({
        where: {
          instanceId: {
            in: (await prisma.approvalInstance.findMany({
              where: { organizationId: ctx.organizationId, objectType: "reimbursement", objectId: id },
              select: { id: true },
            })).map((row) => row.id),
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, objectType: "Reimbursement", objectId: id },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.user.findFirst({
        where: { id: reimbursement.userId, organizationId: ctx.organizationId },
        select: { id: true, firstName: true, lastName: true, email: true, managerId: true },
      }),
    ]);
    const steps = Array.isArray(instance?.resolvedSteps) ? instance!.resolvedSteps as Array<{ type?: string; role?: string; name?: string; userId?: string }> : [];
    const approveCount = actions.filter((row) => row.action === "approve").length;
    const approvalProgress = steps.map((step, index) => ({
      label: (step.name ?? step.type ?? step.role ?? `Step ${index + 1}`).replace(/_/g, " "),
      status: instance?.status === "REJECTED" && index === instance.currentStep
        ? "Rejected"
        : index < approveCount || instance?.status === "APPROVED"
          ? "Approved"
          : index === (instance?.currentStep ?? 0)
            ? "Pending"
            : "Waiting",
    }));
    const currentStep = instance && instance.status === "IN_REVIEW"
      ? steps[instance.currentStep]
      : undefined;
    const canApproveStep = Boolean(
      currentStep
      && ctx.userId !== reimbursement.userId
      && eligibleForStep({
        step: currentStep,
        actorId: ctx.userId,
        actorRoles: ctx.roles,
        managerId: employee?.managerId ?? null,
        assigneeUserId: instance?.assigneeUserId,
      }),
    );
    const requireReceipt = reimbursement.type === "STANDARD" && (
      (Array.isArray(reimbursement.policyMatchedRules) && (reimbursement.policyMatchedRules as string[]).includes("receipt_required"))
      || Number(reimbursement.amount) >= 75
    );
    const requirements = evaluateReimbursementRequirements({
      type: reimbursement.type as "STANDARD" | "MILEAGE" | "PER_DIEM",
      hasReceipt: Boolean(reimbursement.receiptId),
      hasMemo: Boolean(reimbursement.memo?.trim()),
      hasCategory: Boolean(reimbursement.category?.trim()),
      hasDistance: reimbursement.distanceMiles != null,
      hasPerDiemDays: (reimbursement.eligibleDays ?? reimbursement.perDiemNights) != null,
      hasDestination: Boolean(reimbursement.destination?.trim()) || reimbursement.type !== "PER_DIEM",
      requireReceipt,
      policyRequiredActions: Array.isArray(reimbursement.policyRequiredActions)
        ? reimbursement.policyRequiredActions as string[]
        : [],
    });
    return {
      reimbursement,
      employee: employee
        ? {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
          }
        : null,
      receipt,
      attachment,
      accounting,
      approval: instance,
      approvalProgress,
      approvalLabel: instance ? progressLabel(instance.currentStep, steps.length || 1, instance.status) : reimbursement.approvalProgress,
      canApproveStep,
      requirements,
      policy: {
        result: reimbursement.policyResult,
        reason: reimbursement.policyReason,
        matchedRules: reimbursement.policyMatchedRules,
        requiredActions: reimbursement.policyRequiredActions,
        version: reimbursement.policyVersion,
        evaluatedAt: reimbursement.policyEvaluatedAt,
      },
      duplicate: { status: reimbursement.duplicateStatus, ofId: reimbursement.duplicateOfId },
      timeline,
      sandboxLabel: "SANDBOX / MOCK PAYOUT",
    };
  },
};

export const vendors = {
  async create(ctx: RequestContext, body: {
    name: string; legalName?: string; displayName?: string; category?: string; legalEntityId: string; taxId?: string; riskLevel?: string; notes?: string;
  }) {
    assertEntityPermission(ctx, "vendor.create", body.legalEntityId);
    const name = body.name.trim();
    if (name.length < 2) throw new AppError("INVALID_NAME", "Vendor name is required", 400);
    const riskLevel = (body.riskLevel ?? "LOW").toUpperCase();
    if (!["LOW", "MEDIUM", "HIGH"].includes(riskLevel)) {
      throw new AppError("INVALID_RISK", "Risk level must be LOW, MEDIUM, or HIGH", 400);
    }
    return prisma.$transaction(async (tx) => {
      const entity = await tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity) throw new AppError("INVALID_ENTITY", "Entity is unavailable", 400);
      const duplicate = await tx.vendor.findFirst({
        where: { organizationId: ctx.organizationId, name: { equals: name, mode: "insensitive" } },
      });
      if (duplicate) throw new AppError("DUPLICATE_VENDOR", "A vendor with this name already exists", 409);
      const legalName = (body.legalName ?? name).trim();
      const displayName = (body.displayName ?? name).trim();
      const vendor = await tx.vendor.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: entity.id,
          name,
          legalName,
          displayName,
          category: (body.category ?? "").trim(),
          ownerId: ctx.userId,
          taxId: body.taxId?.trim() || null,
          riskLevel,
          notes: (body.notes ?? "").trim(),
          status: "ACTIVE",
          paymentStatus: "NEEDS_BANK",
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "vendor.create",
          objectType: "Vendor", objectId: vendor.id,
          newValue: { name: vendor.name, legalName, displayName, riskLevel: vendor.riskLevel, legalEntityId: entity.id },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "vendor.created", payload: { vendorId: vendor.id } },
      });
      return vendor;
    });
  },

  async setBankAccount(ctx: RequestContext, vendorId: string, body: {
    last4: string; routingMasked: string; changeReason?: string;
    paymentMethod?: string; beneficiaryName?: string; currency?: string; country?: string;
  }) {
    const last4 = body.last4.replace(/\D/g, "").slice(-4);
    if (last4.length !== 4) throw new AppError("INVALID_ACCOUNT", "Bank account last4 must be 4 digits", 400);
    const routingMasked = body.routingMasked.trim();
    if (routingMasked.length < 4) throw new AppError("INVALID_ROUTING", "Routing mask is required", 400);
    return prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id: vendorId, organizationId: ctx.organizationId } });
      if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found", 404);
      if (vendor.legalEntityId) assertEntityPermission(ctx, "vendor.bank_details.manage", vendor.legalEntityId);
      else if (!ctx.permissions.includes("*") && !ctx.permissions.includes("vendor.bank_details.manage")) {
        throw new AppError("FORBIDDEN", "Missing vendor.bank_details.manage", 403);
      }
      await tx.vendorBankAccount.updateMany({
        where: { organizationId: ctx.organizationId, vendorId, isCurrent: true },
        data: { isCurrent: false, supersededAt: new Date(), status: "SUPERSEDED" },
      });
      const account = await tx.vendorBankAccount.create({
        data: {
          organizationId: ctx.organizationId,
          vendorId,
          paymentMethod: (body.paymentMethod ?? "ACH").trim() || "ACH",
          last4,
          routingMasked,
          beneficiaryName: (body.beneficiaryName ?? (vendor.legalName || vendor.name)).trim(),
          currency: (body.currency ?? "USD").toUpperCase(),
          country: (body.country ?? "US").toUpperCase(),
          status: "PENDING_VERIFICATION",
          changedBy: ctx.userId,
          changeReason: (body.changeReason ?? "").trim(),
          isCurrent: true,
        },
      });
      await tx.vendor.update({
        where: { id: vendorId },
        data: { paymentStatus: "BANK_PENDING" },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "vendor.bank_changed",
          objectType: "Vendor", objectId: vendorId,
          newValue: { bankAccountId: account.id, last4, routingMasked, status: account.status },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId, type: "vendor.bank_changed",
          payload: { vendorId, bankAccountId: account.id },
        },
      });
      return account;
    });
  },

  async verifyBankAccount(ctx: RequestContext, vendorId: string, bankAccountId: string) {
    return prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id: vendorId, organizationId: ctx.organizationId } });
      if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found", 404);
      if (vendor.legalEntityId) assertEntityPermission(ctx, "vendor.bank_details.manage", vendor.legalEntityId);
      else if (!ctx.permissions.includes("*") && !ctx.permissions.includes("vendor.bank_details.manage")) {
        throw new AppError("FORBIDDEN", "Missing vendor.bank_details.manage", 403);
      }
      const account = await tx.vendorBankAccount.findFirst({
        where: { id: bankAccountId, vendorId, organizationId: ctx.organizationId, isCurrent: true },
      });
      if (!account) throw new AppError("NOT_FOUND", "Bank account not found", 404);
      if (account.changedBy === ctx.userId && !ctx.permissions.includes("*")) {
        throw new AppError("SOD_VIOLATION", "Bank changer cannot verify the same payment details", 403);
      }
      if (account.status === "VERIFIED") return account;
      const updated = await tx.vendorBankAccount.update({
        where: { id: account.id },
        data: { status: "VERIFIED", verifiedBy: ctx.userId, verifiedAt: new Date() },
      });
      await tx.vendor.update({ where: { id: vendorId }, data: { paymentStatus: "PAYMENT_READY" } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "vendor.bank_verified",
          objectType: "Vendor", objectId: vendorId,
          newValue: { bankAccountId: account.id, status: "VERIFIED" },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "vendor.bank_verified", payload: { vendorId, bankAccountId: account.id } },
      });
      return updated;
    });
  },

  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "vendors");
    const vendor = await prisma.vendor.findFirst({ where: { ...scope, id } });
    if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found", 404);
    const [bankAccounts, bills, payments, owner, timeline, purchaseOrders] = await Promise.all([
      prisma.vendorBankAccount.findMany({
        where: { organizationId: ctx.organizationId, vendorId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.bill.findMany({
        where: { organizationId: ctx.organizationId, vendorId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.payment.findMany({
        where: { organizationId: ctx.organizationId, billId: { in: (await prisma.bill.findMany({
          where: { organizationId: ctx.organizationId, vendorId: id }, select: { id: true },
        })).map((b) => b.id) } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      vendor.ownerId
        ? prisma.user.findFirst({ where: { id: vendor.ownerId, organizationId: ctx.organizationId }, select: { id: true, firstName: true, lastName: true, email: true } })
        : null,
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, objectType: "Vendor", objectId: id },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.purchaseOrder.findMany({
        where: { organizationId: ctx.organizationId, vendorId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    const openBills = bills.filter((b) => ["APPROVED", "PARTIAL", "PENDING_APPROVAL", "DRAFT", "NEEDS_REVIEW"].includes(b.status));
    const spend = bills.reduce((sum, b) => sum + Number(b.amount), 0);
    const currentBank = bankAccounts.find((a) => a.isCurrent) ?? null;
    return {
      vendor: {
        ...vendor,
        legalName: vendor.legalName || vendor.name,
        displayName: vendor.displayName || vendor.name,
      },
      owner,
      bankAccounts,
      bills,
      payments,
      purchaseOrders,
      timeline,
      summary: {
        billCount: bills.length,
        openBillCount: openBills.length,
        lifetimeSpend: spend,
        currentBankLast4: currentBank?.last4 ?? null,
        paymentStatus: vendor.paymentStatus,
        riskLevel: vendor.riskLevel,
      },
      sandbox: env.nodeEnv !== "production",
    };
  },
};

export const bills = {
  async create(ctx: RequestContext, body: {
    vendorId?: string; vendorName?: string; legalEntityId: string; invoiceNumber: string; amount: string; currency: string;
    dueDate?: string; invoiceDate?: string; memo?: string; attachmentId?: string; purchaseOrderId?: string;
    taxAmount?: string; subtotal?: string; departmentId?: string; businessOwnerId?: string; paymentMethod?: string;
    draft?: boolean; allowPossibleDuplicate?: boolean;
    idempotencyKey?: string;
    lines?: Array<{ description: string; amount: string; quantity?: string; unitPrice?: string; taxAmount?: string; category?: string; glAccount?: string; department?: string; location?: string; project?: string }>;
  }) {
    const money = requireMoney(body.amount, body.currency);
    assertEntityPermission(ctx, "bill.create", body.legalEntityId);
    const run = async (tx: Prisma.TransactionClient) => {
      const entity = await tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity) throw new AppError("INVALID_REFERENCE", "Entity is unavailable", 400);
      requireCurrencyMatch(entity.currency, money.currency);

      const vendorsForMatch = await tx.vendor.findMany({
        where: { organizationId: ctx.organizationId, OR: [{ legalEntityId: entity.id }, { legalEntityId: null }] },
        take: 500,
      });
      const bankRows = await tx.vendorBankAccount.findMany({
        where: { organizationId: ctx.organizationId, vendorId: { in: vendorsForMatch.map((v) => v.id) }, isCurrent: true },
      });
      const match = matchVendor({
        extractedName: body.vendorName ?? vendorsForMatch.find((v) => v.id === body.vendorId)?.name,
        taxId: undefined,
        bankLast4: undefined,
        candidates: vendorsForMatch.map((v) => ({
          id: v.id,
          name: v.name,
          legalName: v.legalName,
          displayName: v.displayName,
          taxId: v.taxId,
          bankLast4: bankRows.find((b) => b.vendorId === v.id)?.last4 ?? null,
        })),
      });

      let vendorId = body.vendorId ?? match.vendorId;
      if (!vendorId) throw new AppError("VENDOR_REQUIRED", "Select or match a vendor before creating the bill", 400);
      const vendor = vendorsForMatch.find((v) => v.id === vendorId)
        ?? await tx.vendor.findFirst({ where: { id: vendorId, organizationId: ctx.organizationId } });
      if (!vendor || (vendor.legalEntityId && vendor.legalEntityId !== entity.id)) {
        throw new AppError("INVALID_REFERENCE", "Vendor or entity is unavailable", 400);
      }
      vendorId = vendor.id;
      // Explicit vendor selection is authoritative; intake-only matching uses decision.
      const vendorMatchStatus = body.vendorId ? "MATCHED" : match.decision;
      if (!body.vendorId && match.decision === "NO_MATCH") {
        throw new AppError("VENDOR_NO_MATCH", "Could not match vendor from invoice text", 400);
      }

      const invoiceNumber = body.invoiceNumber.trim();
      const existing = await tx.bill.findMany({
        where: { organizationId: ctx.organizationId, vendorId: vendor.id },
        select: { id: true, invoiceNumber: true, amount: true, currency: true, invoiceDate: true, status: true },
        take: 200,
      });
      const duplicate = evaluateBillDuplicate({
        invoiceNumber,
        amount: Number(money.amount),
        currency: money.currency,
        invoiceDate: body.invoiceDate ?? null,
        existing: existing.map((row) => ({
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          amount: Number(row.amount),
          currency: row.currency,
          invoiceDate: row.invoiceDate,
          status: row.status,
        })),
      });
      if (duplicate.decision === "DUPLICATE_BLOCKED") {
        throw new AppError("DUPLICATE_INVOICE", "This vendor invoice number already exists", 409, duplicate.evidence);
      }
      if (duplicate.decision === "POSSIBLE_DUPLICATE" && !body.allowPossibleDuplicate && !body.draft) {
        throw new AppError("POSSIBLE_DUPLICATE", "Possible duplicate invoice — review before submitting", 409, duplicate.evidence);
      }

      if (body.attachmentId) {
        const attachment = await tx.attachment.findFirst({
          where: { id: body.attachmentId, organizationId: ctx.organizationId },
        });
        if (!attachment) throw new AppError("ATTACHMENT_NOT_FOUND", "Invoice document not found", 404);
      }
      if (body.purchaseOrderId) {
        const po = await tx.purchaseOrder.findFirst({
          where: { id: body.purchaseOrderId, organizationId: ctx.organizationId, legalEntityId: entity.id },
        });
        if (!po) throw new AppError("PO_NOT_FOUND", "Purchase order not found", 404);
      }

      const lines = body.lines ?? [];
      if (lines.length) {
        const lineTotal = lines.reduce((sum, line) => sum + Number(requireMoney(line.amount, money.currency).amount), 0);
        if (Math.abs(lineTotal - Number(money.amount)) > 0.001) {
          throw new AppError("LINE_TOTAL_MISMATCH", "Bill line totals must equal the invoice amount", 400);
        }
      }

      const taxAmount = body.taxAmount != null ? requireMoney(body.taxAmount, money.currency).amount : "0";
      const subtotal = body.subtotal != null ? requireMoney(body.subtotal, money.currency).amount : money.amount;
      const asDraft = body.draft === true;
      const needsReview = duplicate.decision === "POSSIBLE_DUPLICATE" || vendorMatchStatus === "SUGGESTED";
      const status = asDraft ? "DRAFT" : needsReview ? "NEEDS_REVIEW" : "PENDING_APPROVAL";

      const bill = await tx.bill.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: body.legalEntityId,
          vendorId,
          invoiceNumber,
          invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
          amount: dec(money.amount),
          subtotal: dec(subtotal),
          taxAmount: dec(taxAmount),
          remainingAmount: dec(money.amount),
          currency: money.currency,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          memo: (body.memo ?? "").trim(),
          departmentId: body.departmentId ?? null,
          businessOwnerId: body.businessOwnerId ?? ctx.userId,
          attachmentId: body.attachmentId ?? null,
          purchaseOrderId: body.purchaseOrderId ?? null,
          paymentMethod: (body.paymentMethod ?? "ACH").trim() || "ACH",
          vendorMatchStatus,
          vendorMatchVendorId: vendorId,
          duplicateStatus: duplicate.decision,
          duplicateEvidence: duplicate.evidence as Prisma.InputJsonValue,
          codingSource: "MANUAL",
          status,
          createdBy: ctx.userId,
        },
      });
      if (lines.length) {
        await tx.billLine.createMany({
          data: lines.map((line) => ({
            organizationId: ctx.organizationId,
            billId: bill.id,
            description: line.description.trim() || "Line",
            amount: dec(requireMoney(line.amount, money.currency).amount),
            quantity: dec(line.quantity ?? "1"),
            unitPrice: dec(line.unitPrice ?? line.amount),
            taxAmount: dec(line.taxAmount ?? "0"),
            category: (line.category ?? "").trim(),
            glAccount: (line.glAccount ?? "").trim(),
            department: (line.department ?? "").trim(),
            location: (line.location ?? "").trim(),
            project: (line.project ?? "").trim(),
          })),
        });
      } else {
        await tx.billLine.create({
          data: {
            organizationId: ctx.organizationId,
            billId: bill.id,
            description: body.memo?.trim() || `Invoice ${invoiceNumber}`,
            amount: dec(money.amount),
            category: vendor.category || "",
          },
        });
      }
      if (status === "PENDING_APPROVAL") {
        await startApproval({
          organizationId: ctx.organizationId,
          objectType: "bill",
          objectId: bill.id,
          requesterId: ctx.userId,
          title: `Invoice ${bill.invoiceNumber}`,
          amount: money.amount,
          currency: money.currency,
          legalEntityId: body.legalEntityId,
        }, tx);
      }
      await queueAccounting(ctx, "BILL", bill.id, body.legalEntityId, tx, {
        amount: money.amount,
        currency: money.currency,
        memo: `Invoice ${invoiceNumber}`,
      });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "bill.create",
        objectType: "Bill", objectId: bill.id,
        newValue: {
          invoiceNumber: bill.invoiceNumber, amount: money.amount, currency: money.currency,
          status: bill.status, vendorMatchStatus, duplicateStatus: duplicate.decision,
          lineCount: lines.length || 1, attachmentId: body.attachmentId ?? null,
        },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "bill.created", payload: { objectType: "Bill", objectId: bill.id, vendorMatchStatus, duplicateStatus: duplicate.decision } } });
      return bill;
    };
    if (body.idempotencyKey) {
      return withIdempotency({
        organizationId: ctx.organizationId,
        operation: "bill.create",
        key: body.idempotencyKey,
        requestHash: hashRequest({
          vendorId: body.vendorId ?? null,
          legalEntityId: body.legalEntityId,
          invoiceNumber: body.invoiceNumber.trim(),
          amount: money.amount,
          currency: money.currency,
          draft: body.draft === true,
        }),
      }, run);
    }
    return prisma.$transaction(run);
  },

  async createFromDocument(ctx: RequestContext, body: {
    attachmentId: string; legalEntityId: string; vendorId?: string; draft?: boolean; allowPossibleDuplicate?: boolean;
  }) {
    assertEntityPermission(ctx, "bill.create", body.legalEntityId);
    const attachment = await prisma.attachment.findFirst({
      where: { id: body.attachmentId, organizationId: ctx.organizationId },
    });
    if (!attachment) throw new AppError("ATTACHMENT_NOT_FOUND", "Invoice document not found", 404);
    if (attachment.malwareStatus !== "CLEAN") {
      throw new AppError("DOCUMENT_NOT_READY", "Invoice must pass scan before intake", 409);
    }
    const payload = (attachment.ocrPayload && typeof attachment.ocrPayload === "object")
      ? attachment.ocrPayload as Record<string, unknown>
      : null;
    if (!payload || attachment.ocrStatus !== "COMPLETED") {
      throw new AppError("OCR_PENDING", "Sandbox OCR has not completed for this invoice", 409);
    }
    const confidence = Number(payload.confidence ?? 0);
    const vendorName = String(payload.vendorGuess ?? payload.merchantGuess ?? "");
    const invoiceNumber = String(payload.invoiceNumberGuess ?? `OCR-${attachment.id.slice(0, 8)}`);
    const amount = String(payload.amountGuess ?? "0");
    const currency = String(payload.currencyGuess ?? "USD");
    const lowConfidence = !Number.isFinite(confidence) || confidence < 0.85;
    return this.create(ctx, {
      vendorId: body.vendorId,
      vendorName,
      legalEntityId: body.legalEntityId,
      invoiceNumber,
      amount,
      currency,
      invoiceDate: payload.invoiceDateGuess ? String(payload.invoiceDateGuess) : undefined,
      dueDate: payload.dueDateGuess ? String(payload.dueDateGuess) : undefined,
      taxAmount: payload.taxGuess != null ? String(payload.taxGuess) : undefined,
      memo: `From invoice upload (SANDBOX OCR)`,
      attachmentId: attachment.id,
      draft: body.draft ?? lowConfidence,
      allowPossibleDuplicate: body.allowPossibleDuplicate,
    });
  },

  async approve(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!bill) throw new AppError("NOT_FOUND", "Bill not found", 404);
      if (bill.status !== "PENDING_APPROVAL") throw new AppError("INVALID_STATE", "Bill is not pending approval", 409);
      assertEntityPermission(ctx, "bill.approve", bill.legalEntityId);
      if (bill.createdBy === ctx.userId) {
        throw new AppError("SOD_VIOLATION", "Bill creator cannot be the sole approver", 403);
      }
      if (bill.duplicateStatus === "DUPLICATE_BLOCKED") {
        throw new AppError("DUPLICATE_INVOICE", "Blocked duplicate cannot be approved", 409);
      }
      const instance = await tx.approvalInstance.findFirst({ where: { organizationId: ctx.organizationId, objectType: "bill", objectId: id, status: "IN_REVIEW" }, orderBy: { createdAt: "desc" } });
      if (!instance) throw new AppError("NOT_FOUND", "Approval was not started", 404);
      const decision = await actOnApproval({ instanceId: instance.id, actorId: ctx.userId, action: "approve" }, tx);
      if (decision.status !== "APPROVED") return { bill, approval: decision };
      const claim = await tx.bill.updateMany({ where: { id, organizationId: ctx.organizationId, status: "PENDING_APPROVAL" }, data: { status: "APPROVED" } });
      if (claim.count !== 1) throw new AppError("BILL_CONFLICT", "Bill changed; refresh and try again", 409);
      const updated = await tx.bill.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "bill.approve",
        objectType: "Bill", objectId: id, oldValue: { status: bill.status }, newValue: { status: updated.status },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "bill.approved", payload: { objectType: "Bill", objectId: id } } });
      return updated;
    });
  },
  async submit(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!bill) throw new AppError("NOT_FOUND", "Bill not found", 404);
      if (!["DRAFT", "NEEDS_REVIEW"].includes(bill.status)) {
        throw new AppError("INVALID_STATE", "Only draft or needs-review bills can be submitted", 409);
      }
      assertEntityPermission(ctx, "bill.create", bill.legalEntityId);
      if (bill.duplicateStatus === "DUPLICATE_BLOCKED") {
        throw new AppError("DUPLICATE_INVOICE", "Blocked duplicate cannot be submitted", 409);
      }
      const claim = await tx.bill.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["DRAFT", "NEEDS_REVIEW"] } },
        data: { status: "PENDING_APPROVAL" },
      });
      if (claim.count !== 1) throw new AppError("BILL_CONFLICT", "Bill changed; refresh and try again", 409);
      await startApproval({
        organizationId: ctx.organizationId,
        objectType: "bill",
        objectId: id,
        requesterId: bill.createdBy,
        title: `Invoice ${bill.invoiceNumber}`,
        amount: String(bill.amount),
        currency: bill.currency,
        legalEntityId: bill.legalEntityId,
      }, tx);
      const updated = await tx.bill.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "bill.submit",
        objectType: "Bill", objectId: id, oldValue: { status: bill.status }, newValue: { status: updated.status },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "bill.submitted", payload: { objectType: "Bill", objectId: id } } });
      return updated;
    });
  },
  async updateCoding(ctx: RequestContext, id: string, body: {
    lines?: Array<{ id?: string; description: string; amount: string; category?: string; glAccount?: string; department?: string; location?: string; project?: string }>;
    codingSource?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!bill) throw new AppError("NOT_FOUND", "Bill not found", 404);
      assertEntityPermission(ctx, "bill.create", bill.legalEntityId);
      if (!["DRAFT", "NEEDS_REVIEW", "PENDING_APPROVAL"].includes(bill.status)) {
        throw new AppError("INVALID_STATE", "Coding can only change before payment", 409);
      }
      if (body.lines?.length) {
        await tx.billLine.deleteMany({ where: { organizationId: ctx.organizationId, billId: id } });
        await tx.billLine.createMany({
          data: body.lines.map((line) => ({
            organizationId: ctx.organizationId,
            billId: id,
            description: line.description.trim() || "Line",
            amount: dec(requireMoney(line.amount, bill.currency).amount),
            category: (line.category ?? "").trim(),
            glAccount: (line.glAccount ?? "").trim(),
            department: (line.department ?? "").trim(),
            location: (line.location ?? "").trim(),
            project: (line.project ?? "").trim(),
          })),
        });
      }
      const updated = await tx.bill.update({
        where: { id },
        data: { codingSource: (body.codingSource ?? "MANUAL").toUpperCase() },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "bill.coding_updated",
          objectType: "Bill", objectId: id, newValue: { codingSource: updated.codingSource, lineCount: body.lines?.length ?? null },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },
  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "bills");
    const bill = await prisma.bill.findFirst({ where: { ...scope, id } });
    if (!bill) throw new AppError("NOT_FOUND", "Bill not found", 404);
    const [vendor, lines, payments, attachment, accounting, instance, actions, timeline, entity] = await Promise.all([
      prisma.vendor.findFirst({ where: { id: bill.vendorId, organizationId: ctx.organizationId } }),
      prisma.billLine.findMany({ where: { organizationId: ctx.organizationId, billId: id } }),
      prisma.payment.findMany({ where: { organizationId: ctx.organizationId, billId: id }, orderBy: { createdAt: "desc" } }),
      bill.attachmentId
        ? prisma.attachment.findFirst({ where: { id: bill.attachmentId, organizationId: ctx.organizationId } })
        : Promise.resolve(null),
      prisma.accountingEntry.findFirst({
        where: { organizationId: ctx.organizationId, sourceType: "BILL", sourceId: id },
      }),
      prisma.approvalInstance.findFirst({ where: { organizationId: ctx.organizationId, objectType: "bill", objectId: id }, orderBy: { createdAt: "desc" } }),
      prisma.approvalAction.findMany({
        where: { instanceId: { in: (await prisma.approvalInstance.findMany({ where: { organizationId: ctx.organizationId, objectType: "bill", objectId: id }, select: { id: true } })).map((row) => row.id) } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, OR: [{ objectType: "Bill", objectId: id }, { objectId: id }] },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.legalEntity.findFirst({ where: { id: bill.legalEntityId, organizationId: ctx.organizationId } }),
    ]);
    const steps = Array.isArray(instance?.resolvedSteps) ? instance!.resolvedSteps as Array<{ type?: string; role?: string }> : [];
    const approveCount = actions.filter((row) => row.action === "approve").length;
    const approvalProgress = steps.map((step, index) => ({
      label: (step.type ?? step.role ?? `Step ${index + 1}`).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      status: instance?.status === "REJECTED" && index === instance.currentStep
        ? "Rejected"
        : index < approveCount || instance?.status === "APPROVED"
          ? "Approved"
          : index === (instance?.currentStep ?? 0)
            ? "Pending"
            : "Waiting",
    }));
    const bank = vendor
      ? await prisma.vendorBankAccount.findFirst({ where: { organizationId: ctx.organizationId, vendorId: vendor.id, isCurrent: true } })
      : null;
    return {
      bill,
      vendor: vendor
        ? { ...vendor, displayName: vendor.displayName || vendor.name, legalName: vendor.legalName || vendor.name }
        : null,
      entity,
      lines,
      payments,
      attachment,
      accounting,
      approval: instance,
      approvalProgress,
      approvalLabel: instance ? progressLabel(instance.currentStep, steps.length || 1, instance.status) : "",
      vendorPayment: bank
        ? { last4: bank.last4, status: bank.status, paymentMethod: bank.paymentMethod, currency: bank.currency }
        : null,
      duplicate: { status: bill.duplicateStatus, evidence: bill.duplicateEvidence },
      vendorMatch: { status: bill.vendorMatchStatus, vendorId: bill.vendorMatchVendorId },
      timeline,
      sandbox: env.nodeEnv !== "production",
      readyForPayment: bill.status === "APPROVED" || bill.status === "PARTIAL",
    };
  },
};

export const payments = {
  async schedule(ctx: RequestContext, body: { billId: string; amount: string; rail?: string; idempotencyKey: string; paymentRunId?: string }) {
    const amount = dec(body.amount);
    if (!amount.greaterThan(0)) throw new AppError("INVALID_AMOUNT", "Payment amount must be positive", 400);
    const scopedBill = await prisma.bill.findFirst({ where: { id: body.billId, organizationId: ctx.organizationId }, select: { legalEntityId: true } });
    if (!scopedBill) throw new AppError("NOT_FOUND", "Bill not found", 404);
    assertEntityPermission(ctx, "payment.create", scopedBill.legalEntityId);
    return withIdempotency({
      organizationId: ctx.organizationId, operation: "payment.schedule", key: body.idempotencyKey,
      requestHash: hashRequest({ actorId: ctx.userId, billId: body.billId, amount: amount.toFixed(2), rail: body.rail ?? "ACH", paymentRunId: body.paymentRunId ?? null }),
    }, async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id: body.billId, organizationId: ctx.organizationId } });
      if (!bill) throw new AppError("NOT_FOUND", "Bill not found", 404);
      assertEntityPermission(ctx, "payment.create", bill.legalEntityId);
      if (bill.status !== "APPROVED" && bill.status !== "PARTIAL") throw new AppError("BILL_NOT_APPROVED", "Bill must be approved before payment setup", 400);
      if (body.paymentRunId) {
        const run = await tx.paymentRun.findFirst({
          where: { id: body.paymentRunId, organizationId: ctx.organizationId, status: "OPEN", legalEntityId: bill.legalEntityId },
        });
        if (!run) throw new AppError("RUN_UNAVAILABLE", "Payment run is not open for this entity", 400);
      }
      const pending = await tx.payment.aggregate({ where: { organizationId: ctx.organizationId, billId: bill.id, status: { in: ["SCHEDULED", "PROCESSING"] } }, _sum: { amount: true } });
      const available = bill.remainingAmount.minus(pending._sum.amount ?? 0);
      if (available.lessThan(amount)) throw new AppError("PAYMENT_EXCEEDS_BALANCE", "Payment exceeds the uncommitted bill balance", 400);
      const entity = await tx.legalEntity.findFirst({ where: { id: bill.legalEntityId, organizationId: ctx.organizationId } });
      const capabilities = entity ? await tx.countryCapability.findFirst({ where: { organizationId: ctx.organizationId, country: entity.country } }) : null;
      const rail = body.rail ?? "ACH";
      if (!entity || !capabilities?.billPaySupported || !Array.isArray(capabilities.rails) || !capabilities.rails.includes(rail)) {
        throw new AppError("RAIL_UNAVAILABLE", "Payment method is unavailable for this entity", 400);
      }
      const payment = await tx.payment.create({ data: {
        organizationId: ctx.organizationId, legalEntityId: bill.legalEntityId, billId: bill.id,
        amount, currency: bill.currency, rail, status: "SCHEDULED", createdBy: ctx.userId,
        paymentRunId: body.paymentRunId ?? null,
      } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "payment.schedule", objectType: "Payment", objectId: payment.id, newValue: { billId: bill.id, amount: body.amount, rail, paymentRunId: body.paymentRunId ?? null }, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "payment.scheduled", payload: { paymentId: payment.id, objectId: payment.id } } });
      return payment;
    });
  },
  async release(ctx: RequestContext, id: string) {
    return withIdempotency({
      organizationId: ctx.organizationId,
      operation: "payment.release",
      key: `release-${id}`,
      requestHash: hashRequest({ paymentId: id }),
    }, async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
      assertEntityPermission(ctx, "payment.release", payment.legalEntityId);
      if (payment.status === "PROCESSING" || payment.status === "SENT") return payment;
      if (payment.status === "SETTLED" || payment.status === "COMPLETED") return payment;
      if (payment.status !== "SCHEDULED") throw new AppError("INVALID_STATE", "Payment is not scheduled", 409);
      if (payment.createdBy === ctx.userId) throw new AppError("SOD_VIOLATION", "Payment creator cannot release payment", 403);
      const accepted = paymentRail.release({
        paymentId: payment.id,
        amount: String(payment.amount),
        currency: payment.currency,
        rail: payment.rail,
      });
      if (accepted.status !== "ACCEPTED") throw new AppError("RAIL_REJECTED", "Payment rail rejected release", 409);
      const claim = await tx.payment.updateMany({
        where: { id, organizationId: ctx.organizationId, status: "SCHEDULED" },
        data: { status: "PROCESSING", releasedBy: ctx.userId, providerRef: accepted.providerRef },
      });
      if (claim.count !== 1) throw new AppError("PAYMENT_CONFLICT", "Payment changed; refresh and try again", 409);
      const updated = await tx.payment.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "payment.release",
        objectType: "Payment", objectId: id, oldValue: { status: payment.status },
        newValue: { status: updated.status, releasedBy: ctx.userId, providerRef: accepted.providerRef }, correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: {
        organizationId: ctx.organizationId, type: "payment.released",
        payload: { paymentId: id, objectType: "Payment", objectId: id, providerRef: accepted.providerRef },
      } });
      return updated;
    });
  },

  /** Sandbox-only settlement confirmation. Production must use provider callbacks / worker. */
  async confirmSettlement(ctx: RequestContext, id: string) {
    if (env.nodeEnv === "production") {
      throw new AppError("PROVIDER_REQUIRED", "Settlement must come from the payment rail provider", 403);
    }
    return settlePaymentRecord(ctx, id);
  },

  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "payments");
    const payment = await prisma.payment.findFirst({ where: { ...scope, id } });
    if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
    const [bill, accounting, timeline, releaser, creator] = await Promise.all([
      prisma.bill.findFirst({ where: { id: payment.billId, organizationId: ctx.organizationId } }),
      prisma.accountingEntry.findFirst({
        where: { organizationId: ctx.organizationId, sourceType: "PAYMENT", sourceId: id },
      }),
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, OR: [{ objectType: "Payment", objectId: id }, { objectId: id }] },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      payment.releasedBy
        ? prisma.user.findFirst({ where: { id: payment.releasedBy, organizationId: ctx.organizationId }, select: { id: true, firstName: true, lastName: true } })
        : null,
      prisma.user.findFirst({ where: { id: payment.createdBy, organizationId: ctx.organizationId }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const vendor = bill
      ? await prisma.vendor.findFirst({ where: { id: bill.vendorId, organizationId: ctx.organizationId } })
      : null;
    return {
      payment,
      bill,
      vendor: vendor ? { id: vendor.id, name: vendor.displayName || vendor.name, paymentStatus: vendor.paymentStatus } : null,
      accounting,
      creator,
      releaser,
      timeline,
      sandbox: env.nodeEnv !== "production",
      providerLabel: env.nodeEnv !== "production" ? "SANDBOX / MOCK PAYMENT" : "Payment rail",
    };
  },
};

async function settlePaymentRecord(ctx: RequestContext, paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, organizationId: ctx.organizationId } });
    if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
    assertEntityPermission(ctx, "payment.release", payment.legalEntityId);
    if (payment.status === "SETTLED" || payment.status === "COMPLETED") {
      const accounting = await tx.accountingEntry.findFirst({
        where: { organizationId: ctx.organizationId, sourceType: "PAYMENT", sourceId: paymentId },
      });
      return { payment, accounting, bill: await tx.bill.findUnique({ where: { id: payment.billId } }) };
    }
    if (payment.status !== "PROCESSING" && payment.status !== "SENT") {
      throw new AppError("INVALID_STATE", "Only processing/sent payments can settle", 409);
    }
    if (!payment.providerRef) throw new AppError("MISSING_PROVIDER_REF", "Payment was not released to a rail", 409);
    if (payment.settlementId) throw new AppError("ALREADY_SETTLED", "Payment already has a settlement id", 409);

    const settled = paymentRail.settle({ providerRef: payment.providerRef });
    if (settled.status !== "COMPLETED") {
      await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ["PROCESSING", "SENT"] } },
        data: { status: "FAILED", failureReason: settled.failureReason ?? "Rail declined settlement" },
      });
      throw new AppError("SETTLEMENT_FAILED", settled.failureReason ?? "Settlement failed", 409);
    }

    const bill = await tx.bill.findFirst({ where: { id: payment.billId, organizationId: ctx.organizationId } });
    if (!bill) throw new AppError("BILL_NOT_FOUND", "Bill missing for payment", 404);
    if (bill.remainingAmount.lessThan(payment.amount)) {
      throw new AppError("INSUFFICIENT_REMAINING", "Bill remaining balance cannot cover settlement", 409);
    }

    const claim = await tx.payment.updateMany({
      where: {
        id: paymentId,
        organizationId: ctx.organizationId,
        status: { in: ["PROCESSING", "SENT"] },
        settlementId: null,
      },
      data: { status: "SETTLED", settlementId: settled.settlementId, settledAt: new Date() },
    });
    if (claim.count !== 1) throw new AppError("PAYMENT_CONFLICT", "Payment changed before settlement", 409);

    const billClaim = await tx.bill.updateMany({
      where: { id: bill.id, remainingAmount: { gte: payment.amount } },
      data: { remainingAmount: { decrement: payment.amount } },
    });
    if (billClaim.count !== 1) throw new AppError("BILL_BALANCE_CHANGED", "Bill balance changed before settlement", 409);
    const updatedBill = await tx.bill.findUniqueOrThrow({ where: { id: bill.id } });
    await tx.bill.update({
      where: { id: bill.id },
      data: { status: updatedBill.remainingAmount.lessThanOrEqualTo(0) ? "PAID" : "PARTIAL" },
    });

    const accounting = await queueAccounting(ctx, "PAYMENT", paymentId, payment.legalEntityId, tx, {
      amount: payment.amount,
      currency: payment.currency,
      memo: `Payment ${payment.rail}`,
    });
    const updatedPayment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await tx.auditEvent.create({
      data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "payment.settled",
        objectType: "Payment", objectId: paymentId,
        oldValue: { status: payment.status },
        newValue: { status: "SETTLED", settlementId: settled.settlementId },
        correlationId: ctx.correlationId,
      },
    });
    await tx.outboxEvent.create({
      data: {
        organizationId: ctx.organizationId, type: "payment.settled",
        payload: { paymentId, settlementId: settled.settlementId },
      },
    });
    return { payment: updatedPayment, accounting, bill: await tx.bill.findUniqueOrThrow({ where: { id: bill.id } }) };
  });
}

export const paymentRuns = {
  async create(ctx: RequestContext, body: { legalEntityId: string; name: string; sourceAccountId?: string }) {
    assertEntityPermission(ctx, "payment_run.manage", body.legalEntityId);
    const name = body.name.trim();
    if (name.length < 2) throw new AppError("INVALID_NAME", "Payment run name is required", 400);
    return prisma.$transaction(async (tx) => {
      const entity = await tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity) throw new AppError("INVALID_ENTITY", "Entity is unavailable", 400);
      const sourceAccount = body.sourceAccountId ? await tx.bankAccount.findFirst({ where: { id: body.sourceAccountId, organizationId: ctx.organizationId, legalEntityId: entity.id } }) : null;
      if (body.sourceAccountId && !sourceAccount) throw new AppError("INVALID_SOURCE_ACCOUNT", "Source account is unavailable for this entity", 400);
      const run = await tx.paymentRun.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: entity.id,
          name,
          status: "OPEN",
          createdBy: ctx.userId,
          sourceAccountId: sourceAccount?.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "payment_run.create",
          objectType: "PaymentRun", objectId: run.id, newValue: { name, legalEntityId: entity.id },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "payment_run.created", payload: { paymentRunId: run.id } },
      });
      return run;
    });
  },

  async addPayments(ctx: RequestContext, id: string, body: { paymentIds: string[] }) {
    const ids = [...new Set(body.paymentIds ?? [])];
    if (!ids.length) throw new AppError("EMPTY_RUN", "Select at least one payment", 400);
    return prisma.$transaction(async (tx) => {
      const run = await tx.paymentRun.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!run) throw new AppError("NOT_FOUND", "Payment run not found", 404);
      assertEntityPermission(ctx, "payment_run.manage", run.legalEntityId);
      if (run.status !== "OPEN") throw new AppError("INVALID_STATE", "Only open runs can accept payments", 409);
      const payments = await tx.payment.findMany({
        where: { id: { in: ids }, organizationId: ctx.organizationId, legalEntityId: run.legalEntityId },
      });
      if (payments.length !== ids.length) throw new AppError("PAYMENT_NOT_FOUND", "One or more payments are unavailable", 404);
      for (const payment of payments) {
        if (payment.status !== "SCHEDULED") throw new AppError("INVALID_PAYMENT_STATE", "Only scheduled payments can join a run", 409);
        if (payment.paymentRunId && payment.paymentRunId !== id) {
          throw new AppError("PAYMENT_IN_OTHER_RUN", "Payment already belongs to another run", 409);
        }
      }
      await tx.payment.updateMany({
        where: { id: { in: ids }, organizationId: ctx.organizationId, status: "SCHEDULED" },
        data: { paymentRunId: id },
      });
      const items = await tx.payment.findMany({ where: { paymentRunId: id, organizationId: ctx.organizationId } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "payment_run.add_payments",
          objectType: "PaymentRun", objectId: id, newValue: { paymentIds: ids },
          correlationId: ctx.correlationId,
        },
      });
      return { run, items };
    });
  },

  async cancelPayment(ctx: RequestContext, id: string) {
    return auditedCommand(ctx, { action: "payment.cancel", objectType: "Payment", objectId: id, event: "payment.cancelled" }, async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
      assertEntityPermission(ctx, "payment.create", payment.legalEntityId);
      if (payment.status !== "SCHEDULED") throw new AppError("INVALID_STATE", "Only scheduled payments can be cancelled", 409);
      const updated = await tx.payment.update({ where: { id }, data: { status: "CANCELLED", paymentRunId: null } });
      return { result: updated, oldValue: { status: payment.status }, newValue: { status: updated.status } };
    });
  },

  async editDraft(ctx: RequestContext, id: string, body: {
    vendorId: string; legalEntityId: string; invoiceNumber: string; invoiceDate?: string; dueDate?: string;
    currency: string; memo?: string; attachmentId?: string; departmentId?: string;
    lines: Array<{ description: string; quantity: string; unitPrice: string; taxAmount?: string; category?: string; glAccount?: string; department?: string; location?: string; project?: string }>;
  }) {
    if (!body.lines.length) throw new AppError("LINES_REQUIRED", "Add at least one line item", 400);
    assertEntityPermission(ctx, "bill.create", body.legalEntityId);
    const normalized = body.lines.map((line) => {
      const quantity = dec(line.quantity);
      const unitPrice = dec(line.unitPrice);
      const tax = dec(line.taxAmount || "0");
      if (!quantity.greaterThan(0) || unitPrice.isNegative() || tax.isNegative()) throw new AppError("INVALID_LINE", "Line quantity and amounts are invalid", 400);
      return { ...line, quantity, unitPrice, tax, amount: quantity.mul(unitPrice).plus(tax) };
    });
    const subtotal = normalized.reduce((sum, line) => sum.plus(line.quantity.mul(line.unitPrice)), dec(0));
    const taxAmount = normalized.reduce((sum, line) => sum.plus(line.tax), dec(0));
    const total = subtotal.plus(taxAmount);
    if (!total.greaterThan(0)) throw new AppError("INVALID_TOTAL", "Bill total must be positive", 400);
    return prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!bill) throw new AppError("NOT_FOUND", "Bill not found", 404);
      if (bill.status !== "DRAFT") throw new AppError("INVALID_STATE", "Only draft bills can be edited directly", 409);
      const [vendor, entity, attachment] = await Promise.all([
        tx.vendor.findFirst({ where: { id: body.vendorId, organizationId: ctx.organizationId, status: "ACTIVE" } }),
        tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } }),
        body.attachmentId ? tx.attachment.findFirst({ where: { id: body.attachmentId, organizationId: ctx.organizationId } }) : Promise.resolve(null),
      ]);
      if (!vendor || !entity || (body.attachmentId && !attachment)) throw new AppError("INVALID_REFERENCE", "Vendor, entity, or document is unavailable", 400);
      requireCurrencyMatch(entity.currency, body.currency);
      await tx.billLine.deleteMany({ where: { organizationId: ctx.organizationId, billId: id } });
      await tx.billLine.createMany({ data: normalized.map((line) => ({ organizationId: ctx.organizationId, billId: id, description: line.description.trim(), quantity: line.quantity, unitPrice: line.unitPrice, taxAmount: line.tax, amount: line.amount, category: (line.category ?? "").trim(), glAccount: (line.glAccount ?? "").trim(), department: (line.department ?? "").trim(), location: (line.location ?? "").trim(), project: (line.project ?? "").trim() })) });
      const updated = await tx.bill.update({ where: { id }, data: { vendorId: vendor.id, legalEntityId: entity.id, invoiceNumber: body.invoiceNumber.trim(), invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null, dueDate: body.dueDate ? new Date(body.dueDate) : null, currency: body.currency, memo: (body.memo ?? "").trim(), attachmentId: body.attachmentId || null, departmentId: body.departmentId || null, subtotal, taxAmount, amount: total, remainingAmount: total } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "bill.draft_updated", objectType: "Bill", objectId: id, oldValue: { amount: bill.amount, invoiceNumber: bill.invoiceNumber }, newValue: { amount: total, invoiceNumber: updated.invoiceNumber, lineCount: normalized.length }, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "bill.draft_updated", payload: { billId: id } } });
      return updated;
    });
  },

  async cancelBill(ctx: RequestContext, id: string) {
    return auditedCommand(ctx, { action: "bill.cancel", objectType: "Bill", objectId: id, event: "bill.cancelled" }, async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!bill) throw new AppError("NOT_FOUND", "Bill not found", 404);
      assertEntityPermission(ctx, "bill.create", bill.legalEntityId);
      if (!["DRAFT", "NEEDS_REVIEW", "PENDING_APPROVAL", "APPROVED"].includes(bill.status)) throw new AppError("INVALID_STATE", "This bill can no longer be cancelled", 409);
      const payments = await tx.payment.count({ where: { organizationId: ctx.organizationId, billId: id } });
      if (payments) throw new AppError("PAYMENT_EXISTS", "Cancel scheduled payments before cancelling this bill", 409);
      const updated = await tx.bill.update({ where: { id }, data: { status: "CANCELLED" } });
      return { result: updated, oldValue: { status: bill.status }, newValue: { status: updated.status } };
    });
  },

  async removePayments(ctx: RequestContext, id: string, body: { paymentIds: string[] }) {
    const ids = [...new Set(body.paymentIds ?? [])];
    if (!ids.length) throw new AppError("EMPTY_SELECTION", "Select at least one payment", 400);
    return prisma.$transaction(async (tx) => {
      const run = await tx.paymentRun.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!run) throw new AppError("NOT_FOUND", "Payment run not found", 404);
      assertEntityPermission(ctx, "payment_run.manage", run.legalEntityId);
      if (run.status !== "OPEN") throw new AppError("INVALID_STATE", "Payments can only be removed from an open run", 409);
      const eligible = await tx.payment.findMany({ where: { id: { in: ids }, organizationId: ctx.organizationId, paymentRunId: id, status: "SCHEDULED" }, select: { id: true } });
      if (eligible.length !== ids.length) throw new AppError("INVALID_PAYMENT_STATE", "Only scheduled payments in this run can be removed", 409);
      await tx.payment.updateMany({ where: { id: { in: ids }, paymentRunId: id, status: "SCHEDULED" }, data: { paymentRunId: null } });
      await tx.auditEvent.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "payment_run.remove_payments", objectType: "PaymentRun", objectId: id, oldValue: { paymentIds: ids }, correlationId: ctx.correlationId } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "payment_run.payments_removed", payload: { paymentRunId: id, paymentIds: ids } } });
      return { run, removed: ids };
    });
  },

  async release(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const run = await tx.paymentRun.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!run) throw new AppError("NOT_FOUND", "Payment run not found", 404);
      assertEntityPermission(ctx, "payment_run.manage", run.legalEntityId);
      if (run.status === "RELEASED") {
        const items = await tx.payment.findMany({ where: { paymentRunId: id, organizationId: ctx.organizationId } });
        return { run, items };
      }
      if (run.status !== "OPEN") throw new AppError("INVALID_STATE", "Payment run cannot be released", 409);
      if (run.createdBy === ctx.userId) {
        throw new AppError("SOD_VIOLATION", "Run creator cannot release the run", 403);
      }
      const items = await tx.payment.findMany({
        where: { paymentRunId: id, organizationId: ctx.organizationId, status: "SCHEDULED" },
      });
      if (!items.length) throw new AppError("EMPTY_RUN", "Add scheduled payments before releasing the run", 400);

      const released = [];
      for (const payment of items) {
        if (payment.createdBy === ctx.userId) {
          throw new AppError("SOD_VIOLATION", "Cannot release a payment you scheduled", 403);
        }
        const accepted = paymentRail.release({
          paymentId: payment.id,
          amount: String(payment.amount),
          currency: payment.currency,
          rail: payment.rail,
        });
        if (accepted.status !== "ACCEPTED") throw new AppError("RAIL_REJECTED", "Payment rail rejected release", 409);
        const claim = await tx.payment.updateMany({
          where: { id: payment.id, organizationId: ctx.organizationId, status: "SCHEDULED" },
          data: { status: "PROCESSING", releasedBy: ctx.userId, providerRef: accepted.providerRef },
        });
        if (claim.count !== 1) throw new AppError("PAYMENT_CONFLICT", "Payment changed; refresh and try again", 409);
        await tx.auditEvent.create({
          data: {
            organizationId: ctx.organizationId, actorId: ctx.userId, action: "payment.release",
            objectType: "Payment", objectId: payment.id,
            oldValue: { status: "SCHEDULED" },
            newValue: { status: "PROCESSING", releasedBy: ctx.userId, providerRef: accepted.providerRef, paymentRunId: id },
            correlationId: ctx.correlationId,
          },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: ctx.organizationId, type: "payment.released",
            payload: { paymentId: payment.id, objectId: payment.id, paymentRunId: id, providerRef: accepted.providerRef },
          },
        });
        released.push(payment.id);
      }

      const claim = await tx.paymentRun.updateMany({
        where: { id, organizationId: ctx.organizationId, status: "OPEN" },
        data: { status: "RELEASED", releasedBy: ctx.userId },
      });
      if (claim.count !== 1) throw new AppError("RUN_CONFLICT", "Payment run changed; refresh and try again", 409);
      const updated = await tx.paymentRun.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "payment_run.release",
          objectType: "PaymentRun", objectId: id,
          newValue: { status: "RELEASED", paymentIds: released },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "payment_run.released", payload: { paymentRunId: id } },
      });
      return {
        run: updated,
        items: await tx.payment.findMany({ where: { paymentRunId: id, organizationId: ctx.organizationId } }),
      };
    });
  },

  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "payment-runs");
    const run = await prisma.paymentRun.findFirst({ where: { ...scope, id } });
    if (!run) throw new AppError("NOT_FOUND", "Payment run not found", 404);
    const items = await prisma.payment.findMany({
      where: { paymentRunId: id, organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
    });
    const [eligiblePayments, sourceAccount, bills] = await Promise.all([
      prisma.payment.findMany({ where: { organizationId: ctx.organizationId, legalEntityId: run.legalEntityId, status: "SCHEDULED", paymentRunId: null }, orderBy: { createdAt: "desc" } }),
      run.sourceAccountId ? prisma.bankAccount.findFirst({ where: { id: run.sourceAccountId, organizationId: ctx.organizationId } }) : Promise.resolve(null),
      prisma.bill.findMany({ where: { organizationId: ctx.organizationId, id: { in: [...new Set([...items, ...await prisma.payment.findMany({ where: { organizationId: ctx.organizationId, legalEntityId: run.legalEntityId, status: "SCHEDULED", paymentRunId: null } })].map((payment) => payment.billId))] } }, select: { id: true, invoiceNumber: true, vendorId: true, status: true } }),
    ]);
    const billById = new Map(bills.map((bill) => [bill.id, bill]));
    const decorate = (payment: typeof items[number]) => ({ ...payment, bill: billById.get(payment.billId) ?? null });
    const total = items.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const validationIssues = [
      ...(!items.length ? ["Add at least one eligible payment."] : []),
      ...(!run.sourceAccountId ? ["Select a source account before release."] : []),
      ...(items.some((payment) => payment.status !== "SCHEDULED") ? ["All payments must remain scheduled."] : []),
    ];
    return { run, items: items.map(decorate), eligiblePayments: eligiblePayments.map(decorate), sourceAccount, paymentCount: items.length, total, validationIssues };
  },
  async update(ctx: RequestContext, id: string, body: { name: string; legalName?: string; displayName?: string; category?: string; riskLevel?: string; notes?: string; ownerId?: string | null }) {
    return auditedCommand(ctx, { action: "vendor.update", objectType: "Vendor", objectId: id, event: "vendor.updated" }, async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found", 404);
      if (vendor.legalEntityId) assertEntityPermission(ctx, "vendor.create", vendor.legalEntityId);
      const updated = await tx.vendor.update({ where: { id }, data: { name: body.name.trim(), legalName: (body.legalName ?? "").trim(), displayName: (body.displayName ?? "").trim(), category: (body.category ?? "").trim(), riskLevel: body.riskLevel ?? vendor.riskLevel, notes: (body.notes ?? "").trim(), ownerId: body.ownerId || null } });
      return { result: updated, oldValue: { name: vendor.name, status: vendor.status }, newValue: { name: updated.name, category: updated.category, riskLevel: updated.riskLevel } };
    });
  },
  async deactivate(ctx: RequestContext, id: string) {
    return auditedCommand(ctx, { action: "vendor.deactivate", objectType: "Vendor", objectId: id, event: "vendor.deactivated" }, async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found", 404);
      if (vendor.legalEntityId) assertEntityPermission(ctx, "vendor.create", vendor.legalEntityId);
      const updated = await tx.vendor.update({ where: { id }, data: { status: "INACTIVE" } });
      return { result: updated, oldValue: { status: vendor.status }, newValue: { status: updated.status } };
    });
  },
};

export const procurement = {
  async create(ctx: RequestContext, body: {
    name: string;
    legalEntityId: string;
    programId: string;
    amount: string;
    currency: string;
    outcomeType?: "PURCHASE_ORDER" | "VIRTUAL_CARD" | "VENDOR_SETUP";
    vendorId?: string;
    proposedVendorName?: string;
    departmentId?: string;
    category?: string;
    frequency?: string;
    desiredDate?: string;
    attachmentId?: string;
    contractId?: string;
    memo?: string;
    formAnswers?: Record<string, unknown>;
    lines?: Array<{ description: string; quantity?: string | number; unitAmount?: string | number; amount?: string | number; category?: string }>;
  }) {
    const money = requireMoney(body.amount, body.currency);
    assertEntityPermission(ctx, "procurement.request", body.legalEntityId);
    let lines;
    try {
      lines = normalizeProcurementLines(body.lines, {
        description: body.name.trim(),
        amount: money.amount,
        category: body.category,
      });
    } catch {
      throw new AppError("INVALID_LINES", "Procurement lines must have positive amounts", 400);
    }
    if (Math.abs(sumLineAmounts(lines) - Number(money.amount)) > 0.001) {
      throw new AppError("LINE_TOTAL_MISMATCH", "Line totals must equal the request amount", 400);
    }

    return prisma.$transaction(async (tx) => {
      const [entity, program] = await Promise.all([
        tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } }),
        tx.procurementProgram.findFirst({ where: { id: body.programId, organizationId: ctx.organizationId, status: "ACTIVE" } }),
      ]);
      if (!entity || !program) throw new AppError("INVALID_REFERENCE", "Entity or program is unavailable", 400);
      requireCurrencyMatch(entity.currency, money.currency);
      if (program.legalEntityId && program.legalEntityId !== entity.id) {
        throw new AppError("PROGRAM_ENTITY_MISMATCH", "Program is not available for this entity", 400);
      }

      let vendorId = body.vendorId ?? null;
      if (vendorId) {
        const vendor = await tx.vendor.findFirst({ where: { id: vendorId, organizationId: ctx.organizationId } });
        if (!vendor || (vendor.legalEntityId && vendor.legalEntityId !== entity.id)) {
          throw new AppError("INVALID_VENDOR", "Vendor is unavailable for this entity", 400);
        }
      }
      if (body.attachmentId) {
        const attachment = await tx.attachment.findFirst({ where: { id: body.attachmentId, organizationId: ctx.organizationId } });
        if (!attachment) throw new AppError("ATTACHMENT_NOT_FOUND", "Supporting document not found", 404);
      }

      const outcomeType = body.outcomeType ?? (program.defaultOutcomeType as "PURCHASE_ORDER" | "VIRTUAL_CARD" | "VENDOR_SETUP") ?? "PURCHASE_ORDER";
      if (!["PURCHASE_ORDER", "VIRTUAL_CARD", "VENDOR_SETUP"].includes(outcomeType)) {
        throw new AppError("INVALID_OUTCOME", "Unsupported procurement outcome", 400);
      }

      const formAnswers = { ...(body.formAnswers ?? {}), lines };

      const request = await tx.purchaseRequest.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: entity.id,
          programId: program.id,
          requesterId: ctx.userId,
          vendorId,
          proposedVendorName: (body.proposedVendorName ?? "").trim(),
          departmentId: body.departmentId ?? null,
          name: body.name.trim(),
          amount: dec(money.amount),
          currency: money.currency,
          category: (body.category ?? "").trim(),
          frequency: (body.frequency ?? "ONE_TIME").trim() || "ONE_TIME",
          desiredDate: body.desiredDate ? new Date(body.desiredDate) : null,
          attachmentId: body.attachmentId ?? null,
          contractId: body.contractId ?? null,
          outcomeType,
          formAnswers: formAnswers as Prisma.InputJsonValue,
          memo: (body.memo ?? "").trim(),
          status: "DRAFT",
          approvalProgress: "0 of 0",
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.create",
          objectType: "PurchaseRequest", objectId: request.id,
          newValue: { name: request.name, amount: money.amount, outcomeType, lineCount: lines.length },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "procurement.created", payload: { requestId: request.id } },
      });
      return request;
    });
  },

  async submit(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.purchaseRequest.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!request) throw new AppError("NOT_FOUND", "Purchase request not found", 404);
      if (request.status !== "DRAFT") throw new AppError("INVALID_STATE", "Only draft requests can be submitted", 409);
      assertEntityPermission(ctx, "procurement.request", request.legalEntityId);
      if (request.requesterId !== ctx.userId && !ctx.permissions.includes("*") && !ctx.roles.includes("Owner")) {
        throw new AppError("FORBIDDEN", "Only the requester can submit this draft", 403);
      }

      const existingPo = await tx.purchaseOrder.findFirst({ where: { organizationId: ctx.organizationId, requestId: id } });
      if (existingPo) throw new AppError("PO_EXISTS_EARLY", "Purchase order already exists before approval", 409);

      const program = await tx.procurementProgram.findFirst({ where: { id: request.programId, organizationId: ctx.organizationId } });
      const workflow = program?.workflowId
        ? await tx.approvalWorkflow.findFirst({ where: { id: program.workflowId, organizationId: ctx.organizationId } })
        : await tx.approvalWorkflow.findFirst({ where: { organizationId: ctx.organizationId, objectType: "procurement" } });
      const steps = Array.isArray(workflow?.steps) ? (workflow.steps as unknown[]).length : 1;

      const loaded = await loadPolicyRules(tx.policy.findMany.bind(tx.policy), ctx.organizationId, "procurement");
      const policy = evaluatePolicy({
        objectType: "procurement",
        amount: Number(request.amount),
        hasMemo: Boolean(request.memo?.trim()),
        hasVendor: Boolean(request.vendorId || request.proposedVendorName?.trim()),
        hasAttachment: Boolean(request.attachmentId),
        category: request.category || undefined,
        rules: loaded.rules,
      });
      if (policy.result === "BLOCK") {
        await tx.purchaseRequest.update({
          where: { id },
          data: {
            status: "BLOCKED",
            policyResult: policy.result,
            policyReason: policy.reason,
            policyMatchedRules: policy.matchedRules,
            policyRequiredActions: policy.requiredActions,
            policyVersion: 1,
            policyEvaluatedAt: new Date(),
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.policy_blocked",
            objectType: "PurchaseRequest", objectId: id, newValue: { policy },
            correlationId: ctx.correlationId,
          },
        });
        throw new AppError("POLICY_BLOCKED", policy.reason, 409, { policy });
      }

      const claim = await tx.purchaseRequest.updateMany({
        where: { id, organizationId: ctx.organizationId, status: "DRAFT" },
        data: {
          status: "IN_REVIEW",
          approvalProgress: `0 of ${steps} approvals`,
          policyResult: policy.result,
          policyReason: policy.reason,
          policyMatchedRules: policy.matchedRules,
          policyRequiredActions: policy.requiredActions,
          policyVersion: 1,
          policyEvaluatedAt: new Date(),
        },
      });
      if (claim.count !== 1) throw new AppError("PROCUREMENT_CONFLICT", "Request changed; refresh and try again", 409);

      await startApproval({
        organizationId: ctx.organizationId,
        workflowId: workflow?.id,
        objectType: "procurement",
        objectId: id,
        requesterId: request.requesterId,
        steps,
        title: request.name || "Purchase request",
        amount: String(request.amount ?? 0),
        currency: request.currency || "USD",
        legalEntityId: request.legalEntityId,
        departmentId: request.departmentId,
        policySummary: `Policy ${policy.result}`,
      }, tx);

      const updated = await tx.purchaseRequest.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.submit",
          objectType: "PurchaseRequest", objectId: id,
          oldValue: { status: "DRAFT" }, newValue: { status: updated.status, steps, policyResult: policy.result },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "procurement.submitted", payload: { objectType: "PurchaseRequest", objectId: id, policyResult: policy.result } },
      });
      return updated;
    });
  },

  async approve(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.purchaseRequest.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!request) throw new AppError("NOT_FOUND", "Purchase request not found", 404);
      if (!["IN_REVIEW", "SUBMITTED"].includes(request.status)) {
        throw new AppError("INVALID_STATE", "Request is not awaiting approval", 409);
      }
      assertEntityPermission(ctx, "procurement.review", request.legalEntityId);
      if (request.requesterId === ctx.userId) {
        throw new AppError("SOD_VIOLATION", "Requester cannot approve their own procurement request", 403);
      }

      const instance = await tx.approvalInstance.findFirst({
        where: { organizationId: ctx.organizationId, objectId: id, objectType: "procurement", status: "IN_REVIEW" },
        orderBy: { createdAt: "desc" },
      });
      if (!instance) throw new AppError("NOT_FOUND", "Approval not started", 404);

      const workflow = instance.workflowId === "default"
        ? null
        : await tx.approvalWorkflow.findFirst({ where: { id: instance.workflowId, organizationId: ctx.organizationId } });
      const totalSteps = Array.isArray(workflow?.steps) ? (workflow.steps as unknown[]).length : 1;
      const updatedInstance = await actOnApproval({ instanceId: instance.id, actorId: ctx.userId, action: "approve" }, tx);
      const progress = progressLabel(updatedInstance.currentStep, totalSteps, updatedInstance.status);

      let po = await tx.purchaseOrder.findFirst({ where: { organizationId: ctx.organizationId, requestId: request.id } });
      let outcomeId = request.outcomeId;

      // Critical invariant: PO / outcome only after FINAL approval.
      if (updatedInstance.status === "APPROVED") {
        if (request.outcomeType === "PURCHASE_ORDER") {
          if (!po) {
            const answers = (request.formAnswers ?? {}) as { lines?: Array<{ description: string; quantity?: string; unitAmount?: string; amount?: string; category?: string }> };
            let lines;
            try {
              lines = normalizeProcurementLines(answers.lines, {
                description: request.name,
                amount: String(request.amount),
              });
            } catch {
              throw new AppError("INVALID_LINES", "Cannot fulfill PO with invalid lines", 400);
            }
            if (Math.abs(sumLineAmounts(lines) - Number(request.amount)) > 0.001) {
              throw new AppError("LINE_TOTAL_MISMATCH", "Stored lines no longer match request amount", 409);
            }

            try {
              const orderedQty = sumLineQuantities(lines);
              po = await tx.purchaseOrder.create({
                data: {
                  organizationId: ctx.organizationId,
                  legalEntityId: request.legalEntityId,
                  requestId: request.id,
                  vendorId: request.vendorId,
                  ownerId: request.requesterId,
                  number: `PO-${Date.now().toString(36).toUpperCase()}-${request.id.slice(0, 4).toUpperCase()}`,
                  description: request.name,
                  amount: request.amount,
                  commitmentAmount: request.amount,
                  orderedQuantity: dec(orderedQty),
                  currency: request.currency,
                  status: "ISSUED",
                  issuedAt: new Date(),
                  matchStatus: "UNMATCHED",
                  version: 1,
                },
              });
            } catch (error) {
              if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                po = await tx.purchaseOrder.findFirstOrThrow({ where: { organizationId: ctx.organizationId, requestId: request.id } });
              } else {
                throw error;
              }
            }

            const existingLines = await tx.purchaseOrderLine.count({ where: { purchaseOrderId: po.id } });
            if (existingLines === 0) {
              await tx.purchaseOrderLine.createMany({
                data: lines.map((line) => ({
                  organizationId: ctx.organizationId,
                  purchaseOrderId: po!.id,
                  description: line.description,
                  quantity: dec(line.quantity),
                  unitAmount: dec(line.unitAmount),
                  amount: dec(line.amount),
                  category: line.category,
                })),
              });
            }
            outcomeId = po.id;

            const program = await tx.procurementProgram.findFirst({ where: { id: request.programId, organizationId: ctx.organizationId } });
            if (program?.budgetId) {
              const budget = await tx.budget.findFirst({ where: { id: program.budgetId, organizationId: ctx.organizationId } });
              if (budget) {
                if (budget.committedAmount.plus(budget.actualAmount).plus(request.amount).greaterThan(budget.amount)) {
                  throw new AppError("BUDGET_EXCEEDED", "Issuing this PO would exceed budget capacity", 409);
                }
                await tx.budget.updateMany({
                  where: { id: budget.id, committedAmount: budget.committedAmount, actualAmount: budget.actualAmount },
                  data: { committedAmount: { increment: request.amount }, freshness: new Date() },
                });
              }
            }
          } else {
            outcomeId = po.id;
          }
        } else {
          // Non-PO outcomes: record a deterministic outcome reference without creating a PO.
          outcomeId = outcomeId ?? `${request.outcomeType.toLowerCase()}_${request.id}`;
          if (po) throw new AppError("UNEXPECTED_PO", "Non-PO outcome cannot have a purchase order", 409);
        }
      } else if (po) {
        throw new AppError("PO_BEFORE_FINAL", "Purchase order exists before final approval", 409);
      }

      const claim = await tx.purchaseRequest.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["IN_REVIEW", "SUBMITTED"] } },
        data: {
          status: updatedInstance.status === "APPROVED"
            ? (request.outcomeType === "PURCHASE_ORDER" ? "FULFILLED" : "APPROVED")
            : "IN_REVIEW",
          approvalProgress: progress,
          ...(updatedInstance.status === "APPROVED" && outcomeId ? { outcomeId } : {}),
        },
      });
      if (claim.count !== 1 && updatedInstance.status === "APPROVED") {
        throw new AppError("PROCUREMENT_CONFLICT", "Request changed; refresh and try again", 409);
      }

      const updated = await tx.purchaseRequest.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.approve",
          objectType: "PurchaseRequest", objectId: id,
          newValue: {
            status: updated.status,
            approvalProgress: progress,
            purchaseOrderId: po?.id ?? null,
            outcomeId: updated.outcomeId,
            final: updatedInstance.status === "APPROVED",
          },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId,
          type: updatedInstance.status === "APPROVED" ? "procurement.approved" : "procurement.step_approved",
          payload: { objectType: "PurchaseRequest", objectId: id, purchaseOrderId: po?.id, outcomeId: updated.outcomeId },
        },
      });
      if (updatedInstance.status === "APPROVED" && po) {
        await tx.outboxEvent.create({
          data: {
            organizationId: ctx.organizationId,
            type: "purchase_order.issued",
            payload: { purchaseOrderId: po.id, requestId: id },
          },
        });
      }
      return { request: updated, purchaseOrder: po, approval: updatedInstance };
    });
  },

  async receive(ctx: RequestContext, purchaseOrderId: string, body: {
    amount?: string;
    quantity?: string;
    purchaseOrderLineId?: string;
    receiptType?: "AMOUNT" | "QUANTITY" | "SERVICE";
    memo?: string;
    idempotencyKey?: string;
    allowOverride?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      if (body.idempotencyKey) {
        const prior = await tx.receivingRecord.findFirst({
          where: { organizationId: ctx.organizationId, idempotencyKey: body.idempotencyKey },
        });
        if (prior) return prior;
      }
      const po = await tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId, organizationId: ctx.organizationId } });
      if (!po) throw new AppError("NOT_FOUND", "PO not found", 404);
      if (!canReceivePo(po.status)) {
        throw new AppError("INVALID_STATE", "PO cannot accept receiving in this status", 409);
      }
      assertEntityPermission(ctx, "procurement.review", po.legalEntityId);

      const receiptType = body.receiptType ?? (body.quantity != null ? "QUANTITY" : body.amount != null ? "AMOUNT" : "SERVICE");
      let receiveAmount = "0";
      let receiveQty: number | null = null;

      if (receiptType === "SERVICE") {
        receiveAmount = body.amount ? requireMoney(body.amount, po.currency).amount : String(po.amount.minus(po.receivedAmount));
      } else if (receiptType === "QUANTITY") {
        receiveQty = Number(body.quantity ?? 0);
        if (!Number.isFinite(receiveQty) || receiveQty <= 0) throw new AppError("INVALID_QUANTITY", "Quantity must be positive", 400);
        const ordered = Number(po.orderedQuantity);
        const already = Number(po.receivedQuantity);
        if (already + receiveQty > ordered + 1e-9 && !body.allowOverride) {
          throw new AppError("RECEIVE_EXCEEDS_PO", "Receiving quantity exceeds remaining PO quantity", 400);
        }
        if (body.allowOverride) assertEntityPermission(ctx, "procurement.review", po.legalEntityId);
        const unit = ordered > 0 ? Number(po.amount) / ordered : Number(po.amount);
        receiveAmount = (receiveQty * unit).toFixed(2);
        if (body.purchaseOrderLineId) {
          const line = await tx.purchaseOrderLine.findFirst({
            where: { id: body.purchaseOrderLineId, purchaseOrderId, organizationId: ctx.organizationId },
          });
          if (!line) throw new AppError("LINE_NOT_FOUND", "PO line not found", 404);
          if (Number(line.receivedQuantity) + receiveQty > Number(line.quantity) + 1e-9 && !body.allowOverride) {
            throw new AppError("RECEIVE_EXCEEDS_LINE", "Receiving exceeds line quantity", 400);
          }
          await tx.purchaseOrderLine.update({
            where: { id: line.id },
            data: { receivedQuantity: { increment: receiveQty } },
          });
        }
      } else {
        receiveAmount = requireMoney(body.amount ?? "0", po.currency).amount;
      }

      const remaining = po.amount.minus(po.receivedAmount);
      if (remaining.lessThan(dec(receiveAmount)) && !body.allowOverride) {
        throw new AppError("RECEIVE_EXCEEDS_PO", "Receiving exceeds remaining PO commitment", 400);
      }

      const record = await tx.receivingRecord.create({
        data: {
          organizationId: ctx.organizationId,
          purchaseOrderId,
          purchaseOrderLineId: body.purchaseOrderLineId ?? null,
          amount: dec(receiveAmount),
          quantity: receiveQty != null ? dec(receiveQty) : null,
          receiptType,
          memo: (body.memo ?? "").trim(),
          receivedBy: ctx.userId,
          idempotencyKey: body.idempotencyKey ?? null,
        },
      });
      const nextReceived = po.receivedAmount.plus(dec(receiveAmount));
      const nextQty = Number(po.receivedQuantity) + (receiveQty ?? 0);
      const status = nextReceiveStatus({
        receivedAmount: Number(nextReceived),
        poAmount: Number(po.amount),
        receivedQuantity: nextQty,
        orderedQuantity: Number(po.orderedQuantity),
        enforceQuantity: receiptType === "QUANTITY",
      });
      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          receivedAmount: nextReceived,
          receivedQuantity: dec(nextQty),
          status,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.receive",
          objectType: "PurchaseOrder", objectId: purchaseOrderId,
          newValue: { receivingRecordId: record.id, amount: receiveAmount, quantity: receiveQty, status, receiptType },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId, type: "receiving.recorded",
          payload: { purchaseOrderId, receivingRecordId: record.id, amount: receiveAmount, quantity: receiveQty },
        },
      });
      return record;
    });
  },

  async match(ctx: RequestContext, purchaseOrderId: string, body: { billId: string; invoicedQuantity?: string }) {
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId, organizationId: ctx.organizationId } });
      if (!po) throw new AppError("NOT_FOUND", "PO not found", 404);
      assertEntityPermission(ctx, "procurement.review", po.legalEntityId);
      const bill = await tx.bill.findFirst({ where: { id: body.billId, organizationId: ctx.organizationId } });
      if (!bill) throw new AppError("BILL_NOT_FOUND", "Bill not found", 404);
      if (bill.purchaseOrderId && bill.purchaseOrderId !== purchaseOrderId) {
        throw new AppError("BILL_OTHER_PO", "Bill is linked to a different PO", 409);
      }
      if (bill.legalEntityId !== po.legalEntityId) {
        throw new AppError("ENTITY_MISMATCH", "Bill and PO must share an entity", 400);
      }
      requireCurrencyMatch(po.currency, bill.currency);

      if (!bill.purchaseOrderId) {
        await tx.bill.update({ where: { id: bill.id }, data: { purchaseOrderId } });
      }

      const prior = await tx.matchRecord.findFirst({
        where: { organizationId: ctx.organizationId, purchaseOrderId, billId: bill.id },
      });
      if (prior) return prior;

      const request = await tx.purchaseRequest.findFirst({ where: { id: po.requestId, organizationId: ctx.organizationId } });
      const program = request
        ? await tx.procurementProgram.findFirst({ where: { id: request.programId, organizationId: ctx.organizationId } })
        : null;
      const tolerancePct = program ? Number(program.matchTolerancePct) : 0.01;
      const billedDelta = bill.amount;
      const nextBilled = po.billedAmount.plus(billedDelta);
      const invoicedQty = body.invoicedQuantity != null
        ? Number(body.invoicedQuantity)
        : Number(po.orderedQuantity) || undefined;

      const evaluation = evaluateMatch({
        poAmount: Number(po.amount),
        receivedAmount: Number(po.receivedAmount),
        billedAmount: Number(nextBilled),
        tolerancePct,
        orderedQuantity: Number(po.orderedQuantity) || undefined,
        receivedQuantity: Number(po.receivedQuantity) || undefined,
        invoicedQuantity: invoicedQty,
        vendorMatch: !po.vendorId || !bill.vendorId || po.vendorId === bill.vendorId,
        currencyMatch: po.currency === bill.currency,
      });

      const latestReceiving = await tx.receivingRecord.findFirst({
        where: { organizationId: ctx.organizationId, purchaseOrderId },
        orderBy: { createdAt: "desc" },
      });

      const match = await tx.matchRecord.create({
        data: {
          organizationId: ctx.organizationId,
          purchaseOrderId,
          billId: bill.id,
          receivingRecordId: latestReceiving?.id ?? null,
          matchType: evaluation.matchType,
          status: evaluation.status,
          reasonCode: evaluation.reasonCode,
          exceptionStatus: evaluation.status === "EXCEPTION" || evaluation.status === "BLOCKED" ? "OPEN" : "",
          expectedJson: {
            poAmount: Number(po.amount),
            receivedAmount: Number(po.receivedAmount),
            orderedQuantity: Number(po.orderedQuantity),
            receivedQuantity: Number(po.receivedQuantity),
          },
          actualJson: {
            billedAmount: Number(nextBilled),
            invoicedQuantity: invoicedQty ?? null,
          },
          tolerance: dec(resolveTolerance(Number(po.amount), undefined, tolerancePct)),
          poAmount: po.amount,
          receivedAmount: po.receivedAmount,
          billedAmount: nextBilled,
          variance: dec(evaluation.variance),
          explanation: evaluation.explanation,
          createdBy: ctx.userId,
        },
      });

      const passing = isMatchPassing(evaluation.status);
      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          billedAmount: nextBilled,
          matchedAmount: passing ? po.amount : po.matchedAmount,
          matchStatus: passing
            ? (Number(po.receivedAmount) > 0 || Number(po.receivedQuantity) > 0 ? "THREE_WAY_MATCHED" : "TWO_WAY_MATCHED")
            : evaluation.status === "BLOCKED" ? "EXCEPTION" : "EXCEPTION",
          status: passing && (Number(po.receivedAmount) >= Number(po.amount) || Number(po.receivedQuantity) >= Number(po.orderedQuantity) && Number(po.orderedQuantity) > 0)
            ? "CLOSED"
            : po.status,
        },
      });

      if (passing && program?.budgetId) {
        const budget = await tx.budget.findFirst({ where: { id: program.budgetId, organizationId: ctx.organizationId } });
        if (budget) {
          const release = Prisma.Decimal.min(budget.committedAmount, billedDelta);
          await tx.budget.update({
            where: { id: budget.id },
            data: {
              committedAmount: { decrement: release },
              actualAmount: { increment: billedDelta },
              freshness: new Date(),
            },
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.match",
          objectType: "PurchaseOrder", objectId: purchaseOrderId,
          newValue: { matchId: match.id, billId: bill.id, status: evaluation.status, matchType: evaluation.matchType, reasonCode: evaluation.reasonCode },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId, type: "procurement.matched",
          payload: { purchaseOrderId, matchId: match.id, status: evaluation.status },
        },
      });
      return match;
    });
  },

  async resolveException(ctx: RequestContext, matchId: string, body: {
    resolution: "APPROVED_OVERRIDE" | "CORRECTED" | "REJECTED" | "RESOLVED" | "REQUESTED_RECEIVING_UPDATE" | "REQUESTED_CORRECTED_INVOICE" | "COMMENTED";
    note?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const match = await tx.matchRecord.findFirst({ where: { id: matchId, organizationId: ctx.organizationId } });
      if (!match) throw new AppError("NOT_FOUND", "Match record not found", 404);
      const po = await tx.purchaseOrder.findFirst({ where: { id: match.purchaseOrderId, organizationId: ctx.organizationId } });
      if (!po) throw new AppError("NOT_FOUND", "PO not found", 404);
      assertEntityPermission(ctx, "procurement.review", po.legalEntityId);
      if (match.exceptionStatus !== "OPEN" && match.exceptionStatus !== "IN_REVIEW") {
        throw new AppError("INVALID_STATE", "Exception is not open", 409);
      }
      if (body.resolution === "APPROVED_OVERRIDE" && Number(match.variance) >= 1000 && !ctx.permissions.includes("*") && !ctx.roles.includes("Owner")) {
        throw new AppError("OVERRIDE_FORBIDDEN", "High-value match override requires Owner", 403);
      }
      const updated = await tx.matchRecord.update({
        where: { id: matchId },
        data: {
          exceptionStatus: ["REQUESTED_RECEIVING_UPDATE", "REQUESTED_CORRECTED_INVOICE", "COMMENTED"].includes(body.resolution) ? "IN_REVIEW" : body.resolution,
          resolution: (body.note ?? "").trim(),
          resolvedBy: ctx.userId,
          resolvedAt: new Date(),
          status: body.resolution === "APPROVED_OVERRIDE" || body.resolution === "RESOLVED" || body.resolution === "CORRECTED"
            ? "WITHIN_TOLERANCE"
            : match.status,
        },
      });
      if (["APPROVED_OVERRIDE", "RESOLVED", "CORRECTED"].includes(body.resolution)) {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            matchStatus: Number(po.receivedAmount) > 0 || Number(po.receivedQuantity) > 0 ? "THREE_WAY_MATCHED" : "TWO_WAY_MATCHED",
            matchedAmount: po.amount,
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.exception_resolved",
          objectType: "MatchRecord", objectId: matchId,
          newValue: { resolution: body.resolution, note: body.note ?? "" },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "procurement.match_exception_actioned", payload: { matchId, purchaseOrderId: po.id, resolution: body.resolution } } });
      return updated;
    });
  },

  async requestChangeOrder(ctx: RequestContext, purchaseOrderId: string, body: {
    reason: string;
    amount?: string;
    expectedDelivery?: string;
    description?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId, organizationId: ctx.organizationId } });
      if (!po) throw new AppError("NOT_FOUND", "PO not found", 404);
      assertEntityPermission(ctx, "procurement.review", po.legalEntityId);
      if (["CLOSED", "CANCELLED"].includes(po.status)) {
        throw new AppError("INVALID_STATE", "Closed POs cannot be changed", 409);
      }
      const newAmount = body.amount != null ? requireMoney(body.amount, po.currency).amount : String(po.amount);
      const change = await tx.poChangeOrder.create({
        data: {
          organizationId: ctx.organizationId,
          purchaseOrderId,
          version: po.version + 1,
          reason: body.reason.trim(),
          previousValue: { amount: String(po.amount), description: po.description, expectedDelivery: po.expectedDelivery },
          newValue: {
            amount: newAmount,
            description: body.description ?? po.description,
            expectedDelivery: body.expectedDelivery ?? po.expectedDelivery,
          },
          status: Number(newAmount) > Number(po.amount) * 1.1 ? "PENDING_APPROVAL" : "PENDING",
          requestedBy: ctx.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.change_requested",
          objectType: "PurchaseOrder", objectId: purchaseOrderId,
          newValue: { changeOrderId: change.id, version: change.version },
          correlationId: ctx.correlationId,
        },
      });
      return change;
    });
  },

  async approveChangeOrder(ctx: RequestContext, changeOrderId: string) {
    return prisma.$transaction(async (tx) => {
      const change = await tx.poChangeOrder.findFirst({ where: { id: changeOrderId, organizationId: ctx.organizationId } });
      if (!change) throw new AppError("NOT_FOUND", "Change order not found", 404);
      const po = await tx.purchaseOrder.findFirst({ where: { id: change.purchaseOrderId, organizationId: ctx.organizationId } });
      if (!po) throw new AppError("NOT_FOUND", "PO not found", 404);
      assertEntityPermission(ctx, "procurement.review", po.legalEntityId);
      if (change.requestedBy === ctx.userId && !ctx.permissions.includes("*")) {
        throw new AppError("SOD_VIOLATION", "Requester cannot approve their own change order", 403);
      }
      if (!["PENDING", "PENDING_APPROVAL"].includes(change.status)) {
        throw new AppError("INVALID_STATE", "Change order is not pending", 409);
      }
      const next = change.newValue as { amount?: string; description?: string; expectedDelivery?: string | null };
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          amount: next.amount != null ? dec(next.amount) : po.amount,
          commitmentAmount: next.amount != null ? dec(next.amount) : po.commitmentAmount,
          description: next.description ?? po.description,
          expectedDelivery: next.expectedDelivery ? new Date(next.expectedDelivery) : po.expectedDelivery,
          version: change.version,
        },
      });
      const updated = await tx.poChangeOrder.update({
        where: { id: changeOrderId },
        data: { status: "APPROVED", approvedBy: ctx.userId, effectiveAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "procurement.change_approved",
          objectType: "PurchaseOrder", objectId: po.id,
          newValue: { changeOrderId, version: change.version },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },

  async getRequestDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "procurement");
    const request = await prisma.purchaseRequest.findFirst({ where: { ...scope, id } });
    if (!request) throw new AppError("NOT_FOUND", "Purchase request not found", 404);
    const [program, vendor, po, instance, actions, timeline, requester] = await Promise.all([
      prisma.procurementProgram.findFirst({ where: { id: request.programId, organizationId: ctx.organizationId } }),
      request.vendorId ? prisma.vendor.findFirst({ where: { id: request.vendorId, organizationId: ctx.organizationId } }) : null,
      prisma.purchaseOrder.findFirst({ where: { organizationId: ctx.organizationId, requestId: id } }),
      prisma.approvalInstance.findFirst({
        where: { organizationId: ctx.organizationId, objectType: "procurement", objectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.approvalAction.findMany({
        where: { instanceId: { in: (await prisma.approvalInstance.findMany({ where: { organizationId: ctx.organizationId, objectType: "procurement", objectId: id }, select: { id: true } })).map((row) => row.id) } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, OR: [{ objectType: "PurchaseRequest", objectId: id }, { objectId: id }] },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.user.findFirst({ where: { id: request.requesterId, organizationId: ctx.organizationId }, select: { id: true, firstName: true, lastName: true, email: true } }),
    ]);
    const steps = Array.isArray(instance?.resolvedSteps) ? instance!.resolvedSteps as Array<{ type?: string; role?: string }> : [];
    const approveCount = actions.filter((row) => row.action === "approve").length;
    const approvalProgress = steps.map((step, index) => ({
      label: (step.type ?? step.role ?? `Step ${index + 1}`).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      status: instance?.status === "REJECTED" && index === instance.currentStep
        ? "Rejected"
        : index < approveCount || instance?.status === "APPROVED"
          ? "Approved"
          : index === (instance?.currentStep ?? 0)
            ? "Pending"
            : "Waiting",
    }));
    return {
      request,
      program,
      vendor,
      requester,
      purchaseOrder: po,
      approval: instance,
      approvalProgress,
      approvalLabel: instance ? progressLabel(instance.currentStep, steps.length || 1, instance.status) : request.approvalProgress,
      policy: {
        result: request.policyResult,
        reason: request.policyReason,
        matchedRules: request.policyMatchedRules,
        requiredActions: request.policyRequiredActions,
        version: request.policyVersion,
        evaluatedAt: request.policyEvaluatedAt,
      },
      timeline,
    };
  },

  async getPoDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "purchase-orders");
    const po = await prisma.purchaseOrder.findFirst({ where: { ...scope, id } });
    if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);
    const [lines, receiving, matches, request, bills, vendor, changeOrders, timeline] = await Promise.all([
      prisma.purchaseOrderLine.findMany({ where: { organizationId: ctx.organizationId, purchaseOrderId: id } }),
      prisma.receivingRecord.findMany({ where: { organizationId: ctx.organizationId, purchaseOrderId: id }, orderBy: { createdAt: "desc" } }),
      prisma.matchRecord.findMany({ where: { organizationId: ctx.organizationId, purchaseOrderId: id }, orderBy: { createdAt: "desc" } }),
      prisma.purchaseRequest.findFirst({ where: { id: po.requestId, organizationId: ctx.organizationId } }),
      prisma.bill.findMany({ where: { organizationId: ctx.organizationId, purchaseOrderId: id } }),
      po.vendorId ? prisma.vendor.findFirst({ where: { id: po.vendorId, organizationId: ctx.organizationId } }) : null,
      prisma.poChangeOrder.findMany({ where: { organizationId: ctx.organizationId, purchaseOrderId: id }, orderBy: { createdAt: "desc" } }),
      prisma.auditEvent.findMany({
        where: { organizationId: ctx.organizationId, OR: [{ objectType: "PurchaseOrder", objectId: id }, { objectId: id }] },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
    ]);
    return {
      purchaseOrder: po,
      lines,
      receiving,
      matches,
      request,
      bills,
      vendor,
      changeOrders,
      timeline,
      remainingCommitment: Number(po.commitmentAmount) - Number(po.matchedAmount || po.billedAmount),
    };
  },
};

export const accounting = {
  async code(ctx: RequestContext, id: string, body: { category?: string; memo?: string; coding?: Record<string, string> }) {
    const category = body.category?.trim() ?? "";
    const memo = body.memo?.trim() ?? "";
    const coding = body.coding ?? {};
    if (!category && !Object.values(coding).some((value) => value.trim())) {
      throw new AppError("CODING_REQUIRED", "Add a category or an accounting code", 400);
    }
    if (category.length > 120 || memo.length > 500 || Object.entries(coding).some(([key, value]) => key.length > 80 || value.length > 120)) {
      throw new AppError("INVALID_CODING", "Accounting fields are too long", 400);
    }
    return prisma.$transaction(async (tx) => {
      const entry = await tx.accountingEntry.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!entry) throw new AppError("NOT_FOUND", "Accounting entry not found", 404);
      if (!["NEEDS_REVIEW", "SYNC_ERROR", "READY_TO_SYNC"].includes(entry.status)) {
        throw new AppError("INVALID_STATE", "Entry cannot be changed during or after sync", 409);
      }
      const claimed = await tx.accountingEntry.updateMany({
        where: { id, organizationId: ctx.organizationId, status: entry.status, updatedAt: entry.updatedAt },
        data: { category, memo, coding, status: "NEEDS_REVIEW", syncError: null },
      });
      if (claimed.count !== 1) throw new AppError("CODING_CONFLICT", "Entry changed; refresh and try again", 409);
      const updated = await tx.accountingEntry.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting.code",
        objectType: "AccountingEntry", objectId: id,
        oldValue: { category: entry.category, memo: entry.memo, coding: entry.coding },
        newValue: { category, memo, coding }, correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "accounting.coded", payload: { entryId: id } } });
      return updated;
    });
  },

  async markReady(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.accountingEntry.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!entry) throw new AppError("NOT_FOUND", "Accounting entry not found", 404);
      if (!["NEEDS_REVIEW", "SYNC_ERROR"].includes(entry.status)) throw new AppError("INVALID_STATE", "Entry cannot be marked ready from this state", 409);
      if (!entry.category && !Object.values(entry.coding as Record<string, string>).some(Boolean)) {
        throw new AppError("CODING_REQUIRED", "Assign a category or accounting code first", 400);
      }
      const claimed = await tx.accountingEntry.updateMany({
        where: { id, organizationId: ctx.organizationId, status: entry.status, updatedAt: entry.updatedAt },
        data: { status: "READY_TO_SYNC", syncError: null },
      });
      if (claimed.count !== 1) throw new AppError("CODING_CONFLICT", "Entry changed; refresh and try again", 409);
      const updated = await tx.accountingEntry.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting.ready",
          objectType: "AccountingEntry", objectId: id,
          oldValue: { status: entry.status }, newValue: { status: updated.status },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "accounting.ready", payload: { entryId: id } } });
      return updated;
    });
  },

  async undoReady(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.accountingEntry.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!entry) throw new AppError("NOT_FOUND", "Accounting entry not found", 404);
      if (entry.status !== "READY_TO_SYNC") throw new AppError("INVALID_STATE", "Only ready entries can be returned to review", 409);
      const claimed = await tx.accountingEntry.updateMany({
        where: { id, organizationId: ctx.organizationId, status: "READY_TO_SYNC" },
        data: { status: "NEEDS_REVIEW" },
      });
      if (claimed.count !== 1) throw new AppError("CODING_CONFLICT", "Entry changed; refresh and try again", 409);
      const updated = await tx.accountingEntry.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting.undo_ready",
          objectType: "AccountingEntry", objectId: id,
          oldValue: { status: "READY_TO_SYNC" }, newValue: { status: "NEEDS_REVIEW" },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },

  async bulkReady(ctx: RequestContext, ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) throw new AppError("EMPTY_SELECTION", "Select at least one entry", 400);
    const results = [];
    for (const id of unique) {
      results.push(await accounting.markReady(ctx, id));
    }
    return { count: results.length, entries: results };
  },

  async retry(ctx: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.accountingEntry.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!entry) throw new AppError("NOT_FOUND", "Accounting entry not found", 404);
      if (entry.status !== "SYNC_ERROR") throw new AppError("INVALID_STATE", "Only sync errors can be retried", 409);
      if (!entry.category && !Object.values(entry.coding as Record<string, string>).some(Boolean)) {
        throw new AppError("CODING_REQUIRED", "Assign a category or accounting code before retry", 400);
      }
      const claimed = await tx.accountingEntry.updateMany({
        where: { id, organizationId: ctx.organizationId, status: "SYNC_ERROR" },
        data: { status: "READY_TO_SYNC", syncError: null },
      });
      if (claimed.count !== 1) throw new AppError("CODING_CONFLICT", "Entry changed; refresh and try again", 409);
      const updated = await tx.accountingEntry.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting.retry",
          objectType: "AccountingEntry", objectId: id,
          oldValue: { status: "SYNC_ERROR", externalId: entry.externalId },
          newValue: { status: "READY_TO_SYNC", externalId: entry.externalId },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },

  async sync(ctx: RequestContext, ids?: string[]) {
    return prisma.$transaction(async (tx) => {
      const entries = await tx.accountingEntry.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: "READY_TO_SYNC",
          ...(ids ? { id: { in: ids } } : {}),
        },
      });
      if (!entries.length) throw new AppError("NOTHING_TO_SYNC", "No ready accounting entries were selected", 400);
      const connection = await tx.integrationConnection.findFirst({
        where: { organizationId: ctx.organizationId, family: "AccountingProvider", status: "CONNECTED" },
      });
      if (!connection) throw new AppError("ERP_NOT_CONNECTED", "Connect an accounting provider first", 400);
      const entryIds = entries.map((entry) => entry.id);
      const job = await tx.syncJob.create({
        data: {
          organizationId: ctx.organizationId,
          provider: connection.provider,
          status: "PENDING",
          itemCount: entries.length,
          entryIds,
        },
      });
      const claim = await tx.accountingEntry.updateMany({
        where: { organizationId: ctx.organizationId, status: "READY_TO_SYNC", id: { in: entryIds } },
        data: { status: "SYNCING" },
      });
      if (claim.count !== entries.length) throw new AppError("SYNC_CONFLICT", "Accounting entries changed; refresh and try again", 409);
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting.sync_requested",
          objectType: "SyncJob", objectId: job.id,
          newValue: { count: entries.length, provider: connection.provider },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId, type: "accounting.sync_requested",
          payload: { jobId: job.id, entryIds },
        },
      });
      return { job, count: entries.length };
    });
  },

  /** Sandbox-only: apply mock ERP ack. Production uses the worker + provider callback. */
  async confirmSync(ctx: RequestContext, jobId: string) {
    if (env.nodeEnv === "production") {
      throw new AppError("PROVIDER_REQUIRED", "ERP sync confirmation must come from the provider worker", 403);
    }
    return executeAccountingSyncJob(prisma, { jobId, actorId: ctx.userId, organizationId: ctx.organizationId });
  },

  async createRule(ctx: RequestContext, body: {
    name: string;
    match?: Record<string, unknown>;
    coding: Record<string, unknown>;
    priority?: number;
  }) {
    if (!ctx.permissions.includes("*") && !ctx.permissions.includes("accounting.code") && !ctx.roles.includes("Owner")) {
      throw new AppError("FORBIDDEN", "Missing accounting.code", 403);
    }
    const name = body.name.trim();
    if (name.length < 2) throw new AppError("INVALID_NAME", "Rule name is required", 400);
    const rule = await prisma.accountingRule.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        match: (body.match ?? {}) as Prisma.InputJsonValue,
        coding: body.coding as Prisma.InputJsonValue,
        priority: body.priority ?? 100,
        enabled: true,
      },
    });
    await prisma.auditEvent.create({
      data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting.rule_create",
        objectType: "AccountingRule", objectId: rule.id,
        newValue: { name, match: body.match ?? {}, coding: body.coding, priority: rule.priority } as Prisma.InputJsonValue,
        correlationId: ctx.correlationId,
      },
    });
    return rule;
  },

  async refreshDimensions(ctx: RequestContext) {
    if (!ctx.permissions.includes("*") && !ctx.permissions.includes("accounting.code") && !ctx.roles.includes("Owner")) {
      throw new AppError("FORBIDDEN", "Missing accounting.code", 403);
    }
    const dims = accountingProvider.listDimensions();
    const rows = [];
    for (const dim of dims) {
      rows.push(await prisma.accountingDimension.upsert({
        where: { organizationId_key: { organizationId: ctx.organizationId, key: dim.key } },
        update: { label: dim.label, values: dim.values, providerSynced: true },
        create: {
          organizationId: ctx.organizationId,
          key: dim.key,
          label: dim.label,
          values: dim.values,
          providerSynced: true,
        },
      }));
    }
    await prisma.auditEvent.create({
      data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "accounting.dimensions_refresh",
        objectType: "AccountingDimension", objectId: ctx.organizationId,
        newValue: { keys: dims.map((d) => d.key) },
        correlationId: ctx.correlationId,
      },
    });
    return rows;
  },

  async getQueueSummary(ctx: RequestContext) {
    const scope = await scopedWhere(ctx, "accounting");
    const [needsReview, ready, syncing, synced, errors, bySource] = await Promise.all([
      prisma.accountingEntry.count({ where: { ...scope, status: "NEEDS_REVIEW" } }),
      prisma.accountingEntry.count({ where: { ...scope, status: "READY_TO_SYNC" } }),
      prisma.accountingEntry.count({ where: { ...scope, status: "SYNCING" } }),
      prisma.accountingEntry.count({ where: { ...scope, status: "SYNCED" } }),
      prisma.accountingEntry.count({ where: { ...scope, status: "SYNC_ERROR" } }),
      prisma.accountingEntry.groupBy({
        by: ["sourceType"],
        where: scope as never,
        _count: { _all: true },
      }),
    ]);
    return {
      needsReview, ready, syncing, synced, errors,
      bySource: Object.fromEntries(bySource.map((row) => [row.sourceType, row._count._all])),
    };
  },

  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "accounting");
    const entry = await prisma.accountingEntry.findFirst({ where: { ...scope, id } });
    if (!entry) throw new AppError("NOT_FOUND", "Accounting entry not found", 404);
    const attempts = await prisma.syncAttempt.findMany({
      where: { organizationId: ctx.organizationId, entryId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return { entry, attempts };
  },
};

/** Shared sync executor used by sandbox confirmSync and mirrored by the worker. */
export async function executeAccountingSyncJob(
  db: typeof prisma,
  args: { jobId: string; organizationId?: string; actorId?: string | null },
) {
  const job = await db.syncJob.findUnique({ where: { id: args.jobId } });
  if (!job) throw new AppError("NOT_FOUND", "Sync job not found", 404);
  if (args.organizationId && job.organizationId !== args.organizationId) {
    throw new AppError("NOT_FOUND", "Sync job not found", 404);
  }
  if (job.status === "COMPLETED") {
    return { job, reused: true };
  }
  if (job.provider !== "MOCK_QBO" && process.env.NODE_ENV === "production") {
    throw new AppError("PROVIDER_REQUIRED", `Accounting adapter ${job.provider} is not configured`, 403);
  }

  const entryIds = Array.isArray(job.entryIds) ? job.entryIds.map(String) : [];
  if (!entryIds.length) throw new AppError("EMPTY_JOB", "Sync job has no entries", 400);

  const claim = await db.syncJob.updateMany({
    where: { id: job.id, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "PROCESSING" },
  });
  if (claim.count !== 1 && job.status !== "PROCESSING") {
    const latest = await db.syncJob.findUniqueOrThrow({ where: { id: job.id } });
    return { job: latest, reused: true };
  }

  let successCount = 0;
  let failureCount = 0;

  for (const entryId of entryIds) {
    const entry = await db.accountingEntry.findFirst({
      where: { id: entryId, organizationId: job.organizationId },
    });
    if (!entry) {
      failureCount += 1;
      continue;
    }

    try {
      if (entry.status === "SYNCED" && entry.externalId) {
        await db.syncAttempt.create({
          data: {
            organizationId: job.organizationId,
            syncJobId: job.id,
            entryId,
            status: "SKIPPED",
            externalId: entry.externalId,
          },
        });
        successCount += 1;
        continue;
      }

      const result = await accountingProvider.post({
        id: entry.id,
        organizationId: entry.organizationId,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        category: entry.category,
        memo: entry.memo,
        coding: (entry.coding ?? {}) as Record<string, string>,
        amount: entry.amount != null ? String(entry.amount) : null,
        currency: entry.currency,
        externalId: entry.externalId,
      });

      const updated = await db.accountingEntry.updateMany({
        where: {
          id: entryId,
          organizationId: job.organizationId,
          status: { in: ["SYNCING", "SYNC_ERROR", "READY_TO_SYNC"] },
          OR: [{ externalId: null }, { externalId: result.externalId }],
        },
        data: {
          status: "SYNCED",
          externalId: result.externalId,
          syncedAt: new Date(),
          syncError: null,
          syncAttemptCount: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        // Already synced with same external id — treat as success (no duplicate).
        const current = await db.accountingEntry.findUniqueOrThrow({ where: { id: entryId } });
        if (current.externalId === result.externalId && current.status === "SYNCED") {
          successCount += 1;
          await db.syncAttempt.create({
            data: {
              organizationId: job.organizationId,
              syncJobId: job.id,
              entryId,
              status: "REUSED",
              externalId: result.externalId,
            },
          });
          continue;
        }
        throw new Error("Entry changed during sync");
      }

      await db.syncAttempt.create({
        data: {
          organizationId: job.organizationId,
          syncJobId: job.id,
          entryId,
          status: result.reused ? "REUSED" : "SUCCEEDED",
          externalId: result.externalId,
        },
      });
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : "Sync failed";
      await db.accountingEntry.updateMany({
        where: { id: entryId, organizationId: job.organizationId, status: { in: ["SYNCING", "READY_TO_SYNC"] } },
        data: {
          status: "SYNC_ERROR",
          syncError: message,
          syncAttemptCount: { increment: 1 },
        },
      });
      await db.syncAttempt.create({
        data: {
          organizationId: job.organizationId,
          syncJobId: job.id,
          entryId,
          status: "FAILED",
          error: message,
        },
      });
    }
  }

  const finalStatus = failureCount === 0 ? "COMPLETED" : successCount === 0 ? "FAILED" : "COMPLETED_WITH_ERRORS";
  const updatedJob = await db.syncJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      successCount,
      failureCount,
      completedAt: new Date(),
      error: failureCount ? `${failureCount} entr${failureCount === 1 ? "y" : "ies"} failed` : null,
    },
  });
  await db.outboxEvent.create({
    data: {
      organizationId: job.organizationId,
      type: "accounting.synced",
      payload: { jobId: job.id, successCount, failureCount, actorId: args.actorId ?? null },
    },
  });
  return { job: updatedJob, successCount, failureCount };
}

const TRAVEL_MCCS = "airlines,hotels,car_rental,ground_transportation,4511,7011,7512,4111";

async function provisionTravelInstruments(
  tx: Prisma.TransactionClient,
  ctx: RequestContext,
  trip: {
    id: string;
    organizationId: string;
    legalEntityId: string;
    travelerId: string;
    name: string;
    destination: string;
    currency: string;
    estimatedAmount: Prisma.Decimal | null;
    startDate: Date | null;
    endDate: Date | null;
    fundId: string | null;
    cardId: string | null;
  },
  booking: { amount: Prisma.Decimal; currency: string; type?: string } | null,
) {
  const limit = booking?.amount ?? trip.estimatedAmount ?? dec("0");
  let fund = trip.fundId
    ? await tx.fund.findFirst({ where: { id: trip.fundId, organizationId: ctx.organizationId } })
    : null;
  if (!fund) {
    const now = new Date();
    const start = trip.startDate && trip.startDate < now ? trip.startDate : now;
    const end = trip.endDate && trip.endDate > now
      ? new Date(trip.endDate.getTime() + 24 * 60 * 60 * 1000)
      : trip.endDate;
    fund = await tx.fund.create({
      data: {
        organizationId: ctx.organizationId,
        legalEntityId: trip.legalEntityId,
        name: `Travel · ${trip.name} · ${trip.destination}`.slice(0, 120),
        ownerId: trip.travelerId,
        availableAmount: limit,
        limitAmount: limit,
        currency: trip.currency,
        validFrom: start,
        validTo: end ?? null,
        status: "ACTIVE",
      },
    });
  }
  let card = trip.cardId
    ? await tx.card.findFirst({ where: { id: trip.cardId, organizationId: ctx.organizationId } })
    : null;
  if (!card) {
    card = await ensureHolderVirtualCard(tx, {
      organizationId: ctx.organizationId,
      legalEntityId: trip.legalEntityId,
      holderId: trip.travelerId,
      fundId: fund.id,
      merchantLock: null,
      allowedMccs: TRAVEL_MCCS,
      perTransactionLimit: limit,
      providerPrefix: "sandbox_travel",
    });
  }
  return { fund, card };
}

export const travel = {
  async createTrip(ctx: RequestContext, body: {
    name: string;
    legalEntityId: string;
    travelerId?: string;
    destination: string;
    origin?: string;
    purpose?: string;
    department?: string;
    international?: boolean;
    startDate: string;
    endDate: string;
    estimatedAmount: string;
    currency?: string;
    repriceTolerance?: string;
  }) {
    const currency = (body.currency ?? "USD").toUpperCase();
    const money = requireMoney(body.estimatedAmount, currency);
    assertEntityPermission(ctx, "travel.book", body.legalEntityId);
    const travelerId = body.travelerId ?? ctx.userId;
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      throw new AppError("INVALID_DATES", "Trip end date must be on or after the start date", 400);
    }
    if (!body.destination.trim()) throw new AppError("INVALID_DESTINATION", "Destination is required", 400);

    return prisma.$transaction(async (tx) => {
      const [entity, traveler] = await Promise.all([
        tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } }),
        tx.user.findFirst({ where: { id: travelerId, organizationId: ctx.organizationId, status: "ACTIVE" } }),
      ]);
      if (!entity || !traveler) throw new AppError("INVALID_REFERENCE", "Entity or traveler is unavailable", 400);
      requireCurrencyMatch(entity.currency, money.currency);

      const { rules } = await loadPolicyRules(
        (args) => tx.policy.findMany(args as never),
        ctx.organizationId,
        "travel",
      );
      const policy = evaluatePolicy({
        objectType: "travel",
        amount: Number(money.amount),
        outOfPolicy: false,
        rules: rules.length ? rules : [
          { type: "travel_max_amount", threshold: 2500 },
          { type: "travel_out_of_policy" },
        ],
      });

      const trip = await tx.travelTrip.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: entity.id,
          travelerId,
          name: body.name.trim(),
          origin: (body.origin ?? "").trim(),
          destination: body.destination.trim(),
          purpose: (body.purpose ?? "").trim(),
          department: (body.department ?? "").trim(),
          international: Boolean(body.international),
          startDate: start,
          endDate: end,
          estimatedAmount: dec(money.amount),
          currency: money.currency,
          status: "DRAFT",
          policyResult: policy.result,
          policyExplanation: policy.explanation,
          policyMatchedRules: policy.matchedRules as never,
          policyRequiredActions: policy.requiredActions as never,
          policyVersion: 1,
          policyEvaluatedAt: new Date(),
          repriceTolerance: body.repriceTolerance != null ? dec(body.repriceTolerance) : dec(DEFAULT_REPRICE_TOLERANCE),
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.trip_create",
          objectType: "TravelTrip", objectId: trip.id,
          newValue: {
            destination: trip.destination, startDate: start.toISOString(), endDate: end.toISOString(),
            estimatedAmount: money.amount, policyResult: policy.result,
          },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "travel.trip_created", payload: { tripId: trip.id } },
      });
      return trip;
    });
  },

  async search(ctx: RequestContext, tripId: string, body: { type: "FLIGHT" | "HOTEL" | "CAR"; origin?: string; cabin?: string }) {
    const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, organizationId: ctx.organizationId } });
    if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
    assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
    if (!trip.startDate || !trip.endDate) throw new AppError("MISSING_DATES", "Trip dates are required before search", 400);
    if (!canSearchTrip(trip.status)) {
      throw new AppError("INVALID_STATE", "Trip cannot search in this status", 409);
    }
    const quotes = await travelProvider().search({
      origin: (body.origin ?? trip.origin) || undefined,
      destination: trip.destination,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate.toISOString(),
      type: body.type,
      currency: trip.currency,
      cabin: body.cabin,
      maxAmount: trip.estimatedAmount != null ? Number(trip.estimatedAmount) : undefined,
    });
    await prisma.auditEvent.create({
      data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.search",
        objectType: "TravelTrip", objectId: tripId,
        newValue: { type: body.type, quoteCount: quotes.length, origin: body.origin ?? trip.origin },
        correlationId: ctx.correlationId,
      },
    });
    return { trip, quotes };
  },

  async selectQuote(ctx: RequestContext, tripId: string, body: {
    quoteId: string;
    type: "FLIGHT" | "HOTEL" | "CAR";
    supplier: string;
    description?: string;
    amount: string;
    currency: string;
    outOfPolicy?: boolean;
    policyResult?: string;
    refundable?: boolean;
    cancellationTerms?: string;
    offerExpiry?: string;
    provider?: string;
    providerOfferId?: string;
    itinerary?: Record<string, unknown>;
    startsAt?: string;
    endsAt?: string;
    metadata?: Record<string, unknown>;
  }) {
    const money = requireMoney(body.amount, body.currency);
    return prisma.$transaction(async (tx) => {
      const trip = await tx.travelTrip.findFirst({ where: { id: tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      if (!canSearchTrip(trip.status) && trip.status !== "READY_TO_BOOK") {
        throw new AppError("INVALID_STATE", "Cannot add quotes in this trip status", 409);
      }
      requireCurrencyMatch(trip.currency, money.currency);

      const outOfPolicy = Boolean(body.outOfPolicy);
      const { rules } = await loadPolicyRules(
        (args) => tx.policy.findMany(args as never),
        ctx.organizationId,
        "travel",
      );
      const policy = evaluatePolicy({
        objectType: "travel",
        amount: Number(money.amount),
        outOfPolicy,
        rules: rules.length ? rules : [
          { type: "travel_max_amount", threshold: 2500 },
          { type: "travel_out_of_policy" },
        ],
      });
      const policyResult = body.policyResult ?? policy.result;
      const snapshot = {
        provider: body.provider ?? "mock-travel",
        providerOfferId: body.providerOfferId ?? body.quoteId,
        quoteId: body.quoteId,
        type: body.type,
        supplier: body.supplier.trim(),
        quotedAmount: money.amount,
        currency: money.currency,
        offerExpiry: body.offerExpiry ?? null,
        refundable: body.refundable ?? true,
        cancellationTerms: body.cancellationTerms ?? "",
        outOfPolicy,
        policyResult,
        policyExplanation: policy.explanation,
        metadata: body.metadata ?? {},
        selectedAt: new Date().toISOString(),
      };

      const booking = await tx.travelBooking.create({
        data: {
          organizationId: ctx.organizationId,
          tripId,
          type: body.type,
          supplier: body.supplier.trim(),
          description: (body.description ?? `${body.type} option`).trim(),
          amount: dec(money.amount),
          quotedAmount: dec(money.amount),
          currency: money.currency,
          status: "QUOTED",
          outOfPolicy,
          providerOfferId: snapshot.providerOfferId,
          providerStatus: "NONE",
          refundable: snapshot.refundable,
          cancellationTerms: snapshot.cancellationTerms,
          offerExpiry: body.offerExpiry ? new Date(body.offerExpiry) : null,
          offerSnapshot: snapshot as Prisma.InputJsonValue,
          itinerary: (body.itinerary ?? { quoteId: body.quoteId, mock: true }) as Prisma.InputJsonValue,
          startsAt: body.startsAt ? new Date(body.startsAt) : trip.startDate,
          endsAt: body.endsAt ? new Date(body.endsAt) : trip.endDate,
        },
      });

      await tx.travelTrip.update({
        where: { id: tripId },
        data: {
          policyResult,
          policyExplanation: policy.explanation,
          policyMatchedRules: policy.matchedRules as never,
          policyRequiredActions: policy.requiredActions as never,
          policyEvaluatedAt: new Date(),
          estimatedAmount: dec(money.amount),
        },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.quote_selected",
          objectType: "TravelBooking", objectId: booking.id,
          newValue: { tripId, outOfPolicy, amount: money.amount, policyResult, snapshot } as Prisma.InputJsonValue,
          correlationId: ctx.correlationId,
        },
      });
      return { booking, policy };
    });
  },

  async submit(ctx: RequestContext, tripId: string) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.travelTrip.findFirst({ where: { id: tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      if (trip.status !== "DRAFT") throw new AppError("INVALID_STATE", "Only draft trips can be submitted", 409);

      const bookings = await tx.travelBooking.findMany({ where: { organizationId: ctx.organizationId, tripId } });
      if (!bookings.length) throw new AppError("QUOTE_REQUIRED", "Select a travel quote before submitting", 409);
      const anyOop = bookings.some((b) => b.outOfPolicy);
      const amount = Number(trip.estimatedAmount ?? 0);
      const { rules } = await loadPolicyRules(
        (args) => tx.policy.findMany(args as never),
        ctx.organizationId,
        "travel",
      );
      const policy = evaluatePolicy({
        objectType: "travel",
        amount,
        outOfPolicy: anyOop,
        rules: rules.length ? rules : [
          { type: "travel_max_amount", threshold: 2500 },
          { type: "travel_out_of_policy" },
        ],
      });

      // In-policy trips skip approval → READY_TO_BOOK (bookable). Out-of-policy must approve first.
      if (policy.result === "PASS" && !anyOop) {
        const claim = await tx.travelTrip.updateMany({
          where: { id: tripId, organizationId: ctx.organizationId, status: "DRAFT" },
          data: {
            status: "READY_TO_BOOK",
            policyResult: policy.result,
            policyExplanation: policy.explanation || "In-policy trip ready to book",
            policyMatchedRules: policy.matchedRules as never,
            policyRequiredActions: policy.requiredActions as never,
            policyVersion: 1,
            policyEvaluatedAt: new Date(),
          },
        });
        if (claim.count !== 1) throw new AppError("TRAVEL_CONFLICT", "Trip changed; refresh and try again", 409);
        const updated = await tx.travelTrip.findUniqueOrThrow({ where: { id: tripId } });
        await tx.auditEvent.create({
          data: {
            organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.submit_in_policy",
            objectType: "TravelTrip", objectId: tripId,
            newValue: { status: "READY_TO_BOOK", policyResult: policy.result },
            correlationId: ctx.correlationId,
          },
        });
        await tx.outboxEvent.create({
          data: { organizationId: ctx.organizationId, type: "travel.ready_to_book", payload: { tripId } },
        });
        return { trip: updated, requiresApproval: false, policy };
      }

      if (policy.result === "BLOCK") {
        const blocked = await tx.travelTrip.updateMany({
          where: { id: tripId, organizationId: ctx.organizationId, status: "DRAFT" },
          data: {
            status: "BLOCKED",
            policyResult: policy.result,
            policyExplanation: policy.explanation,
            policyMatchedRules: policy.matchedRules as never,
            policyRequiredActions: policy.requiredActions as never,
            policyEvaluatedAt: new Date(),
          },
        });
        if (blocked.count !== 1) throw new AppError("TRAVEL_CONFLICT", "Trip changed; refresh and try again", 409);
        throw new AppError("TRAVEL_POLICY_BLOCK", policy.explanation, 400);
      }

      const claim = await tx.travelTrip.updateMany({
        where: { id: tripId, organizationId: ctx.organizationId, status: "DRAFT" },
        data: {
          status: "PENDING_APPROVAL",
          policyResult: policy.result,
          policyExplanation: policy.explanation,
          policyMatchedRules: policy.matchedRules as never,
          policyRequiredActions: policy.requiredActions as never,
          policyVersion: 1,
          policyEvaluatedAt: new Date(),
        },
      });
      if (claim.count !== 1) throw new AppError("TRAVEL_CONFLICT", "Trip changed; refresh and try again", 409);

      await startApproval({
        organizationId: ctx.organizationId,
        objectType: "travel",
        objectId: tripId,
        requesterId: trip.travelerId,
        title: trip.name || `Travel to ${trip.destination}`,
        amount: String(trip.estimatedAmount ?? 0),
        currency: trip.currency,
        legalEntityId: trip.legalEntityId,
        policySummary: `Policy ${policy.result}: ${policy.explanation}`,
      }, tx);

      const updated = await tx.travelTrip.findUniqueOrThrow({ where: { id: tripId } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.submit",
          objectType: "TravelTrip", objectId: tripId,
          newValue: { status: "PENDING_APPROVAL", policyResult: policy.result, outOfPolicy: anyOop },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "travel.submitted", payload: { tripId } },
      });
      return { trip: updated, requiresApproval: true, policy };
    });
  },

  async approve(ctx: RequestContext, tripId: string) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.travelTrip.findFirst({ where: { id: tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      if (trip.status !== "PENDING_APPROVAL") throw new AppError("INVALID_STATE", "Trip is not pending approval", 409);
      assertEntityPermission(ctx, "travel.approve", trip.legalEntityId);
      if (trip.travelerId === ctx.userId) {
        throw new AppError("SOD_VIOLATION", "Traveler cannot approve their own trip", 403);
      }

      const instance = await tx.approvalInstance.findFirst({
        where: { organizationId: ctx.organizationId, objectType: "travel", objectId: tripId, status: "IN_REVIEW" },
        orderBy: { createdAt: "desc" },
      });
      if (!instance) throw new AppError("NOT_FOUND", "Approval was not started", 404);
      const decision = await actOnApproval({ instanceId: instance.id, actorId: ctx.userId, action: "approve" }, tx);
      if (decision.status !== "APPROVED") return { trip, approval: decision };

      const claim = await tx.travelTrip.updateMany({
        where: { id: tripId, organizationId: ctx.organizationId, status: "PENDING_APPROVAL" },
        data: { status: "READY_TO_BOOK" },
      });
      if (claim.count !== 1) throw new AppError("TRAVEL_CONFLICT", "Trip changed; refresh and try again", 409);
      const updated = await tx.travelTrip.findUniqueOrThrow({ where: { id: tripId } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.approve",
          objectType: "TravelTrip", objectId: tripId,
          oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "READY_TO_BOOK" },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "travel.ready_to_book", payload: { tripId } },
      });
      return { trip: updated, approval: decision };
    });
  },

  /** Reprice selected offer; blocks booking when delta exceeds trip tolerance. */
  async reprice(ctx: RequestContext, bookingId: string, body: { forceHigh?: boolean } = {}) {
    const outcome = await prisma.$transaction(async (tx) => {
      const booking = await tx.travelBooking.findFirst({ where: { id: bookingId, organizationId: ctx.organizationId } });
      if (!booking) throw new AppError("NOT_FOUND", "Booking not found", 404);
      const trip = await tx.travelTrip.findFirst({ where: { id: booking.tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      if (!["QUOTED", "PENDING_APPROVAL", "REPRICE_REQUIRED"].includes(booking.status)) {
        throw new AppError("INVALID_STATE", "Booking cannot be repriced in this status", 409);
      }
      const quoteId = booking.providerOfferId
        || String((booking.itinerary as { quoteId?: string })?.quoteId ?? booking.id);
      const quoted = Number(booking.quotedAmount ?? booking.amount);
      const result = await travelProvider().reprice({
        quoteId,
        quotedAmount: String(quoted),
        currency: booking.currency,
        forceHigh: body.forceHigh === true,
      });
      const tolerance = Number(trip.repriceTolerance ?? DEFAULT_REPRICE_TOLERANCE);
      const check = evaluateRepriceTolerance({
        quotedAmount: quoted,
        currentAmount: Number(result.amount),
        tolerance,
      });
      const nextStatus = check.withinTolerance ? (booking.status === "REPRICE_REQUIRED" ? "QUOTED" : booking.status) : "REPRICE_REQUIRED";
      const updated = await tx.travelBooking.update({
        where: { id: bookingId },
        data: {
          amount: dec(result.amount),
          offerExpiry: new Date(result.offerExpiry),
          status: nextStatus,
          offerSnapshot: {
            ...((booking.offerSnapshot as Record<string, unknown>) ?? {}),
            lastReprice: result,
            withinTolerance: check.withinTolerance,
            delta: check.delta,
            tolerance,
            repricedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.reprice",
          objectType: "TravelBooking", objectId: bookingId,
          newValue: { ...result, withinTolerance: check.withinTolerance, delta: check.delta, tolerance },
          correlationId: ctx.correlationId,
        },
      });
      return {
        booking: updated,
        reprice: result,
        withinTolerance: check.withinTolerance,
        delta: check.delta,
        tolerance,
        quoted,
      };
    });
    if (!outcome.withinTolerance) {
      throw new AppError(
        "REPRICE_TOLERANCE_EXCEEDED",
        `Current price ${outcome.reprice.amount} exceeds approved ${outcome.quoted} by more than tolerance ${outcome.tolerance}`,
        409,
      );
    }
    return outcome;
  },

  /** Places a mock hold only. Never marks the booking as provider-confirmed. Requires reprice within tolerance. */
  async bookMock(ctx: RequestContext, bookingId: string, body: { idempotencyKey?: string; skipReprice?: boolean } = {}) {
    type BookOutcome =
      | { ok: true; booking: Awaited<ReturnType<typeof prisma.travelBooking.findUniqueOrThrow>> }
      | { ok: false; code: string; message: string; status: number };

    const outcome = await prisma.$transaction(async (tx): Promise<BookOutcome> => {
      const booking = await tx.travelBooking.findFirst({ where: { id: bookingId, organizationId: ctx.organizationId } });
      if (!booking) throw new AppError("NOT_FOUND", "Booking not found", 404);
      const trip = await tx.travelTrip.findFirst({ where: { id: booking.tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);

      if (body.idempotencyKey) {
        const prior = await tx.travelBooking.findFirst({
          where: { organizationId: ctx.organizationId, idempotencyKey: body.idempotencyKey },
        });
        if (prior) {
          if (prior.id !== bookingId) throw new AppError("IDEMPOTENCY_CONFLICT", "Idempotency key used for another booking", 409);
          return { ok: true, booking: prior };
        }
      }

      if (!canBookTrip(trip.status)) {
        throw new AppError("APPROVAL_REQUIRED", "Trip must be ready to book before mock booking", 409);
      }
      if (booking.outOfPolicy && !["READY_TO_BOOK", "APPROVED", "BOOKING"].includes(trip.status)) {
        throw new AppError("OUT_OF_POLICY", "Out-of-policy booking requires an approved trip", 409);
      }
      if (!["QUOTED", "PENDING_APPROVAL"].includes(booking.status)) {
        if (booking.status === "BOOKED_MOCK" || booking.status === "CONFIRMED") return { ok: true, booking };
        if (booking.status === "REPRICE_REQUIRED") {
          throw new AppError("REPRICE_REQUIRED", "Reprice and reapprove before booking", 409);
        }
        throw new AppError("INVALID_STATE", "Booking is not available to hold", 409);
      }

      let holdAmount = String(booking.amount);
      if (!body.skipReprice) {
        const quoteId = booking.providerOfferId
          || String((booking.itinerary as { quoteId?: string })?.quoteId ?? booking.id);
        const quoted = Number(booking.quotedAmount ?? booking.amount);
        const result = await travelProvider().reprice({
          quoteId,
          quotedAmount: String(quoted),
          currency: booking.currency,
        });
        const tolerance = Number(trip.repriceTolerance ?? DEFAULT_REPRICE_TOLERANCE);
        const check = evaluateRepriceTolerance({
          quotedAmount: quoted,
          currentAmount: Number(result.amount),
          tolerance,
        });
        if (!check.withinTolerance) {
          await tx.travelBooking.update({
            where: { id: bookingId },
            data: {
              amount: dec(result.amount),
              status: "REPRICE_REQUIRED",
              offerSnapshot: {
                ...((booking.offerSnapshot as Record<string, unknown>) ?? {}),
                lastReprice: result,
                withinTolerance: false,
                delta: check.delta,
              } as Prisma.InputJsonValue,
            },
          });
          await tx.auditEvent.create({
            data: {
              organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.reprice_blocked",
              objectType: "TravelBooking", objectId: bookingId,
              newValue: { ...result, withinTolerance: false, delta: check.delta, tolerance },
              correlationId: ctx.correlationId,
            },
          });
          return {
            ok: false,
            code: "REPRICE_TOLERANCE_EXCEEDED",
            message: `Current price ${result.amount} exceeds approved ${quoted} by more than tolerance ${tolerance}`,
            status: 409,
          };
        }
        holdAmount = result.amount;
        await tx.travelBooking.update({
          where: { id: bookingId },
          data: { amount: dec(result.amount), approvedAmount: dec(String(quoted)) },
        });
      }

      const hold = await travelProvider().hold({
        quoteId: booking.providerOfferId || String((booking.itinerary as { quoteId?: string })?.quoteId ?? booking.id),
        tripId: trip.id,
        amount: holdAmount,
        currency: booking.currency,
      });
      if (hold.providerStatus !== "MOCK_HOLD" || hold.status !== "BOOKED_MOCK") {
        throw new AppError("PROVIDER_INVALID", "Travel adapter returned a non-mock hold", 500);
      }

      const claim = await tx.travelBooking.updateMany({
        where: { id: bookingId, organizationId: ctx.organizationId, status: { in: ["QUOTED", "PENDING_APPROVAL"] } },
        data: {
          status: "BOOKED_MOCK",
          providerRef: hold.providerRef,
          providerStatus: "MOCK_HOLD",
          confirmationNumber: hold.confirmationNumber ?? "",
          ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
        },
      });
      if (claim.count !== 1) throw new AppError("BOOKING_CONFLICT", "Booking changed; refresh and try again", 409);

      await tx.travelTrip.update({
        where: { id: trip.id },
        data: { status: "BOOKING" },
      });

      const updated = await tx.travelBooking.findUniqueOrThrow({ where: { id: bookingId } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.book_mock",
          objectType: "TravelBooking", objectId: bookingId,
          newValue: {
            status: "BOOKED_MOCK",
            providerStatus: "MOCK_HOLD",
            providerRef: hold.providerRef,
            note: "Mock hold only — not a confirmed live booking",
          },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId, type: "travel.booked_mock",
          payload: { bookingId, tripId: trip.id, providerRef: hold.providerRef },
        },
      });
      return { ok: true, booking: updated };
    });

    if (!outcome.ok) throw new AppError(outcome.code, outcome.message, outcome.status);
    return outcome.booking;
  },

  /** Sandbox-only explicit confirmation. Production must use provider callbacks. Provisions travel fund/card. */
  async confirmBooking(ctx: RequestContext, bookingId: string) {
    if (env.nodeEnv === "production") {
      throw new AppError("PROVIDER_REQUIRED", "Booking confirmation must come from the travel provider", 403);
    }
    return prisma.$transaction(async (tx) => {
      const booking = await tx.travelBooking.findFirst({ where: { id: bookingId, organizationId: ctx.organizationId } });
      if (!booking) throw new AppError("NOT_FOUND", "Booking not found", 404);
      const trip = await tx.travelTrip.findFirst({ where: { id: booking.tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);

      if (booking.status === "CONFIRMED") {
        return { booking, trip, fund: trip.fundId ? await tx.fund.findFirst({ where: { id: trip.fundId } }) : null, card: trip.cardId ? await tx.card.findFirst({ where: { id: trip.cardId } }) : null };
      }
      if (booking.status !== "BOOKED_MOCK") {
        throw new AppError("INVALID_STATE", "Only mock holds can be confirmed in sandbox", 409);
      }
      if (booking.providerStatus !== "MOCK_HOLD" || !booking.providerRef) {
        throw new AppError("NOT_MOCK_HOLD", "Booking is not a mock hold", 409);
      }

      const confirmed = await travelProvider().confirm({ providerRef: booking.providerRef });
      if (confirmed.status !== "CONFIRMED") {
        await tx.travelBooking.updateMany({
          where: { id: bookingId, status: "BOOKED_MOCK" },
          data: { status: "FAILED", providerStatus: "FAILED" },
        });
        throw new AppError("CONFIRM_FAILED", "Travel provider declined confirmation", 409);
      }

      const claim = await tx.travelBooking.updateMany({
        where: { id: bookingId, organizationId: ctx.organizationId, status: "BOOKED_MOCK" },
        data: {
          status: "CONFIRMED",
          providerStatus: "CONFIRMED",
          providerRef: confirmed.providerRef,
          confirmationNumber: confirmed.confirmationNumber ?? "",
        },
      });
      if (claim.count !== 1) throw new AppError("BOOKING_CONFLICT", "Booking changed; refresh and try again", 409);

      const { fund, card } = await provisionTravelInstruments(tx, ctx, trip, booking);

      await tx.travelTrip.update({
        where: { id: trip.id },
        data: {
          status: "CONFIRMED",
          fundId: fund?.id ?? trip.fundId,
          cardId: card?.id ?? trip.cardId,
        },
      });

      const updated = await tx.travelBooking.findUniqueOrThrow({ where: { id: bookingId } });
      const updatedTrip = await tx.travelTrip.findUniqueOrThrow({ where: { id: trip.id } });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.confirm",
          objectType: "TravelBooking", objectId: bookingId,
          oldValue: { status: "BOOKED_MOCK", providerStatus: "MOCK_HOLD" },
          newValue: {
            status: "CONFIRMED", providerStatus: "CONFIRMED", providerRef: confirmed.providerRef,
            fundId: fund?.id ?? null, cardId: card?.id ?? null,
          },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId, type: "travel.confirmed",
          payload: { bookingId, tripId: trip.id, providerRef: confirmed.providerRef, fundId: fund?.id, cardId: card?.id },
        },
      });
      return { booking: updated, trip: updatedTrip, fund, card };
    });
  },

  async cancelBooking(ctx: RequestContext, bookingId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.travelBooking.findFirst({ where: { id: bookingId, organizationId: ctx.organizationId } });
      if (!booking) throw new AppError("NOT_FOUND", "Booking not found", 404);
      const trip = await tx.travelTrip.findFirst({ where: { id: booking.tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      if (["CANCELLED", "REFUND_PENDING", "REFUNDED"].includes(booking.status)) return booking;
      if (!["CONFIRMED", "BOOKED_MOCK"].includes(booking.status) || !booking.providerRef) {
        throw new AppError("INVALID_STATE", "Only confirmed or held bookings can be cancelled", 409);
      }
      const result = await travelProvider().cancel({ providerRef: booking.providerRef, refundable: booking.refundable });
      if (result.status === "FAILED") throw new AppError("CANCEL_FAILED", "Provider declined cancellation", 409);
      const updated = await tx.travelBooking.update({
        where: { id: bookingId },
        data: {
          status: result.status,
          cancelledAt: new Date(),
          providerStatus: result.status,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.cancel",
          objectType: "TravelBooking", objectId: bookingId,
          newValue: { status: result.status },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: { organizationId: ctx.organizationId, type: "travel.cancelled", payload: { bookingId, tripId: trip.id, status: result.status } },
      });
      return updated;
    });
  },

  async refundBooking(ctx: RequestContext, bookingId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.travelBooking.findFirst({ where: { id: bookingId, organizationId: ctx.organizationId } });
      if (!booking) throw new AppError("NOT_FOUND", "Booking not found", 404);
      const trip = await tx.travelTrip.findFirst({ where: { id: booking.tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      if (booking.status === "REFUNDED") return { booking, expense: trip.expenseId ? await tx.expense.findFirst({ where: { id: trip.expenseId } }) : null };
      if (booking.status !== "REFUND_PENDING" && booking.status !== "CANCELLED") {
        throw new AppError("INVALID_STATE", "Booking must be cancelled before refund", 409);
      }
      if (!booking.providerRef) throw new AppError("MISSING_PROVIDER_REF", "Booking has no provider reference", 409);
      const result = await travelProvider().refund({ providerRef: booking.providerRef });
      if (result.status !== "REFUNDED") throw new AppError("REFUND_FAILED", "Provider declined refund", 409);

      const updated = await tx.travelBooking.update({
        where: { id: bookingId },
        data: { status: "REFUNDED", refundedAt: new Date(), providerStatus: "REFUNDED" },
      });

      // Link refund context on linked expense memo; restore fund availability when card-funded.
      let expense = trip.expenseId
        ? await tx.expense.findFirst({ where: { id: trip.expenseId, organizationId: ctx.organizationId } })
        : null;
      if (expense) {
        expense = await tx.expense.update({
          where: { id: expense.id },
          data: { memo: `${expense.memo} [REFUND ${booking.amount} ${booking.currency} trip ${trip.id}]`.trim() },
        });
      }
      if (trip.fundId) {
        const fund = await tx.fund.findFirst({ where: { id: trip.fundId, organizationId: ctx.organizationId } });
        if (fund) {
          const headroom = Prisma.Decimal.max(new Prisma.Decimal(0), fund.limitAmount.minus(fund.availableAmount));
          const restore = Prisma.Decimal.min(booking.amount, headroom);
          if (restore.gt(0)) {
            await tx.fund.update({
              where: { id: fund.id },
              data: { availableAmount: { increment: restore } },
            });
          }
        }
      }
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.refund",
          objectType: "TravelBooking", objectId: bookingId,
          newValue: { status: "REFUNDED", expenseId: expense?.id ?? null, amount: String(booking.amount) },
          correlationId: ctx.correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: ctx.organizationId, type: "travel.refunded",
          payload: { bookingId, tripId: trip.id, expenseId: expense?.id, amount: String(booking.amount) },
        },
      });
      return { booking: updated, expense };
    });
  },

  async provisionFundCard(ctx: RequestContext, tripId: string) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.travelTrip.findFirst({ where: { id: tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      if (!canBookTrip(trip.status) && !["BOOKING", "CONFIRMED", "BOOKED"].includes(trip.status)) {
        throw new AppError("INVALID_STATE", "Trip must be ready/booked before provisioning instruments", 409);
      }
      const booking = await tx.travelBooking.findFirst({
        where: { organizationId: ctx.organizationId, tripId, status: { in: ["CONFIRMED", "BOOKED_MOCK", "QUOTED"] } },
        orderBy: { createdAt: "desc" },
      });
      const { fund, card } = await provisionTravelInstruments(tx, ctx, trip, booking);
      const updated = await tx.travelTrip.update({
        where: { id: tripId },
        data: { fundId: fund?.id ?? trip.fundId, cardId: card?.id ?? trip.cardId },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.provision",
          objectType: "TravelTrip", objectId: tripId,
          newValue: { fundId: fund?.id, cardId: card?.id },
          correlationId: ctx.correlationId,
        },
      });
      return { trip: updated, fund, card };
    });
  },

  async importBooking(ctx: RequestContext, tripId: string, body: {
    type: "FLIGHT" | "HOTEL" | "CAR";
    supplier: string;
    amount: string;
    currency: string;
    confirmationNumber?: string;
    description?: string;
  }) {
    const money = requireMoney(body.amount, body.currency);
    return prisma.$transaction(async (tx) => {
      const trip = await tx.travelTrip.findFirst({ where: { id: tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      requireCurrencyMatch(trip.currency, money.currency);
      const booking = await tx.travelBooking.create({
        data: {
          organizationId: ctx.organizationId,
          tripId,
          type: body.type,
          supplier: body.supplier.trim(),
          description: (body.description ?? "Imported off-platform booking").trim(),
          amount: dec(money.amount),
          quotedAmount: dec(money.amount),
          currency: money.currency,
          status: "CONFIRMED",
          providerStatus: "IMPORTED",
          confirmationNumber: body.confirmationNumber ?? "",
          offerSnapshot: { imported: true, importedAt: new Date().toISOString() } as Prisma.InputJsonValue,
          itinerary: { imported: true } as Prisma.InputJsonValue,
          startsAt: trip.startDate,
          endsAt: trip.endDate,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.import_booking",
          objectType: "TravelBooking", objectId: booking.id,
          newValue: { tripId, amount: money.amount, confirmationNumber: body.confirmationNumber },
          correlationId: ctx.correlationId,
        },
      });
      return booking;
    });
  },

  async linkFund(ctx: RequestContext, tripId: string, fundId: string) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.travelTrip.findFirst({ where: { id: tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      const fund = await tx.fund.findFirst({
        where: { id: fundId, organizationId: ctx.organizationId, legalEntityId: trip.legalEntityId },
      });
      if (!fund) throw new AppError("FUND_NOT_FOUND", "Fund is unavailable for this trip entity", 404);
      const updated = await tx.travelTrip.update({
        where: { id: tripId },
        data: { fundId: fund.id },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.link_fund",
          objectType: "TravelTrip", objectId: tripId,
          newValue: { fundId: fund.id },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },

  async linkExpense(ctx: RequestContext, tripId: string, expenseId: string) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.travelTrip.findFirst({ where: { id: tripId, organizationId: ctx.organizationId } });
      if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
      assertEntityPermission(ctx, "travel.book", trip.legalEntityId);
      const expense = await tx.expense.findFirst({
        where: { id: expenseId, organizationId: ctx.organizationId, legalEntityId: trip.legalEntityId },
      });
      if (!expense) throw new AppError("EXPENSE_NOT_FOUND", "Expense is unavailable for this trip entity", 404);
      const updated = await tx.travelTrip.update({
        where: { id: tripId },
        data: { expenseId: expense.id },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "travel.link_expense",
          objectType: "TravelTrip", objectId: tripId,
          newValue: { expenseId: expense.id },
          correlationId: ctx.correlationId,
        },
      });
      return updated;
    });
  },

  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "travel");
    const trip = await prisma.travelTrip.findFirst({ where: { ...scope, id } });
    if (!trip) throw new AppError("NOT_FOUND", "Trip not found", 404);
    const bookings = await prisma.travelBooking.findMany({
      where: { organizationId: ctx.organizationId, tripId: id },
      orderBy: { createdAt: "asc" },
    });
    const [fund, card, expense, approval, audit] = await Promise.all([
      trip.fundId
        ? prisma.fund.findFirst({ where: { id: trip.fundId, organizationId: ctx.organizationId } })
        : null,
      trip.cardId
        ? prisma.card.findFirst({ where: { id: trip.cardId, organizationId: ctx.organizationId } })
        : null,
      trip.expenseId
        ? prisma.expense.findFirst({ where: { id: trip.expenseId, organizationId: ctx.organizationId } })
        : null,
      prisma.approvalInstance.findFirst({
        where: { organizationId: ctx.organizationId, objectType: "travel", objectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditEvent.findMany({
        where: {
          organizationId: ctx.organizationId,
          OR: [
            { objectType: "TravelTrip", objectId: id },
            ...(bookings.length
              ? [{ objectType: "TravelBooking", objectId: { in: bookings.map((b) => b.id) } }]
              : []),
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
    ]);
    return { trip, bookings, fund, card, expense, approval, audit };
  },
};

export const treasury = {
  async createTransfer(ctx: RequestContext, body: { fromAccountId: string; toAccountId: string; amount: string; currency: string }) {
    const money = requireMoney(body.amount, body.currency);
    return prisma.$transaction(async (tx) => {
      const [from, to] = await Promise.all([
        tx.bankAccount.findFirst({ where: { id: body.fromAccountId, organizationId: ctx.organizationId } }),
        tx.bankAccount.findFirst({ where: { id: body.toAccountId, organizationId: ctx.organizationId } }),
      ]);
      if (!from || !to) throw new AppError("INVALID_ACCOUNT", "Bank account is unavailable", 400);
      if (from.id === to.id) throw new AppError("INVALID_TRANSFER", "Source and destination must differ", 400);
      requireCurrencyMatch(from.currency, money.currency);
      requireCurrencyMatch(to.currency, money.currency);
      const transfer = await tx.bankTransfer.create({
        data: {
          organizationId: ctx.organizationId,
          fromAccountId: from.id,
          toAccountId: to.id,
          amount: dec(money.amount),
          currency: money.currency,
          status: "CREATED",
          createdBy: ctx.userId,
        },
      });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organizationId, actorId: ctx.userId, action: "transfer.create",
        objectType: "BankTransfer", objectId: transfer.id,
        newValue: { amount: money.amount, currency: money.currency, status: transfer.status },
        correlationId: ctx.correlationId,
      } });
      await tx.outboxEvent.create({ data: { organizationId: ctx.organizationId, type: "transfer.created", payload: { objectType: "BankTransfer", objectId: transfer.id } } });
      return transfer;
    });
  },
  async approve(ctx: RequestContext, id: string) {
    return auditedCommand(ctx, { action: "transfer.approve", objectType: "BankTransfer", objectId: id, event: "transfer.approved" }, async (tx) => {
      const transfer = await tx.bankTransfer.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!transfer) throw new AppError("NOT_FOUND", "Transfer not found", 404);
      if (transfer.status !== "CREATED") throw new AppError("INVALID_STATE", "Transfer is not awaiting approval", 409);
      if (transfer.createdBy === ctx.userId) {
        throw new AppError("SOD_VIOLATION", "Transfer creator cannot approve", 403);
      }
      const claim = await tx.bankTransfer.updateMany({
        where: { id, organizationId: ctx.organizationId, status: "CREATED" },
        data: { status: "APPROVED", approvedBy: ctx.userId },
      });
      if (claim.count !== 1) throw new AppError("TRANSFER_CONFLICT", "Transfer changed; refresh and try again", 409);
      const updated = await tx.bankTransfer.findUniqueOrThrow({ where: { id } });
      return { result: updated, oldValue: { status: transfer.status }, newValue: { status: updated.status, approvedBy: ctx.userId } };
    });
  },
  async release(ctx: RequestContext, id: string) {
    return auditedCommand(ctx, { action: "transfer.release", objectType: "BankTransfer", objectId: id, event: "transfer.sent" }, async (tx) => {
      const transfer = await tx.bankTransfer.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!transfer) throw new AppError("NOT_FOUND", "Transfer not found", 404);
      if (transfer.status !== "APPROVED") throw new AppError("INVALID_STATE", "Transfer must be approved before release", 409);
      if (transfer.createdBy === ctx.userId || transfer.approvedBy === ctx.userId) {
        throw new AppError("SOD_VIOLATION", "Creator/approver cannot release transfer", 403);
      }
      const claim = await tx.bankTransfer.updateMany({
        where: { id, organizationId: ctx.organizationId, status: "APPROVED" },
        data: { status: "SENT", releasedBy: ctx.userId },
      });
      if (claim.count !== 1) throw new AppError("TRANSFER_CONFLICT", "Transfer changed; refresh and try again", 409);
      const updated = await tx.bankTransfer.findUniqueOrThrow({ where: { id } });
      return { result: updated, oldValue: { status: transfer.status }, newValue: { status: updated.status, releasedBy: ctx.userId } };
    });
  },

  /** Sandbox settlement confirmation — production uses provider callbacks. */
  async confirmSettlement(ctx: RequestContext, id: string) {
    if (env.nodeEnv === "production") {
      throw new AppError("PROVIDER_REQUIRED", "Transfer settlement must come from the bank provider", 403);
    }
    return auditedCommand(ctx, { action: "transfer.settle", objectType: "BankTransfer", objectId: id, event: "transfer.settled" }, async (tx) => {
      const transfer = await tx.bankTransfer.findFirst({ where: { id, organizationId: ctx.organizationId } });
      if (!transfer) throw new AppError("NOT_FOUND", "Transfer not found", 404);
      if (transfer.status === "SETTLED" || transfer.status === "COMPLETED") {
        return { result: transfer, oldValue: { status: transfer.status }, newValue: { status: transfer.status } };
      }
      if (transfer.status !== "SENT" && transfer.status !== "PROCESSING") {
        throw new AppError("INVALID_STATE", "Only sent transfers can settle", 409);
      }
      const claim = await tx.bankTransfer.updateMany({
        where: { id, organizationId: ctx.organizationId, status: { in: ["SENT", "PROCESSING"] } },
        data: { status: "SETTLED" },
      });
      if (claim.count !== 1) throw new AppError("TRANSFER_CONFLICT", "Transfer changed before settlement", 409);
      const updated = await tx.bankTransfer.findUniqueOrThrow({ where: { id } });
      return { result: updated, oldValue: { status: transfer.status }, newValue: { status: "SETTLED" } };
    });
  },
};

export const receivables = {
  async applyCash(ctx: RequestContext, incomingPaymentId: string, invoiceId: string, amount: string) {
    const payment = await prisma.incomingPayment.findFirst({
      where: { id: incomingPaymentId, organizationId: ctx.organizationId },
    });
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: ctx.organizationId } });
    if (!payment || !invoice) throw new AppError("NOT_FOUND", "Payment or invoice not found", 404);
    if (n(payment.unapplied) < Number(amount)) {
      throw new AppError("CASH_EXCEEDS_UNAPPLIED", "Amount exceeds unapplied cash", 400);
    }
    const application = await prisma.cashApplication.create({
      data: { incomingPaymentId, invoiceId, amount: dec(amount) },
    });
    const unapplied = n(payment.unapplied) - Number(amount);
    await prisma.incomingPayment.update({
      where: { id: incomingPaymentId },
      data: { unapplied: dec(unapplied), status: unapplied <= 0 ? "APPLIED" : "PARTIAL" },
    });
    const balance = n(invoice.balance) - Number(amount);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { balance: dec(balance), status: balance <= 0 ? "PAID" : "PARTIAL" },
    });
    return application;
  },
};

export const reporting = {
  async dashboard(ctx: RequestContext) {
    const orgId = ctx.organizationId;
    const asOf = new Date();
    const [
      spend, payables, peopleCount, pendingBills, accountingReview, pendingRequests,
      budgets, openPos, travelPending, travelTripsTotal, travelConfirmedTrips, travelBookingsByType,
      cancelledBookings, refundedBookings, refundAmountAgg,
      integrations, unreadNotifications,
      missingReceipts, policyExceptions,
      approvedPayables, overdueBills, partialBills, paidBills, paymentFailures, upcomingPayments,
      openProcurementRequests, procurementAwaitingApproval, openPoCount, matchExceptions,
      reimbursementsSubmitted, reimbursementsAwaitingApproval, reimbursementsApproved, reimbursementsAwaitingPayout,
      reimbursementsPaid, reimbursementsFailed, reimbursementMileage, reimbursementPerDiem, reimbursementPolicyExceptions, reimbursementDuplicates,
    ] = await Promise.all([
      prisma.txn.groupBy({
        by: ["currency"],
        where: {
          organizationId: orgId,
          status: "CLEARED",
          ...(isStripeCardIssuer() ? { stripeTransactionId: { not: null } } : {}),
        },
        _sum: { amount: true },
      }),
      prisma.bill.groupBy({ by: ["currency"], where: { organizationId: orgId, NOT: { status: "PAID" } }, _sum: { remainingAmount: true } }),
      prisma.user.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
      prisma.bill.count({ where: { organizationId: orgId, status: "PENDING_APPROVAL" } }),
      prisma.accountingEntry.count({ where: { organizationId: orgId, status: "NEEDS_REVIEW" } }),
      prisma.spendRequest.count({ where: { organizationId: orgId, status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
      prisma.budget.findMany({ where: { organizationId: orgId }, take: 200 }),
      prisma.purchaseOrder.findMany({
        where: { organizationId: orgId, status: { in: ["OPEN", "ISSUED", "PARTIALLY_RECEIVED", "RECEIVED"] } },
        select: { currency: true, amount: true, billedAmount: true },
        take: 500,
      }),
      prisma.travelTrip.count({ where: { organizationId: orgId, status: { in: ["PENDING_APPROVAL", "READY_TO_BOOK", "APPROVED", "BOOKING"] } } }),
      prisma.travelTrip.count({ where: { organizationId: orgId } }),
      prisma.travelTrip.findMany({
        where: { organizationId: orgId, status: { in: ["CONFIRMED", "BOOKING", "BOOKED"] } },
        select: { travelerId: true, estimatedAmount: true, currency: true, destination: true, department: true, policyResult: true },
        take: 1000,
      }),
      prisma.travelBooking.groupBy({
        by: ["type", "currency"],
        where: { organizationId: orgId, status: "CONFIRMED" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.travelBooking.count({ where: { organizationId: orgId, status: { in: ["CANCELLED", "REFUND_PENDING"] } } }),
      prisma.travelBooking.count({ where: { organizationId: orgId, status: "REFUNDED" } }),
      prisma.travelBooking.aggregate({
        where: { organizationId: orgId, status: "REFUNDED" },
        _sum: { amount: true },
      }),
      prisma.integrationConnection.findMany({ where: { organizationId: orgId }, take: 50 }),
      prisma.notification.count({ where: { organizationId: orgId, userId: ctx.userId, readAt: null } }),
      prisma.expense.count({ where: { organizationId: orgId, status: "INCOMPLETE", receiptId: null } }),
      prisma.spendRequest.count({ where: { organizationId: orgId, policyResult: { in: ["WARN", "REVIEW", "BLOCK"] } } }),
      prisma.bill.count({ where: { organizationId: orgId, status: "APPROVED" } }),
      prisma.bill.count({ where: { organizationId: orgId, status: { in: ["APPROVED", "PARTIAL", "PENDING_APPROVAL"] }, dueDate: { lt: asOf } } }),
      prisma.bill.count({ where: { organizationId: orgId, status: "PARTIAL" } }),
      prisma.bill.count({ where: { organizationId: orgId, status: "PAID" } }),
      prisma.payment.count({ where: { organizationId: orgId, status: "FAILED" } }),
      prisma.payment.count({ where: { organizationId: orgId, status: { in: ["SCHEDULED", "PROCESSING"] } } }),
      prisma.purchaseRequest.count({ where: { organizationId: orgId, status: { in: ["DRAFT", "IN_REVIEW", "SUBMITTED"] } } }),
      prisma.purchaseRequest.count({ where: { organizationId: orgId, status: "IN_REVIEW" } }),
      prisma.purchaseOrder.count({ where: { organizationId: orgId, status: { in: ["ISSUED", "OPEN", "PARTIALLY_RECEIVED"] } } }),
      prisma.matchRecord.count({ where: { organizationId: orgId, status: { in: ["EXCEPTION", "BLOCKED"] }, exceptionStatus: { in: ["OPEN", "IN_REVIEW", ""] } } }),
      prisma.reimbursement.count({ where: { organizationId: orgId, status: { not: "DRAFT" } } }),
      prisma.reimbursement.count({ where: { organizationId: orgId, status: "IN_REVIEW" } }),
      prisma.reimbursement.count({ where: { organizationId: orgId, status: "APPROVED" } }),
      prisma.reimbursement.count({ where: { organizationId: orgId, status: { in: ["APPROVED", "SCHEDULED", "FAILED"] } } }),
      prisma.reimbursement.count({ where: { organizationId: orgId, status: "PAID" } }),
      prisma.reimbursement.count({ where: { organizationId: orgId, status: "FAILED" } }),
      prisma.reimbursement.aggregate({ where: { organizationId: orgId, type: "MILEAGE", status: "PAID" }, _sum: { amount: true } }),
      prisma.reimbursement.aggregate({ where: { organizationId: orgId, type: "PER_DIEM", status: "PAID" }, _sum: { amount: true } }),
      prisma.reimbursement.count({ where: { organizationId: orgId, policyResult: { in: ["WARN", "REVIEW", "BLOCK"] } } }),
      prisma.reimbursement.count({ where: { organizationId: orgId, duplicateStatus: { in: ["POSSIBLE_DUPLICATE", "BLOCKED_DUPLICATE"] } } }),
    ]);

    const budgetRows = budgets.map((budget) => {
      const capacity = budgetCapacity({
        amount: budget.amount,
        actualAmount: budget.actualAmount,
        committedAmount: budget.committedAmount,
      });
      return {
        id: budget.id,
        name: budget.name,
        currency: budget.currency,
        legalEntityId: budget.legalEntityId,
        period: budget.period,
        freshness: budget.freshness.toISOString(),
        ...capacity,
      };
    });

    // Company cash: Stripe Issuing FA when CARD_ISSUER_PROVIDER=stripe; else local BankAccount rows.
    let companyCashByCurrency: Array<{ currency: string; amount: string }> = [];
    let companyCashSource: "stripe" | "bank_accounts" | "unavailable" = "unavailable";
    let companyCashAccountId: string | null = null;
    let companyCashStatus: string | null = null;
    let companyCashError: string | null = null;
    try {
      const issuer = getCardIssuer();
      if (issuer.name === "stripe" && issuer.getCompanyBalance) {
        const balance = await issuer.getCompanyBalance();
        if (balance) {
          companyCashByCurrency = balance.available;
          companyCashSource = "stripe";
          companyCashAccountId = balance.financialAccountId;
          companyCashStatus = balance.status;
        }
      } else {
        const bankAccounts = await prisma.bankAccount.findMany({
          where: { organizationId: orgId },
          select: { currency: true, available: true },
          take: 50,
        });
        companyCashByCurrency = sumByCurrency(
          bankAccounts.map((row) => ({ currency: row.currency, amount: Number(row.available) })),
        );
        companyCashSource = "bank_accounts";
      }
    } catch (error) {
      companyCashError = error instanceof Error ? error.message : "Company cash unavailable";
      companyCashSource = isStripeCardIssuer() ? "stripe" : "unavailable";
    }

    return {
      companyCashByCurrency,
      companyCashSource,
      companyCashAccountId,
      companyCashStatus,
      companyCashError,
      clearedSpendByCurrency: spend.map((item) => ({ currency: item.currency, amount: String(item._sum.amount ?? 0) })),
      openPayablesByCurrency: payables.map((item) => ({ currency: item.currency, amount: String(item._sum.remainingAmount ?? 0) })),
      budgetCapacityByCurrency: sumByCurrency(budgetRows.map((row) => ({ currency: row.currency, amount: row.remainingAmount }))),
      budgetUsedByCurrency: sumByCurrency(budgetRows.map((row) => ({ currency: row.currency, amount: row.usedAmount }))),
      openPoCommitmentsByCurrency: sumByCurrency(openPos.map((po) => ({
        currency: po.currency,
        amount: Number(po.amount) - Number(po.billedAmount),
      }))),
      budgets: budgetRows,
      activePeople: peopleCount,
      pendingBills,
      approvedPayables,
      overdueBills,
      partiallyPaidBills: partialBills,
      paidBills,
      paymentFailures,
      upcomingPayments,
      openProcurementRequests,
      procurementAwaitingApproval,
      openPurchaseOrders: openPoCount,
      matchExceptions,
      reimbursementsSubmitted,
      reimbursementsAwaitingApproval,
      reimbursementsApproved,
      reimbursementsAwaitingPayout,
      reimbursementsPaid,
      reimbursementsFailed,
      mileageSpend: String(reimbursementMileage._sum.amount ?? 0),
      perDiemSpend: String(reimbursementPerDiem._sum.amount ?? 0),
      reimbursementPolicyExceptions,
      reimbursementDuplicateAlerts: reimbursementDuplicates,
      accountingReview,
      pendingRequests,
      missingReceipts,
      policyExceptions,
      travelPending,
      travel: (() => {
        const travelers = new Set(travelConfirmedTrips.map((t) => t.travelerId));
        const spendByCurrency = sumByCurrency(
          travelConfirmedTrips
            .filter((t) => t.estimatedAmount != null)
            .map((t) => ({ currency: t.currency, amount: Number(t.estimatedAmount) })),
        );
        const byType = (type: string) =>
          travelBookingsByType
            .filter((row) => row.type === type)
            .map((row) => ({ currency: row.currency, amount: String(row._sum.amount ?? 0) }));
        const inPolicy = travelConfirmedTrips.filter((t) => t.policyResult === "PASS").length;
        const outOfPolicy = travelConfirmedTrips.filter((t) => t.policyResult !== "PASS").length;
        const avgTripCost = travelConfirmedTrips.length
          ? travelConfirmedTrips.reduce((sum, t) => sum + Number(t.estimatedAmount ?? 0), 0) / travelConfirmedTrips.length
          : 0;
        const byDestination: Record<string, number> = {};
        const byDepartment: Record<string, number> = {};
        for (const t of travelConfirmedTrips) {
          const dest = t.destination || "Unknown";
          const dept = t.department || "Unassigned";
          byDestination[dest] = (byDestination[dest] ?? 0) + Number(t.estimatedAmount ?? 0);
          byDepartment[dept] = (byDepartment[dept] ?? 0) + Number(t.estimatedAmount ?? 0);
        }
        return {
          // Estimated trip amounts (planning); booking-type series below are CONFIRMED only.
          travelSpend: spendByCurrency,
          estimatedTripSpend: spendByCurrency,
          trips: travelTripsTotal,
          travelers: travelers.size,
          airfareSpend: byType("FLIGHT"),
          hotelSpend: byType("HOTEL"),
          carSpend: byType("CAR"),
          groundTransportSpend: byType("GROUND"),
          inPolicySpendTrips: inPolicy,
          outOfPolicySpendTrips: outOfPolicy,
          averageTripCost: avgTripCost.toFixed(2),
          spendByDestination: Object.entries(byDestination).map(([destination, amount]) => ({ destination, amount: String(amount) })),
          spendByDepartment: Object.entries(byDepartment).map(([department, amount]) => ({ department, amount: String(amount) })),
          cancelledBookings,
          refunds: refundedBookings,
          refundAmount: String(refundAmountAgg._sum.amount ?? 0),
        };
      })(),
      unreadNotifications,
      integrations: {
        total: integrations.length,
        healthy: integrations.filter((item) => item.health === "HEALTHY" || item.status === "CONNECTED").length,
        degraded: integrations.filter((item) => item.health === "DEGRADED" || item.status === "ERROR").length,
        items: integrations.map((item) => ({
          id: item.id,
          family: item.family,
          provider: item.provider,
          status: item.status,
          health: item.health,
          cursor: item.cursor,
          lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
          lastError: item.lastError,
        })),
      },
      freshness: {
        asOf: asOf.toISOString(),
        budgetFreshness: budgetRows.length
          ? new Date(Math.min(...budgetRows.map((row) => new Date(row.freshness).getTime()))).toISOString()
          : asOf.toISOString(),
      },
      asOf: asOf.toISOString(),
    };
  },
};

export const budgets = {
  present(budget: {
    id: string; name: string; legalEntityId: string; ownerId: string | null;
    amount: Prisma.Decimal; actualAmount: Prisma.Decimal; committedAmount: Prisma.Decimal;
    currency: string; period: string; freshness: Date; updatedAt?: Date;
  }) {
    const capacity = budgetCapacity({
      amount: budget.amount,
      actualAmount: budget.actualAmount,
      committedAmount: budget.committedAmount,
    });
    return {
      ...budget,
      amount: String(budget.amount),
      actualAmount: capacity.actualAmount,
      committedAmount: capacity.committedAmount,
      usedAmount: capacity.usedAmount,
      remainingAmount: capacity.remainingAmount,
      utilizationPct: capacity.utilizationPct,
      overBudget: capacity.overBudget,
      freshness: budget.freshness.toISOString(),
      updatedAt: budget.updatedAt?.toISOString(),
    };
  },

  async list(ctx: RequestContext) {
    const scope = await scopedWhere(ctx, "budgets");
    const rows = await prisma.budget.findMany({ where: scope, take: 100, orderBy: { name: "asc" } });
    return rows.map((row) => budgets.present(row));
  },

  async getDetail(ctx: RequestContext, id: string) {
    const scope = await scopedWhere(ctx, "budgets");
    const budget = await prisma.budget.findFirst({ where: { ...scope, id } });
    if (!budget) throw new AppError("NOT_FOUND", "Budget not found", 404);
    const programs = await prisma.spendProgram.findMany({
      where: { organizationId: ctx.organizationId, budgetId: id },
      select: { id: true, name: true, maxAmount: true, currency: true, status: true },
    });
    return { budget: budgets.present(budget), programs, currencyNote: "Totals are server-side by currency; actual and committed never double-count the same dollars." };
  },

  async create(ctx: RequestContext, body: {
    name: string; legalEntityId: string; amount: string | number; currency: string; period?: string;
  }) {
    const currency = String(body.currency ?? "USD").toUpperCase();
    const money = requireMoney(String(body.amount), currency);
    assertEntityPermission(ctx, "budget.manage", body.legalEntityId);
    return prisma.$transaction(async (tx) => {
      const entity = await tx.legalEntity.findFirst({ where: { id: body.legalEntityId, organizationId: ctx.organizationId } });
      if (!entity) throw new AppError("INVALID_ENTITY", "Entity is unavailable", 400);
      requireCurrencyMatch(entity.currency, money.currency);
      const budget = await tx.budget.create({
        data: {
          organizationId: ctx.organizationId,
          legalEntityId: entity.id,
          ownerId: ctx.userId,
          name: body.name.trim(),
          amount: dec(money.amount),
          currency: money.currency,
          period: body.period ?? "ANNUAL",
          freshness: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "budget.create",
          objectType: "Budget", objectId: budget.id,
          newValue: { amount: money.amount, currency: money.currency },
          correlationId: ctx.correlationId,
        },
      });
      return budgets.present(budget);
    });
  },
};

export const notifications = {
  async listMine(ctx: RequestContext) {
    const rows = await prisma.notification.findMany({
      where: { organizationId: ctx.organizationId, userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const routeByType: Record<string, string> = {
      spend_request: "/app/spend/requests", SpendRequest: "/app/spend/requests",
      bill: "/app/bill-pay/bills", Bill: "/app/bill-pay/bills",
      payment: "/app/bill-pay/payments", Payment: "/app/bill-pay/payments",
      match: "/app/procurement/match-exceptions", MatchResult: "/app/procurement/match-exceptions",
      reimbursement: "/app/expenses/reimbursements", Reimbursement: "/app/expenses/reimbursements",
      travel: "/app/travel/trips", TravelTrip: "/app/travel/trips",
    };
    return rows.map((row) => {
      if (row.href || !row.objectType || !row.objectId || !routeByType[row.objectType]) return row;
      const href = ["match", "MatchResult"].includes(row.objectType)
        ? `${routeByType[row.objectType]}?match=${encodeURIComponent(row.objectId)}`
        : `${routeByType[row.objectType]}/${row.objectId}`;
      return { ...row, href };
    });
  },

  async markRead(ctx: RequestContext, id: string) {
    const claim = await prisma.notification.updateMany({
      where: { id, organizationId: ctx.organizationId, userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (claim.count !== 1) {
      const existing = await prisma.notification.findFirst({
        where: { id, organizationId: ctx.organizationId, userId: ctx.userId },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Notification not found", 404);
      return existing;
    }
    return prisma.notification.findUniqueOrThrow({ where: { id } });
  },

  async markAllRead(ctx: RequestContext) {
    await prisma.notification.updateMany({
      where: { organizationId: ctx.organizationId, userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  },

  async create(ctx: RequestContext, input: {
    userId: string; type: string; title: string; body: string; href?: string; objectType?: string; objectId?: string;
  }) {
    return prisma.notification.create({
      data: {
        organizationId: ctx.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? "",
        objectType: input.objectType,
        objectId: input.objectId,
      },
    });
  },
};

export const integrations = {
  async listHealth(ctx: RequestContext) {
    const rows = await prisma.integrationConnection.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ family: "asc" }, { provider: "asc" }],
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      family: row.family,
      provider: row.provider,
      status: row.status,
      health: row.health,
      cursor: row.cursor,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      lastError: row.lastError,
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  /** Sandbox health check: advances cursor and marks HEALTHY without claiming live provider success. */
  async ping(ctx: RequestContext, id: string) {
    if (env.nodeEnv === "production") {
      throw new AppError("PROVIDER_REQUIRED", "Integration sync must use the live provider in production", 403);
    }
    return prisma.$transaction(async (tx) => {
      const connection = await tx.integrationConnection.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!connection) throw new AppError("NOT_FOUND", "Integration not found", 404);
      const cursor = `mock_${Date.now().toString(36)}`;
      const updated = await tx.integrationConnection.update({
        where: { id },
        data: {
          status: "CONNECTED",
          health: "HEALTHY",
          cursor,
          lastSyncAt: new Date(),
          lastError: "",
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId, action: "integration.ping",
          objectType: "IntegrationConnection", objectId: id,
          newValue: { cursor, health: "HEALTHY", sandbox: true },
          correlationId: ctx.correlationId,
        },
      });
      return {
        id: updated.id,
        family: updated.family,
        provider: updated.provider,
        status: updated.status,
        health: updated.health,
        cursor: updated.cursor,
        lastSyncAt: updated.lastSyncAt?.toISOString() ?? null,
        lastError: updated.lastError,
      };
    });
  },
};

export const savedViews = {
  async list(ctx: RequestContext, resource?: string) {
    return prisma.savedView.findMany({
      where: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        ...(resource ? { resource } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  },

  async create(ctx: RequestContext, body: {
    resource: string; name: string; filters?: Record<string, unknown>; columns?: string[];
  }) {
    const resource = body.resource.trim();
    const name = body.name.trim();
    if (!resource || !name) throw new AppError("INVALID_VIEW", "Resource and name are required", 400);
    return prisma.savedView.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        resource,
        name,
        filters: (body.filters ?? {}) as Prisma.InputJsonValue,
        columns: (body.columns ?? []) as Prisma.InputJsonValue,
      },
    });
  },

  async remove(ctx: RequestContext, id: string) {
    const claim = await prisma.savedView.deleteMany({
      where: { id, organizationId: ctx.organizationId, userId: ctx.userId },
    });
    if (claim.count !== 1) throw new AppError("NOT_FOUND", "Saved view not found", 404);
    return { ok: true };
  },
};

export const specialist = {
  async openDispute(ctx: RequestContext, transactionId: string, reason: string) {
    const txn = await prisma.txn.findFirst({ where: { id: transactionId, organizationId: ctx.organizationId } });
    if (!txn) throw new AppError("NOT_FOUND", "Transaction not found", 404);
    return prisma.disputeCase.create({
      data: {
        organizationId: ctx.organizationId,
        transactionId,
        reason,
        createdBy: ctx.userId,
      },
    });
  },
  async routeModel(ctx: RequestContext, requestedModel: string) {
    const routedModel = requestedModel.includes("gpt") ? requestedModel : "gpt-4.1-mini";
    return prisma.routerLog.create({
      data: {
        organizationId: ctx.organizationId,
        requestedModel,
        routedModel,
        provider: "mock-openai",
        tokens: 1200,
        latencyMs: 180,
        cost: dec("0.0120"),
        fallback: routedModel !== requestedModel,
      },
    });
  },
};
