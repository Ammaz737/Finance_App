import type {
  AccountingDimensionSeed,
  AccountingPostInput,
  AccountingPostResult,
  AccountingProvider,
} from "./accounting.provider";

/**
 * Mock ERP adapter. Posting is idempotent on accounting entry id:
 * the same entry always maps to the same externalId — retries never duplicate.
 */
export class MockAccountingAdapter implements AccountingProvider {
  async post(entry: AccountingPostInput): Promise<AccountingPostResult> {
    const externalId = entry.externalId?.trim() || `qbo_${entry.id}`;
    return {
      externalId,
      posted: true,
      reused: Boolean(entry.externalId),
    };
  }

  listDimensions(): AccountingDimensionSeed[] {
    return [
      { key: "category", label: "GL Category", values: ["Software", "Travel", "Meals", "Office", "Other"] },
      { key: "department", label: "Department", values: ["Engineering", "Finance", "Ops", "Sales"] },
      { key: "glAccount", label: "GL Account", values: ["6100", "6200", "6300", "6400"] },
    ];
  }
}
