/** Shared helpers for Accounting queue lists. */

export function accountingMoney(currency: string, value: string | number | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export function accountingSourceLabel(sourceType?: string) {
  switch (sourceType) {
    case "CARD":
    case "CARD_TRANSACTION":
      return "Card";
    case "EXPENSE":
      return "Expense";
    case "REIMBURSEMENT":
      return "Reimbursement";
    case "BILL":
      return "Bill";
    case "PAYMENT":
      return "Payment";
    case "BANK":
    case "BANK_TRANSFER":
      return "Bank";
    default:
      return sourceType?.replaceAll("_", " ") || "Source";
  }
}

export type AccountingRow = {
  id: string;
  sourceType?: string;
  sourceId?: string;
  amount?: string | number;
  currency?: string;
  category?: string;
  status?: string;
  externalId?: string | null;
  syncError?: string | null;
  memo?: string;
  updatedAt?: string;
  createdAt?: string;
};
