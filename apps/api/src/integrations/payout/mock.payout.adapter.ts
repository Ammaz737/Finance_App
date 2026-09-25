export interface PayoutProvider {
  schedule(input: {
    reimbursementId: string;
    amount: string;
    currency: string;
    rail: string;
  }): { providerRef: string; status: "SCHEDULED" };
  confirm(input: { providerRef: string }): { status: "PAID" | "DECLINED" | "FAILED"; settlementRef?: string; failureReason?: string };
}

/** Sandbox payout rail — never claims a live banking result. Label: SANDBOX / MOCK PAYOUT */
export class MockPayoutAdapter implements PayoutProvider {
  schedule(input: { reimbursementId: string; amount: string; currency: string; rail: string }) {
    return {
      providerRef: `mock_payout_${input.reimbursementId}`,
      status: "SCHEDULED" as const,
    };
  }

  confirm(input: { providerRef: string }) {
    if (!input.providerRef.startsWith("mock_payout_")) {
      return { status: "DECLINED" as const, failureReason: "Unknown provider reference" };
    }
    if (input.providerRef.includes("_fail_")) {
      return { status: "FAILED" as const, failureReason: "Mock provider declined settlement" };
    }
    return {
      status: "PAID" as const,
      settlementRef: `mock_settle_${input.providerRef}`,
    };
  }
}
