import fs from 'node:fs';
const file='apps/api/src/modules/cards/application/stripe-issuing-webhook.ts';let source=fs.readFileSync(file,'utf8');
source=source.replace('async function spendInWindow(cardId: string, organizationId: string, since: Date)', 'async function spendInWindow(tx: Prisma.TransactionClient, cardId: string, organizationId: string, since: Date)');
source=source.replace('const rows = await prisma.txn.findMany({','const rows = await tx.txn.findMany({');
const start=source.indexOf('  const [holder, fund, entity, businessLimit]');
const end=source.indexOf('\nasync function syncCardFromProvider');
const original=source.slice(start,end);
let decision=original.slice(0,original.indexOf('  const existingAuth ='));
decision=decision.replaceAll('prisma.','tx.').replaceAll('spendInWindow(card.id','spendInWindow(tx, card.id').replace('  const rule = evaluateCardAuthorizationRules','  let rule = evaluateCardAuthorizationRules').replace('[holder, fund, entity, businessLimit]','[holder, fund, businessLimit]').replace('    tx.legalEntity.findFirst({ where: { id: card.legalEntityId, organizationId: card.organizationId } }),\n','');
const replacement=`  const rule = await prisma.$transaction(async (tx) => {
    // Serialize reservations on this fund, including different event IDs for one authorization.
    await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(\${card.organizationId}), hashtext(\${card.fundId}))\`;
    const prior = await tx.cardAuthorization.findFirst({
      where: { organizationId: card.organizationId, stripeAuthorizationId: auth.id },
    });
    if (prior) return { decision: prior.decision, reason: prior.reason };
${decision.split('\n').map(line=>'  '+line).join('\n')}
    if (rule.decision === "APPROVED" && fund) {
      const reserved = await tx.fund.updateMany({
        where: { id: fund.id, organizationId: card.organizationId, status: "ACTIVE", availableAmount: { gte: dec(amountMajor) } },
        data: { availableAmount: { decrement: dec(amountMajor) } },
      });
      if (reserved.count !== 1) rule = { decision: "DECLINED", reason: "INSUFFICIENT_FUNDS" };
    }
    await tx.cardAuthorization.create({ data: {
      organizationId: card.organizationId, cardId: card.id, fundId: card.fundId,
      amount: dec(amountMajor), currency, merchant: auth.merchant_data?.name ?? "Unknown",
      merchantCategory: auth.merchant_data?.category ?? "", merchantCountry: auth.merchant_data?.country ?? null,
      decision: rule.decision, reason: rule.reason, providerEventId: auth.id,
      stripeAuthorizationId: auth.id, idempotencyKey: \`stripe:\${auth.id}\`,
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
`;
source=source.slice(0,start)+replacement+source.slice(end);
const transactionStart=source.indexOf('  const existing = await prisma.txn.findFirst',source.indexOf('export async function applyStripeIssuingTransactionCreated'));
const transactionEnd=source.indexOf('\nexport async function processStripeIssuingWebhook',transactionStart);
source=source.slice(0,transactionStart)+`  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(\${card.organizationId}), hashtext(\${card.id}))\`;
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
    await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(\${card.organizationId}), hashtext(\${fundId}))\`;
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
`+source.slice(transactionEnd);
source=source.replace('const eventRow = prior ?? await prisma.cardEvent.create({','const eventRow = prior ?? await prisma.cardEvent.upsert({\n    where: { stripeEventId: event.id },\n    update: {},\n    create: {').replace('      payload: event as unknown as Prisma.InputJsonValue,\n    },\n  });','      payload: event as unknown as Prisma.InputJsonValue,\n    },\n  });').replace('    create: {\n    data: {','    create: {');
fs.writeFileSync(file,source);
