/** Explicit reimbursement lifecycle helpers for GF4. */
export const REIMBURSEMENT_APPROVAL_STATUSES = ["IN_REVIEW", "AWAITING_APPROVAL", "POLICY_REVIEW"] as const;
export const REIMBURSEMENT_PAYABLE_STATUSES = ["APPROVED", "READY_FOR_PAYOUT", "FAILED"] as const;

export function canSubmitReimbursement(status: string): boolean {
  return status === "DRAFT" || status === "NEEDS_INFO";
}

export function canApproveReimbursement(status: string): boolean {
  return (REIMBURSEMENT_APPROVAL_STATUSES as readonly string[]).includes(status);
}

export function canSchedulePayout(status: string): boolean {
  return (REIMBURSEMENT_PAYABLE_STATUSES as readonly string[]).includes(status);
}

export function isPaid(status: string): boolean {
  return status === "PAID";
}
