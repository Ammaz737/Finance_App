import { Prisma } from "@prisma/client";
import { categoryAllowedByControl, categoryBlockedByControl } from "../../../integrations/card-issuer/stripe-spending-categories";

export type CardAuthRuleInput = {
  cardStatus: string;
  holderStatus: string;
  fundStatus: string;
  fundAvailable: Prisma.Decimal | number;
  fundValidFrom: Date;
  fundValidTo: Date | null;
  amount: Prisma.Decimal | number;
  currency: string;
  fundCurrency: string;
  merchant: string;
  merchantCategory: string;
  merchantCountry?: string | null;
  merchantLock?: string | null;
  allowedMccs?: string | null;
  blockedMccs?: string | null;
  allowedCountries?: string | null;
  blockedCountries?: string | null;
  perTransactionLimit?: Prisma.Decimal | number | null;
  dailyLimit?: Prisma.Decimal | number | null;
  weeklyLimit?: Prisma.Decimal | number | null;
  monthlyLimit?: Prisma.Decimal | number | null;
  velocityMaxAmount?: Prisma.Decimal | number | null;
  velocityMaxCount?: number | null;
  velocityWindowHours?: number | null;
  windowSpendAmount?: Prisma.Decimal | number;
  windowSpendCount?: number;
  dailySpendAmount?: Prisma.Decimal | number;
  weeklySpendAmount?: Prisma.Decimal | number;
  monthlySpendAmount?: Prisma.Decimal | number;
  businessLimitAmount?: Prisma.Decimal | number | null;
  businessUsedAmount?: Prisma.Decimal | number | null;
  now?: Date;
};

export type CardAuthRuleResult = { decision: "APPROVED" | "DECLINED"; reason: string };

function d(value: Prisma.Decimal | number | null | undefined): Prisma.Decimal {
  if (value == null) return new Prisma.Decimal(0);
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function list(value?: string | null) {
  return (value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

/** Fast, deterministic card authorization rules — no AI / OCR / accounting. */
export function evaluateCardAuthorizationRules(input: CardAuthRuleInput): CardAuthRuleResult {
  const now = input.now ?? new Date();
  const amount = d(input.amount);

  if (input.cardStatus === "FROZEN") return { decision: "DECLINED", reason: "CARD_FROZEN" };
  if (input.cardStatus === "TERMINATED" || input.cardStatus === "CANCELED") {
    return { decision: "DECLINED", reason: "CARD_TERMINATED" };
  }
  if (input.cardStatus !== "ACTIVE") return { decision: "DECLINED", reason: "CARD_INACTIVE" };
  if (input.holderStatus !== "ACTIVE") return { decision: "DECLINED", reason: "USER_INACTIVE" };
  if (input.fundStatus !== "ACTIVE") return { decision: "DECLINED", reason: "FUND_INACTIVE" };
  if (input.fundCurrency.toUpperCase() !== input.currency.toUpperCase()) {
    return { decision: "DECLINED", reason: "CURRENCY_MISMATCH" };
  }
  if (input.fundValidFrom > now || (input.fundValidTo && input.fundValidTo < now)) {
    return { decision: "DECLINED", reason: "FUND_EXPIRED" };
  }
  if (d(input.fundAvailable).lessThan(amount)) {
    return { decision: "DECLINED", reason: "INSUFFICIENT_FUND" };
  }

  if (input.merchantLock) {
    const lock = input.merchantLock.trim().toLowerCase();
    const merchant = input.merchant.trim().toLowerCase();
    if (!merchant.includes(lock) && lock !== merchant) {
      return { decision: "DECLINED", reason: "MERCHANT_LOCK" };
    }
  }

  const category = input.merchantCategory.trim().toLowerCase();
  const allowed = list(input.allowedMccs);
  // Accept demo aliases (software) and Stripe enums (computer_software_stores) interchangeably.
  if (allowed.length && category && !categoryAllowedByControl(category, allowed)) {
    return { decision: "DECLINED", reason: "MCC_BLOCKED" };
  }
  const blocked = list(input.blockedMccs);
  if (blocked.length && category && categoryBlockedByControl(category, blocked)) {
    return { decision: "DECLINED", reason: "MCC_BLOCKED" };
  }

  const country = (input.merchantCountry ?? "").trim().toLowerCase();
  const allowedCountries = list(input.allowedCountries);
  if (allowedCountries.length && country && !allowedCountries.includes(country)) {
    return { decision: "DECLINED", reason: "COUNTRY_BLOCKED" };
  }
  const blockedCountries = list(input.blockedCountries);
  if (blockedCountries.length && country && blockedCountries.includes(country)) {
    return { decision: "DECLINED", reason: "COUNTRY_BLOCKED" };
  }

  if (input.perTransactionLimit != null && amount.greaterThan(d(input.perTransactionLimit))) {
    return { decision: "DECLINED", reason: "PER_TXN_LIMIT" };
  }
  if (input.dailyLimit != null && d(input.dailySpendAmount).plus(amount).greaterThan(d(input.dailyLimit))) {
    return { decision: "DECLINED", reason: "DAILY_LIMIT" };
  }
  if (input.weeklyLimit != null && d(input.weeklySpendAmount).plus(amount).greaterThan(d(input.weeklyLimit))) {
    return { decision: "DECLINED", reason: "WEEKLY_LIMIT" };
  }
  if (input.monthlyLimit != null && d(input.monthlySpendAmount).plus(amount).greaterThan(d(input.monthlyLimit))) {
    return { decision: "DECLINED", reason: "MONTHLY_LIMIT" };
  }

  if (input.velocityMaxCount != null && (input.windowSpendCount ?? 0) >= input.velocityMaxCount) {
    return { decision: "DECLINED", reason: "VELOCITY_COUNT" };
  }
  if (input.velocityMaxAmount != null && d(input.windowSpendAmount).plus(amount).greaterThan(d(input.velocityMaxAmount))) {
    return { decision: "DECLINED", reason: "VELOCITY_AMOUNT" };
  }

  if (input.businessLimitAmount != null) {
    const used = d(input.businessUsedAmount);
    if (used.plus(amount).greaterThan(d(input.businessLimitAmount))) {
      return { decision: "DECLINED", reason: "BUSINESS_LIMIT" };
    }
  }

  return { decision: "APPROVED", reason: "" };
}
