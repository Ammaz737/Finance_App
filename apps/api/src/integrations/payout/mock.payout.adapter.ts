export interface PayoutProvider {
  schedule(input: {
    reimbursementId: string;
    amount: string;
    currency: string;
    rail: string;
  }): { providerRef: string; status: "SCHEDULED" };
  confirm(input: { providerRef: string }): { status: "PAID" | "DECLINED" };
}

/** Sandbox payout rail — never claims a live banking result. */
export class MockPayoutAdapter implements PayoutProvider {
  schedule(input: { reimbursementId: string; amount: string; currency: string; rail: string }) {
    return {
      providerRef: `mock_payout_${input.reimbursementId}`,
      status: "SCHEDULED" as const,
    };
  }

  confirm(input: { providerRef: string }) {
    if (!input.providerRef.startsWith("mock_payout_")) return { status: "DECLINED" as const };
    return { status: "PAID" as const };
  }
}
