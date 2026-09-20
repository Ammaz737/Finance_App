export interface CardIssuerProvider {
  issueVirtual(): { token: string; last4: string; network: string };
  authorize(input: { available: number; amount: number }): "APPROVED" | "DECLINED";
  /** Sandbox/provider ack for settling a hold. Real rails use processor events. */
  capture(input: { authorizedAmount: number; captureAmount: number }): "CAPTURED" | "DECLINED";
  void(input: { authorizedAmount: number }): "VOIDED" | "DECLINED";
  reverse(input: { capturedAmount: number }): "REVERSED" | "DECLINED";
}
