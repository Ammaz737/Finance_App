export type OfflineDraft = {
  type: "receipt" | "reimbursement" | "memo";
  payload: unknown;
  createdAt: string;
};

const KEY = "finance.offline-drafts";

export function saveOfflineDraft(draft: OfflineDraft) {
  const current = listOfflineDrafts();
  current.push(draft);
  globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
}

export function listOfflineDrafts(): OfflineDraft[] {
  const raw = globalThis.localStorage?.getItem(KEY);
  return raw ? (JSON.parse(raw) as OfflineDraft[]) : [];
}
