import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { env } from "../../../config/env";
import { prisma } from "../../../database/client";
import { AppError } from "../../../platform/http";
import { getCardIssuer } from "../../../integrations/card-issuer";
import { StripeCardIssuerAdapter } from "../../../integrations/card-issuer/stripe.card-issuer.adapter";
import { evaluateCardAuthorizationRules } from "../domain/authorization-rules";
import { settleStripeIssuingTransaction } from "./stripe-transaction-settlement";

function dec(value: string | number) {
  return new Prisma.Decimal(value);
}

function mapProviderStatusToApp(status: string, currentAppStatus?: string): string {
  if (status === "active") return "ACTIVE";
  if (status === "canceled") return "TERMINATED";
  // Stripe "inactive" covers both frozen and not-yet-activated cards.
  if (currentAppStatus === "FROZEN") return "FROZEN";
  return "INACTIVE";
}

async function spendInWindow(tx: Prisma.TransactionClient, cardId: string, organizationId: string, since: Date) {
  const rows = await tx.txn.findMany({
    where: {
      organizationId,
      cardId,
      status: { in: ["PENDING", "CLEARED"] },
      authorizedAt: { gte: since },
    },
    select: { amount: true },
  });
  return {
    count: rows.length,
    amount: rows.reduce((sum, row) => sum.plus(row.amount), dec(0)),
  };
}

export async function applyStripeIssuingAuthorizationRequest(auth: Stripe.Issuing.Authorization) {
  const providerCardId = typeof auth.card === "string" ? auth.card : auth.card.id;
  const card = await prisma.card.findFirst({
    where: {
      OR: [{ stripeCardId: providerCardId }, { providerRef: providerCardId }],
    },
  });
  const issuer = getCardIssuer();
  if (!card) {
    if (issuer.declineAuthorization) await issuer.declineAuthorization(auth.id, "CARD_NOT_FOUND");
    return { decision: "DECLINED", reason: "CARD_NOT_FOUND" };
  }

  const rule = await prisma.$transaction(async (tx) => {
    // Serialize reservations on this fund, including different event IDs for one authorization.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${card.organizationId}), hashtext(${card.fundId}))`;
    const prior = await tx.cardAuthorization.findFirst({
      where: { organizationId: card.organizationId, stripeAuthorizationId: auth.id },
    });
    if (prior) return { decision: prior.decision, reason: prior.reason };
    const [holder, fund, businessLimit] = await Promise.all([
      tx.user.findFirst({ where: { id: card.holderId, organizationId: card.organizationId } }),
      tx.fund.findFirst({ where: { id: card.fundId, organizationId: card.organizationId } }),
      tx.businessLimit.findFirst({
        where: {
          organizationId: card.organizationId,
          legalEntityId: card.legalEntityId,
          currency: (auth.currency ?? "usd").toUpperCase(),
        },
      }),
    ]);

    const now = new Date();
    const windowHours = Math.max(1, card.velocityWindowHours || 24);
    const window = await spendInWindow(tx, card.id, card.organizationId, new Date(now.getTime() - windowHours * 60 * 60 * 1000));
    const day = await spendInWindow(tx, card.id, card.organizationId, new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const week = await spendInWindow(tx, card.id, card.organizationId, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const month = await spendInWindow(tx, card.id, card.organizationId, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

    let businessUsed: Prisma.Decimal | null = null;
    if (businessLimit) {
      const usage = await tx.txn.aggregate({
        where: {
          organizationId: card.organizationId,
          legalEntityId: card.legalEntityId,
          currency: (auth.currency ?? "usd").toUpperCase(),
          status: { in: ["PENDING", "CLEARED"] },
        },
        _sum: { amount: true },
      });
      businessUsed = usage._sum.amount ?? dec(0);
    }

    const amountMajor = Number(auth.amount) / 100;
    const currency = (auth.currency ?? env.stripeIssuingCurrency).toUpperCase();
    let rule = evaluateCardAuthorizationRules({
      cardStatus: card.status,
      holderStatus: holder?.status ?? "INACTIVE",
      fundStatus: fund?.status ?? "INACTIVE",
      fundAvailable: fund?.availableAmount ?? 0,
      fundValidFrom: fund?.validFrom ?? now,
      fundValidTo: fund?.validTo ?? null,
      amount: amountMajor,
      currency,
      fundCurrency: fund?.currency ?? currency,
      merchant: auth.merchant_data?.name ?? "Unknown",
      merchantCategory: auth.merchant_data?.category ?? "",
      merchantCountry: auth.merchant_data?.country ?? null,
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
      windowSpendAmount: window.amount,
      windowSpendCount: window.count,
      dailySpendAmount: day.amount,
      weeklySpendAmount: week.amount,
      monthlySpendAmount: month.amount,
      businessLimitAmount: businessLimit?.amount ?? null,
      businessUsedAmount: businessUsed,
      now,
    });


    if (rule.decision === "APPROVED" && fund) {
      const reserved = await tx.fund.updateMany({
        where: { id: fund.id, organizationId: card.organizationId, status: "ACTIVE", availableAmount: { gte: dec(amountMajor) } },
        data: { availableAmount: { decrement: dec(amountMajor) } },
      });
      if (reserved.count !== 1) rule = { decision: "DECLINED", reason: "INSUFFICIENT_FUND" };
    }
    await tx.cardAuthorization.create({ data: {
      organizationId: card.organizationId, cardId: card.id, fundId: card.fundId,
      amount: dec(amountMajor), currency, merchant: auth.merchant_data?.name ?? "Unknown",
      merchantCategory: auth.merchant_data?.category ?? "", merchantCountry: auth.merchant_data?.country ?? null,
      decision: rule.decision, reason: rule.reason, providerEventId: auth.id,
      stripeAuthorizationId: auth.id, idempotencyKey: `stripe:${auth.id}`,
    } });
    return rule;
  }, { timeout: 10_000 });

  // Provider calls happen after commit; a failed call can retry the saved decision safely.
  if (auth.status === "pending") {
    if (rule.decision === "APPROVED" && auth.approved !== true && issuer.approveAuthorization) {
      await issuer.approveAuthorization(auth.id);
    } else if (rule.decision === "DECLINED" && issuer.declineAuthorization) {
      await issuer.declineAuthorization(auth.id, rule.reason);
    }
  }
  return rule;
}

async function syncCardFromProvider(providerCardId: string) {
  const issuer = getCardIssuer();
  const remote = await issuer.getCard(providerCardId);
  const card = await prisma.card.findFirst({
    where: { OR: [{ stripeCardId: providerCardId }, { providerRef: providerCardId }] },
  });
  if (!card) return;
  await prisma.card.update({
    where: { id: card.id },
    data: {
      status: mapProviderStatusToApp(remote.status, card.status),
      last4: remote.last4,
      brand: remote.brand,
      network: remote.network,
      stripeCardId: remote.providerCardId,
      providerRef: remote.providerCardId,
      provider: issuer.name,
    },
  });
}

export async function applyStripeIssuingTransactionCreated(txn: Stripe.Issuing.Transaction) {
  const providerCardId = typeof txn.card === "string" ? txn.card : txn.card.id;
  const card = await prisma.card.findFirst({
    where: { OR: [{ stripeCardId: providerCardId }, { providerRef: providerCardId }] },
  });
  if (!card) return;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${card.organizationId}), hashtext(${card.id}))`;
    const existing = await tx.txn.findFirst({
      where: { organizationId: card.organizationId, stripeTransactionId: txn.id },
    });
    if (existing) return;
    const authId = typeof txn.authorization === "string" ? txn.authorization : txn.authorization?.id;
    const localAuth = authId ? await tx.cardAuthorization.findFirst({
      where: { organizationId: card.organizationId, stripeAuthorizationId: authId },
    }) : null;
    // Stripe amounts are money entering/leaving the issuer account: captures negative, refunds positive.
    const amount = dec(-Number(txn.amount) / 100);
    const currency = (txn.currency ?? "usd").toUpperCase();
    const merchant = txn.merchant_data?.name ?? "Unknown";
    const fundId = localAuth?.fundId ?? card.fundId;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${card.organizationId}), hashtext(${fundId}))`;
    let fundDebit = amount;
    if (amount.greaterThan(0) && localAuth?.decision === "APPROVED") {
      const captured = await tx.txn.aggregate({
        where: { organizationId: card.organizationId, authorizationId: localAuth.id, amount: { gt: 0 }, status: "CLEARED" },
        _sum: { amount: true },
      });
      const priorAmount = captured._sum.amount ?? dec(0);
      fundDebit = Prisma.Decimal.max(dec(0), priorAmount.plus(amount).minus(localAuth.amount))
        .minus(Prisma.Decimal.max(dec(0), priorAmount.minus(localAuth.amount)));
    }
    const created = await tx.txn.create({ data: {
      organizationId: card.organizationId, legalEntityId: card.legalEntityId, cardId: card.id,
      fundId, authorizationId: localAuth?.id, amount, currency, merchant,
      status: "CLEARED", clearedAt: new Date(), capturedAmount: amount,
      stripeTransactionId: txn.id, providerClearEventId: txn.id,
    } });
    if (!fundDebit.isZero()) await tx.fund.update({
      where: { id: fundId }, data: { availableAmount: { decrement: fundDebit } },
    });
    await settleStripeIssuingTransaction({
      organizationId: card.organizationId, legalEntityId: card.legalEntityId,
      cardId: card.id, fundId, holderId: card.holderId, transactionId: created.id,
      amount, currency, merchant,
    }, tx);
  }, { timeout: 10_000 });
}

export async function processStripeIssuingWebhook(rawBody: Buffer, signature: string | undefined) {
  if (env.cardIssuerProvider !== "stripe") {
    throw new AppError("PROVIDER_REQUIRED", "Stripe webhooks require CARD_ISSUER_PROVIDER=stripe", 400);
  }
  if (!env.stripeWebhookSecret) {
    throw new AppError("MISCONFIGURED", "STRIPE_WEBHOOK_SECRET is not configured", 500);
  }
  if (!signature) throw new AppError("UNAUTHORIZED", "Missing Stripe-Signature", 400);

  const issuer = getCardIssuer();
  if (!(issuer instanceof StripeCardIssuerAdapter)) {
    throw new AppError("PROVIDER_REQUIRED", "Stripe adapter is not active", 400);
  }

  let event: Stripe.Event;
  try {
    event = issuer.constructWebhookEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid Stripe webhook signature", 400);
  }

  const prior = await prisma.cardEvent.findUnique({ where: { stripeEventId: event.id } });
  if (prior?.processedAt) {
    return { ok: true, duplicate: true, eventId: event.id };
  }

  const eventRow = prior ?? await prisma.cardEvent.upsert({
    where: { stripeEventId: event.id },
    update: {},
    create: {
      id: randomUUID(),
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as Prisma.InputJsonValue,
    },
  });

  try {
    switch (event.type) {
      case "issuing_authorization.request":
        await applyStripeIssuingAuthorizationRequest(event.data.object as Stripe.Issuing.Authorization);
        break;
      case "issuing_authorization.created":
      case "issuing_authorization.updated":
        // Request path is authoritative for approve/decline; created/updated sync status only.
        break;
      case "issuing_card.created":
      case "issuing_card.updated": {
        const card = event.data.object as Stripe.Issuing.Card;
        await syncCardFromProvider(card.id);
        break;
      }
      case "issuing_cardholder.created":
      case "issuing_cardholder.updated":
        break;
      case "issuing_transaction.created":
        await applyStripeIssuingTransactionCreated(event.data.object as Stripe.Issuing.Transaction);
        break;
      case "issuing_dispute.created":
      case "issuing_dispute.closed":
        // Persist for ops; dispute workflows remain P1.
        break;
      default:
        break;
    }

    await prisma.cardEvent.update({
      where: { id: eventRow.id },
      data: { processedAt: new Date(), error: "" },
    });
    return { ok: true, duplicate: false, eventId: event.id, type: event.type };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    await prisma.cardEvent.update({
      where: { id: eventRow.id },
      data: { error: message.slice(0, 500) },
    });
    throw error;
  }
}
