/** Deterministic AP vendor matching before AI. */
export type VendorMatchDecision = "MATCHED" | "SUGGESTED" | "NO_MATCH";

export type VendorMatchCandidate = {
  id: string;
  name: string;
  legalName?: string | null;
  displayName?: string | null;
  taxId?: string | null;
  bankLast4?: string | null;
};

export function normalizeVendorName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(inc|llc|ltd|corp|co|company|plc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchVendor(input: {
  extractedName?: string | null;
  taxId?: string | null;
  bankLast4?: string | null;
  candidates: VendorMatchCandidate[];
}): { decision: VendorMatchDecision; vendorId: string | null; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let best: { id: string; score: number } | null = null;
  const needle = normalizeVendorName(input.extractedName ?? "");
  const tax = (input.taxId ?? "").replace(/\W/g, "").toLowerCase();
  const last4 = (input.bankLast4 ?? "").replace(/\D/g, "").slice(-4);

  for (const candidate of input.candidates) {
    let score = 0;
    const names = [candidate.name, candidate.legalName, candidate.displayName]
      .filter(Boolean)
      .map((value) => normalizeVendorName(String(value)));
    if (needle && names.some((name) => name === needle)) {
      score += 50;
      reasons.push("name_exact");
    } else if (needle && names.some((name) => name.includes(needle) || needle.includes(name))) {
      score += 30;
      reasons.push("name_fuzzy");
    }
    const candidateTax = (candidate.taxId ?? "").replace(/\W/g, "").toLowerCase();
    if (tax && candidateTax && tax === candidateTax) {
      score += 40;
      reasons.push("tax_id");
    }
    if (last4 && candidate.bankLast4 && last4 === candidate.bankLast4) {
      score += 25;
      reasons.push("bank_last4");
    }
    if (!best || score > best.score) best = { id: candidate.id, score };
  }

  if (!best || best.score < 30) {
    return { decision: "NO_MATCH", vendorId: null, score: best?.score ?? 0, reasons: [...new Set(reasons)] };
  }
  if (best.score >= 70) {
    return { decision: "MATCHED", vendorId: best.id, score: best.score, reasons: [...new Set(reasons)] };
  }
  return { decision: "SUGGESTED", vendorId: best.id, score: best.score, reasons: [...new Set(reasons)] };
}
