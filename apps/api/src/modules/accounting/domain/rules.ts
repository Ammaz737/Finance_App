export type RuleMatch = {
  sourceType?: string;
  categoryContains?: string;
  memoContains?: string;
  minAmount?: number;
};

export type RuleCoding = {
  category?: string;
  memo?: string;
  coding?: Record<string, string>;
};

export type AccountingRuleRow = {
  match: unknown;
  coding: unknown;
  priority: number;
  enabled: boolean;
};

export function matchAccountingRule(
  rule: AccountingRuleRow,
  entry: { sourceType: string; category: string; memo: string; amount?: number | null },
): boolean {
  if (!rule.enabled) return false;
  const match = (rule.match ?? {}) as RuleMatch;
  if (match.sourceType && match.sourceType !== entry.sourceType) return false;
  if (match.categoryContains && !entry.category.toLowerCase().includes(match.categoryContains.toLowerCase())) return false;
  if (match.memoContains && !entry.memo.toLowerCase().includes(match.memoContains.toLowerCase())) return false;
  if (match.minAmount != null && (entry.amount == null || entry.amount < match.minAmount)) return false;
  return true;
}

export function pickAccountingRule(
  rules: AccountingRuleRow[],
  entry: { sourceType: string; category: string; memo: string; amount?: number | null },
): RuleCoding | null {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    if (matchAccountingRule(rule, entry)) {
      const coding = (rule.coding ?? {}) as RuleCoding;
      return {
        category: coding.category,
        memo: coding.memo,
        coding: coding.coding ?? (typeof coding === "object" ? Object.fromEntries(
          Object.entries(coding as Record<string, unknown>).filter(([key]) => !["category", "memo", "coding"].includes(key))
            .map(([key, value]) => [key, String(value ?? "")]),
        ) : {}),
      };
    }
  }
  return null;
}
