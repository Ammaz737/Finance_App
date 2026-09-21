export type PolicyResult = "PASS" | "WARN" | "REVIEW" | "BLOCK";

export type PolicyRule = {
  type: string;
  threshold?: number;
  category?: string;
  action?: string;
};

export type PolicyEvaluation = {
  result: PolicyResult;
  rule: string;
  /** Stable reason string for API/audit consumers (mirrors explanation). */
  reason: string;
  explanation: string;
  evidence: string[];
  requiredAction?: string;
  requiredActions: string[];
  matchedRules: string[];
};

const severity: Record<PolicyResult, number> = { PASS: 0, WARN: 1, REVIEW: 2, BLOCK: 3 };

function worse(a: PolicyResult, b: PolicyResult): PolicyResult {
  return severity[a] >= severity[b] ? a : b;
}

function hit(partial: {
  result: PolicyResult;
  rule: string;
  explanation: string;
  evidence: string[];
  requiredAction?: string;
  matchedRules: string[];
}): PolicyEvaluation {
  return {
    ...partial,
    reason: partial.explanation,
    requiredActions: partial.requiredAction ? [partial.requiredAction] : [],
  };
}

function applyRule(rule: PolicyRule, input: {
  objectType: string;
  amount: number;
  hasReceipt?: boolean;
  hasMemo?: boolean;
  category?: string;
  outOfPolicy?: boolean;
}): PolicyEvaluation | null {
  switch (rule.type) {
    case "hard_policy_block":
    case "block":
      if (input.outOfPolicy) {
        return hit({
          result: "BLOCK",
          rule: rule.type,
          explanation: "This action is blocked by a hard policy control.",
          evidence: [input.objectType],
          requiredAction: "Change request or choose an in-policy option",
          matchedRules: [rule.type],
        });
      }
      return null;
    case "receipt_required": {
      if (input.objectType !== "expense" && input.objectType !== "reimbursement") return null;
      const threshold = rule.threshold ?? 75;
      if (!input.hasReceipt && input.amount >= threshold) {
        const result = (rule.action === "review" ? "REVIEW" : "BLOCK") as PolicyResult;
        return hit({
          result,
          rule: "receipt_required",
          explanation: `Receipt is required for amounts at or above ${threshold.toFixed(2)}.`,
          evidence: [`amount=${input.amount}`, `threshold=${threshold}`],
          requiredAction: "Attach receipt",
          matchedRules: ["receipt_required"],
        });
      }
      return null;
    }
    case "memo_required": {
      if (input.objectType !== "expense" && input.objectType !== "reimbursement" && input.objectType !== "spend_request") return null;
      const threshold = rule.threshold ?? 0;
      if (!input.hasMemo && input.amount >= threshold) {
        return hit({
          result: input.objectType === "spend_request" ? "REVIEW" : "REVIEW",
          rule: "memo_required",
          explanation: "A business purpose / memo is required by policy.",
          evidence: [`amount=${input.amount}`],
          requiredAction: "Add memo",
          matchedRules: ["memo_required"],
        });
      }
      return null;
    }
    case "high_value": {
      const threshold = rule.threshold ?? 10000;
      if (input.amount >= threshold) {
        return hit({
          result: "WARN",
          rule: "high_value",
          explanation: `High-value item (≥ ${threshold.toFixed(2)}) requires additional review.`,
          evidence: [`amount=${input.amount}`, `threshold=${threshold}`],
          matchedRules: ["high_value"],
        });
      }
      return null;
    }
    case "category_amount": {
      if (rule.category && input.category && rule.category.toUpperCase() !== input.category.toUpperCase()) return null;
      const threshold = rule.threshold ?? 500;
      if (input.amount > threshold) {
        return hit({
          result: "REVIEW",
          rule: "category_amount",
          explanation: `${rule.category ?? "Category"} spend above ${threshold.toFixed(2)} requires review.`,
          evidence: [`amount=${input.amount}`, `category=${input.category ?? ""}`],
          requiredAction: rule.action ?? "manager_approval",
          matchedRules: ["category_amount"],
        });
      }
      return null;
    }
    case "manager_approval":
      if (input.amount >= (rule.threshold ?? 0)) {
        return hit({
          result: "REVIEW",
          rule: "manager_approval",
          explanation: "Manager approval is required by policy.",
          evidence: [`amount=${input.amount}`],
          requiredAction: "manager_approval",
          matchedRules: ["manager_approval"],
        });
      }
      return null;
    case "travel_max_amount": {
      if (input.objectType !== "travel") return null;
      const threshold = rule.threshold ?? 2500;
      if (input.amount > threshold) {
        return hit({
          result: "REVIEW",
          rule: "travel_max_amount",
          explanation: `Estimated travel spend above ${threshold.toFixed(2)} requires approval.`,
          evidence: [`amount=${input.amount}`, `threshold=${threshold}`],
          requiredAction: "travel_approval",
          matchedRules: ["travel_max_amount"],
        });
      }
      return null;
    }
    case "travel_out_of_policy": {
      if (input.objectType !== "travel") return null;
      if (input.outOfPolicy) {
        const result = (rule.action === "block" ? "BLOCK" : "REVIEW") as PolicyResult;
        return hit({
          result,
          rule: "travel_out_of_policy",
          explanation: "Selected travel option is out of policy and requires approval before booking.",
          evidence: [input.objectType, `amount=${input.amount}`],
          requiredAction: "travel_approval",
          matchedRules: ["travel_out_of_policy"],
        });
      }
      return null;
    }
    default:
      return null;
  }
}

/** Evaluate policy using explicit rules (simulation and execution share this path). */
export function evaluatePolicy(input: {
  objectType: string;
  amount: number;
  hasReceipt?: boolean;
  hasMemo?: boolean;
  merchant?: string;
  category?: string;
  outOfPolicy?: boolean;
  rules?: PolicyRule[];
}): PolicyEvaluation {
  const rules = input.rules?.length
    ? input.rules
    : [
        { type: "hard_policy_block" },
        { type: "receipt_required", threshold: 75 },
        { type: "high_value", threshold: 10000 },
      ];

  let result: PolicyEvaluation = {
    result: "PASS",
    rule: "default_allow",
    reason: "No blocking policy matched.",
    explanation: "No blocking policy matched.",
    evidence: [],
    requiredActions: [],
    matchedRules: [],
  };

  for (const rule of rules) {
    const matched = applyRule(rule, input);
    if (!matched) continue;
    if (severity[matched.result] >= severity[result.result]) {
      result = {
        ...matched,
        matchedRules: [...new Set([...result.matchedRules, ...matched.matchedRules])],
        evidence: [...new Set([...result.evidence, ...matched.evidence])],
        requiredActions: [...new Set([...result.requiredActions, ...matched.requiredActions])],
      };
    } else {
      result = {
        ...result,
        matchedRules: [...new Set([...result.matchedRules, ...matched.matchedRules])],
        evidence: [...new Set([...result.evidence, ...matched.evidence])],
        requiredActions: [...new Set([...result.requiredActions, ...matched.requiredActions])],
      };
    }
    result.result = worse(result.result, matched.result);
    result.reason = result.explanation;
  }

  return result;
}

export async function loadPolicyRules(
  findMany: (args: { where: object; orderBy: object }) => Promise<Array<{ rules: unknown; name: string; version: number }>>,
  organizationId: string,
  objectType: string,
): Promise<{ rules: PolicyRule[]; policyNames: string[] }> {
  const now = new Date();
  const policies = await findMany({
    where: {
      organizationId,
      objectType,
      enabled: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: [{ priority: "asc" }, { version: "desc" }],
  });
  const rules = policies.flatMap((policy) => (Array.isArray(policy.rules) ? policy.rules as PolicyRule[] : []));
  return { rules, policyNames: policies.map((policy) => `${policy.name} v${policy.version}`) };
}
