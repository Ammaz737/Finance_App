import { evaluatePolicy } from "../../../../engines/policy";

/** Policy Agent may recommend only. It cannot approve, release money, or override RBAC. */
export function recommendExpensePolicy(input: { amount: number; hasReceipt: boolean }) {
  const evaluation = evaluatePolicy({ objectType: "expense", ...input });
  return {
    recommendation: evaluation.explanation,
    confidence: 0.82,
    evidence: evaluation.evidence,
    sourceObjects: ["expense", "policy"],
    policyRule: evaluation.rule,
    humanReviewRequired: evaluation.result !== "PASS",
    result: evaluation.result,
  };
}
