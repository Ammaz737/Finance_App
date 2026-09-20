/** Normalized Accounting / ERP provider port. Domain depends on this, not a vendor SDK. */
export type AccountingPostInput = {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  category: string;
  memo: string;
  coding: Record<string, string>;
  amount?: string | null;
  currency?: string | null;
  /** Prior ERP id — adapters must reuse this and never create a second posting. */
  externalId?: string | null;
};

export type AccountingPostResult = {
  externalId: string;
  posted: boolean;
  reused: boolean;
};

export type AccountingDimensionSeed = {
  key: string;
  label: string;
  values: string[];
};

export interface AccountingProvider {
  post(entry: AccountingPostInput): Promise<AccountingPostResult>;
  listDimensions(): AccountingDimensionSeed[];
}
